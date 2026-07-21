/**
 * Cliente HTTP do scoreboard ESPN (API pública não-oficial `site.api.espn.com`).
 *
 * Sequência abort → fetch → status check → json → validação de shape, com
 * erros tipados (`EspnTimeoutError`/`EspnFetchError`/`EspnParseError`).
 *
 * Busca placar/estado AO VIVO da Copa (liga `fifa.world`). Cache 1min via
 * Next.js data cache (`next: { revalidate: 60 }`) — alinhado ao tier de live.
 *
 * Achados empíricos (spike TASK-00, 2026-06-14):
 * - `?dates=YYYYMMDD` é OBRIGATÓRIO — a janela default cobre só 1 dia.
 * - `score` é string → coerção feita no schema (espnTypes.ts).
 *
 * NÃO importa `server-only`: módulo usado em testes vitest (fora de RSC).
 * A restrição server-only é aplicada no caller (matchSource, TASK-06).
 */

import type { Championship } from "@/types/championships";

import { parseEspnScoreboard, type EspnScoreboard, type EspnEvent } from "./espnTypes";

// ─── Erros customizados ─────────────────────────────────────────────────────

export class EspnTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout ao buscar scoreboard ESPN após ${timeoutMs}ms.`);
    this.name = "EspnTimeoutError";
  }
}

export class EspnFetchError extends Error {
  constructor(status: number) {
    super(`Erro ao buscar scoreboard ESPN: HTTP ${status}.`);
    this.name = "EspnFetchError";
  }
}

export class EspnParseError extends Error {
  constructor(cause: string) {
    super(`Scoreboard ESPN inválido ou fora do formato esperado: ${cause}`);
    this.name = "EspnParseError";
  }
}

// ─── Configuração ───────────────────────────────────────────────────────────

/** Base do scoreboard ESPN por slug de liga. `{slug}` → path da competição. */
const ESPN_SCOREBOARD_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Slug default — Copa 2026 (compat: chamadas sem slug não mudam de destino). */
const DEFAULT_ESPN_SLUG = "fifa.world";

/** Cache 1min — janela ao vivo (status/placar ESPN refrescam a cada 60s). */
const REVALIDATE_LIVE = 60;

/**
 * Cap ESPN de eventos por chamada (hard cap, sem cursor — spike TASK-00/01).
 * Um range que retorna >= este valor está (ou pode estar) TRUNCADO → falha
 * ruidosa em vez de perder jogos em silêncio.
 */
const ESPN_EVENT_CAP = 100;

/**
 * Ranges disjuntos (`YYYYMMDD-YYYYMMDD`) que cobrem o torneio inteiro (104 jogos).
 * ESPN trunca em 100 eventos por chamada (hard cap, sem cursor — spike TASK-00),
 * por isso o split em 2 ranges: grupos (72) + mata-mata (32).
 * Range termina em 0719 (final); o `-20260715` do PRD original cortava semis/final.
 */
export const ESPN_TOURNAMENT_RANGES: readonly string[] = [
  "20260611-20260627",
  "20260628-20260719",
];

// ─── Derivação de ranges por campeonato ─────────────────────────────────────

/** Último dia do mês `m` (1-12) do ano `y`, como número (28-31). */
function lastDayOfMonth(y: number, m: number): number {
  // `new Date(y, m, 0)` = último dia do mês anterior a `m+1` = último dia de `m`.
  return new Date(y, m, 0).getDate();
}

/** Formata `YYYYMMDD` a partir de ano/mês/dia numéricos. */
function ymd(y: number, m: number, d: number): string {
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

/**
 * Deriva os ranges de datas (`YYYYMMDD-YYYYMMDD`) que cobrem a temporada de um
 * campeonato, respeitando o cap ESPN de 100 eventos/chamada.
 *
 * - **Legado (`fifa.world`)**: retorna exatamente os ranges canônicos da Copa
 *   (`ESPN_TOURNAMENT_RANGES`) — compat byte-a-byte, calendário fixo do torneio.
 * - **Com paginação (`needsPagination: true`, ligas + copas longas)**: 12 ranges
 *   MENSAIS cobrindo o ano da `season` (jan–dez), disjuntos e sem buraco. Uma
 *   liga de 38 rodadas tem ~10 jogos/mês → folga larga sob o cap de 100.
 * - **Sem paginação (torneios curtos)**: um único range do ano inteiro.
 *
 * O ano vem dos 4 primeiros dígitos de `season` (ex.: `"2026"` ou `"2026-27"`
 * → 2026). Janela ago–mai de temporada europeia NÃO é modelada aqui (o catálogo
 * ainda não guarda start/end); o ano-calendário cobre com margem — ver TASK-05.
 */
export function deriveRanges(
  championship: Pick<
    Championship,
    "espnSlug" | "season" | "needsPagination" | "legacyMatchId"
  >,
): readonly string[] {
  if (championship.legacyMatchId === true) {
    return ESPN_TOURNAMENT_RANGES;
  }

  // Só `YYYY` é suportado hoje. Temporada partida (`2025-26`, europeia ago–mai)
  // exige janela real (seasonStart/seasonEnd) — não dá para aproximar por
  // ano-calendário sem misturar duas temporadas. Falha ruidosa até TASK-05
  // adicionar esses campos ao catálogo (nunca derivar ano errado em silêncio).
  const m = championship.season.match(/^(\d{4})$/);
  if (!m) {
    throw new Error(
      `deriveRanges: season "${championship.season}" não suportada ` +
        `(${championship.espnSlug}). Só "YYYY" é aceito; temporadas partidas ` +
        `(ex.: "2025-26") exigem seasonStart/seasonEnd no catálogo — TASK-05.`,
    );
  }
  const year = Number(m[1]);

  if (!championship.needsPagination) {
    return [`${ymd(year, 1, 1)}-${ymd(year, 12, 31)}`];
  }

  const ranges: string[] = [];
  for (let m = 1; m <= 12; m++) {
    ranges.push(`${ymd(year, m, 1)}-${ymd(year, m, lastDayOfMonth(year, m))}`);
  }
  return ranges;
}

// ─── Implementação HTTP ─────────────────────────────────────────────────────

export class EspnScoreClient {
  private readonly timeoutMs: number;
  private readonly espnSlug: string;

  /**
   * @param espnSlug slug ESPN da competição (ex.: `"bra.1"`). Default
   *                 `"fifa.world"` — compat: chamadas atuais não mudam de destino.
   * @param timeoutMs timeout por chamada HTTP.
   */
  constructor(espnSlug: string = DEFAULT_ESPN_SLUG, timeoutMs = 10_000) {
    this.espnSlug = espnSlug;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Busca o scoreboard ESPN de um dia específico.
   * @param dateUtc dia alvo no formato `YYYYMMDD` (UTC), ex.: `"20260614"`.
   */
  async fetchScoreboard(dateUtc: string): Promise<EspnScoreboard> {
    return this.fetchByDates(dateUtc);
  }

  /**
   * Busca o schedule completo da Copa via múltiplas chamadas de range disjunto
   * (hard cap ESPN = 100 eventos/chamada; Copa tem 104 jogos — spike TASK-00).
   * As chamadas são paralelas (`Promise.all`) e o resultado é deduplicado por
   * `event.id`. NÃO absorve erros — qualquer falha de range propaga (a resiliência
   * com fallback openfootball fica no caller, TASK-05).
   *
   * @param ranges ranges no formato `"YYYYMMDD-YYYYMMDD"`. Default:
   *               `ESPN_TOURNAMENT_RANGES` (grupos + mata-mata).
   * @returns eventos deduplicados por `event.id`, na ordem dos `ranges`
   *          (`Promise.all` preserva a ordem dos argumentos; em colisão de id o
   *          range posterior vence).
   */
  async fetchSchedule(
    ranges: readonly string[] = ESPN_TOURNAMENT_RANGES,
  ): Promise<EspnEvent[]> {
    const perRange = await Promise.all(
      ranges.map((range) => this.fetchRange(range)),
    );

    const byId = new Map<string, EspnEvent>();
    for (const events of perRange) {
      for (const event of events) {
        byId.set(event.id, event);
      }
    }
    return [...byId.values()];
  }

  /**
   * Busca um range de datas e retorna apenas os eventos do scoreboard.
   * @throws EspnParseError se o range atingiu o cap ESPN (possível truncamento):
   *         falha ruidosa força um split mais fino em vez de perder jogos.
   */
  private async fetchRange(range: string): Promise<EspnEvent[]> {
    const scoreboard = await this.fetchByDates(range);
    if (scoreboard.events.length >= ESPN_EVENT_CAP) {
      throw new EspnParseError(
        `range ${range} atingiu o cap de ${ESPN_EVENT_CAP} eventos ` +
          `(${this.espnSlug}) — possível truncamento; requer split mais fino.`,
      );
    }
    return scoreboard.events;
  }

  /**
   * Núcleo HTTP compartilhado: abort → fetch → status → json → validação de shape.
   * @param dates valor do query param `?dates` — dia (`YYYYMMDD`) ou range
   *              (`YYYYMMDD-YYYYMMDD`); o endpoint aceita ambos.
   */
  private async fetchByDates(dates: string): Promise<EspnScoreboard> {
    const url = `${ESPN_SCOREBOARD_BASE}/${this.espnSlug}/scoreboard?dates=${dates}`;

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: REVALIDATE_LIVE },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new EspnTimeoutError(this.timeoutMs);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Erro de rede ao buscar scoreboard ESPN: ${message}`);
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

    const result = parseEspnScoreboard(body);
    if (!result.success) {
      throw new EspnParseError(result.error.message);
    }

    return result.data;
  }
}
