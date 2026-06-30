/**
 * Ingestão do `matchNumber` oficial FIFA via core API ESPN (TASK-07).
 *
 * O scoreboard (`site.api.espn.com`) expõe o pareamento dos placeholders
 * ("Round of 32 N Winner") mas NÃO o número próprio de slot de cada jogo. O
 * **core API** (`sports.core.api.espn.com/.../events/{id}/competitions/{id}`)
 * traz `matchNumber` — o número oficial FIFA — que fecha essa lacuna e permite
 * computar as arestas reais pai→filho da chave (TASK-08).
 *
 * Offsets por fase confirmados com coleta real (2026-06-30, eventos
 * 760486–760517 = mn 73–104), `slotInRound = matchNumber − offset`:
 *   round-of-32   73–88   off 72   (slots 1–16)
 *   round-of-16   89–96   off 88   (slots 1–8)
 *   quarterfinals 97–100  off 96   (slots 1–4)
 *   semifinals    101–102 off 100  (slots 1–2)
 *   3rd-place     103     off 102  (slot 1)
 *   final         104     off 103  (slot 1)
 *
 * Resiliência: API não-oficial → cada evento é tolerante a ausência/erro; uma
 * falha individual é omitida (não contamina o mapa) e uma falha total degrada
 * para mapa vazio — o bracket NUNCA quebra por causa do core API.
 *
 * Custo: ~30 chamadas, paralelas, com **cache 24h** (a estrutura FIFA é fixa,
 * independe de placar). NUNCA no caminho de placar ao vivo (tier 60s).
 *
 * NÃO importa `server-only`: módulo usado em testes vitest (fora de RSC),
 * espelhando `espnClient.ts`. A restrição server-only é aplicada no caller.
 */

import { z } from "zod";

import {
  EspnScoreClient,
  EspnTimeoutError,
  EspnFetchError,
  EspnParseError,
} from "./espnClient";
import { buildEspnMatchId, isGroupStage } from "./espnMatchId";
import type { EspnEvent } from "./espnTypes";

// ─── Tipos públicos ──────────────────────────────────────────────────────────

/**
 * Slot de bracket de um jogo. `round` = slug ESPN da fase do próprio jogo
 * (consistente com `BracketSlot.round` de TASK-02); `slotInRound` = posição
 * 1-based, única dentro da fase, derivada do `matchNumber`.
 */
export interface EspnBracketSlot {
  round: string;
  slotInRound: number;
}

/** Mapa `matchId` do domínio → slot de bracket. Possivelmente parcial/vazio. */
export type EspnBracketMap = Map<string, EspnBracketSlot>;

// ─── Configuração ────────────────────────────────────────────────────────────

const CORE_API_BASE =
  "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events";

/** Cache 24h — estrutura da chave é fixa (FIFA), independe de placar. */
const REVALIDATE_BRACKET = 86_400;

/** Schema mínimo da competition do core API: só o `matchNumber` interessa. */
const coreCompetitionSchema = z
  .object({ matchNumber: z.coerce.number().int() })
  .passthrough();

/** Faixa de `matchNumber` e offset por slug de fase (coleta real 2026-06-30). */
const SLOT_RANGES: Readonly<
  Record<string, { offset: number; min: number; max: number }>
> = {
  "round-of-32": { offset: 72, min: 73, max: 88 },
  "round-of-16": { offset: 88, min: 89, max: 96 },
  "quarterfinals": { offset: 96, min: 97, max: 100 },
  "semifinals": { offset: 100, min: 101, max: 102 },
  "3rd-place-match": { offset: 102, min: 103, max: 103 },
  "final": { offset: 103, min: 104, max: 104 },
};

// ─── Derivação pura ──────────────────────────────────────────────────────────

/**
 * Deriva o slot da fase a partir do slug ESPN + `matchNumber`. Retorna `null`
 * (degrada, não lança) para slug desconhecido, `matchNumber` não-inteiro, ou
 * `matchNumber` fora da faixa da fase. Pura — sem I/O.
 */
export function deriveSlotInRound(
  stageSlug: string,
  matchNumber: number,
): EspnBracketSlot | null {
  const range = SLOT_RANGES[stageSlug];
  if (!range) {
    return null;
  }
  if (
    !Number.isInteger(matchNumber) ||
    matchNumber < range.min ||
    matchNumber > range.max
  ) {
    return null;
  }
  return { round: stageSlug, slotInRound: matchNumber - range.offset };
}

// ─── Cliente HTTP de 1 evento (core API) ─────────────────────────────────────

/**
 * Busca o `matchNumber` de um evento via core API (cache 24h). Espelha o núcleo
 * de `EspnScoreClient`: abort → fetch → status → json → validação de shape, com
 * os MESMOS erros tipados (`Espn*Error`).
 *
 * @throws EspnTimeoutError  abort por timeout.
 * @throws EspnFetchError    HTTP !ok.
 * @throws EspnParseError    JSON inválido ou `matchNumber` ausente/fora do shape.
 */
export async function fetchEspnMatchNumber(
  eventId: string,
  timeoutMs = 10_000,
): Promise<number> {
  const url = `${CORE_API_BASE}/${eventId}/competitions/${eventId}`;

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_BRACKET },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new EspnTimeoutError(timeoutMs);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Erro de rede ao buscar core API ESPN: ${message}`);
  } finally {
    clearTimeout(timerId);
  }

  if (!response.ok) {
    throw new EspnFetchError(response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new EspnParseError("JSON inválido");
  }

  const result = coreCompetitionSchema.safeParse(body);
  if (!result.success) {
    throw new EspnParseError(result.error.message);
  }

  return result.data.matchNumber;
}

// ─── Agregador ───────────────────────────────────────────────────────────────

/**
 * Mapa `matchId` do domínio → slot de bracket, para todos os jogos de mata-mata
 * disponíveis. Degrada SEM lançar: falha individual (timeout/HTTP/parse/slot
 * fora de faixa) omite só aquele evento; falha total (schedule indisponível)
 * retorna mapa vazio.
 *
 * O `matchId` reusa a MESMA atribuição sequencial por data de
 * `mapEspnEventsToMatches` (KO ordenados por `date` ASC, `knockoutNum = 73 + i`)
 * para que TASK-08 faça o join direto em `KnockoutMatch.id`. O `slotInRound`,
 * porém, vem do `matchNumber` oficial (numeração distinta da sequência).
 */
export async function fetchEspnBracketMap(): Promise<EspnBracketMap> {
  const map: EspnBracketMap = new Map();

  let events: EspnEvent[];
  try {
    events = await new EspnScoreClient().fetchSchedule();
  } catch (err) {
    console.error(
      "[espnBracketMap] falha no schedule ESPN; bracket sem conectores:",
      err,
    );
    return map;
  }

  const knockout = events
    .filter((e) => !isGroupStage(e))
    .sort((a, b) => a.date.localeCompare(b.date));

  const results = await Promise.allSettled(
    knockout.map(async (event, i) => {
      const matchId = buildEspnMatchId(event, 73 + i);
      const slug = event.season?.slug;
      if (!slug) {
        return null;
      }
      const matchNumber = await fetchEspnMatchNumber(event.id);
      const slot = deriveSlotInRound(slug, matchNumber);
      if (!slot) {
        return null;
      }
      return [matchId, slot] as const;
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      map.set(r.value[0], r.value[1]);
    } else if (r.status === "rejected") {
      console.warn("[espnBracketMap] evento KO omitido (core API):", r.reason);
    }
  }

  return map;
}
