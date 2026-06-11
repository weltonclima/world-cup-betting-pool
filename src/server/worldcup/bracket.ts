/**
 * Derivação do chaveamento eliminatório da Copa.
 *
 * Função pura — sem I/O, sem Date.now, determinística. Espelha o precedente de
 * `standings.ts` (módulo puro NÃO carrega `import "server-only"`).
 *
 * Regras de agrupamento/ordenação (ver spec grupos-eliminatorias-task-03, §6):
 *  1. Somente stage !== "grupos". Mapa de buckets:
 *     dezesseis-avos→roundOf32, oitavas→roundOf16, quartas→quarterFinals,
 *     semifinal→semiFinals, terceiro→thirdPlace, final→final.
 *  2. Ordenação por número extraído do id ("m73"→73) asc; ids sem padrão m\d+
 *     ficam ao final (estável, defensivo).
 *  3. Resolução de lado (KnockoutSide) com rótulos pt-BR para placeholders e
 *     fallback defensivo para ids corrompidos.
 *  4. Status: ambos defined + finished→encerrado; ambos defined→definido;
 *     qualquer não-defined→aguardando.
 *  5. Placares somente em "encerrado".
 */

import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";
import type { KnockoutMatch, KnockoutSide } from "@/types/worldcup";

// ─── Tipo público exportado ───────────────────────────────────────────────────

/**
 * Payload completo do chaveamento eliminatório.
 * Validável por `bracketResponseSchema.parse`.
 */
export interface BracketPayload {
  roundOf32: KnockoutMatch[];
  roundOf16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  thirdPlace: KnockoutMatch[];
  final: KnockoutMatch[];
}

// ─── Mapa de stage → bucket ───────────────────────────────────────────────────

/** Chave de bucket dentro de BracketPayload. */
type BucketKey = keyof BracketPayload;

/** Mapa de slug de stage para a chave do bucket correspondente. */
const STAGE_TO_BUCKET: Partial<Record<string, BucketKey>> = {
  "dezesseis-avos": "roundOf32",
  oitavas:          "roundOf16",
  quartas:          "quarterFinals",
  semifinal:        "semiFinals",
  terceiro:         "thirdPlace",
  final:            "final",
};

// ─── Ordenação por número do id ───────────────────────────────────────────────

/** Regex para extrair número de ids no padrão "m{num}" (ex.: "m73" → 73). */
const MATCH_ID_REGEX = /^m(\d+)$/;

/**
 * Extrai o número de ordenação de um id de partida.
 * Ids sem padrão m\d+ retornam Infinity (ficam ao final).
 */
function matchNum(id: string): number {
  const m = MATCH_ID_REGEX.exec(id);
  return m ? parseInt(m[1]!, 10) : Infinity;
}

/** Comparador estável por número do id. */
function byMatchNum(a: KnockoutMatch, b: KnockoutMatch): number {
  return matchNum(a.id) - matchNum(b.id);
}

// ─── Resolução de lado (placeholder → rótulo pt-BR) ──────────────────────────

/**
 * Regex de reconhecimento de placeholders do openfootball.
 * Espelha o padrão em `src/server/copaData/mapper.ts:resolveTeamId`.
 */
const PLACEHOLDER_REGEX = /^(\d[A-Z]+(\/[A-Z]+)*|[WL]\d+)$/;

/**
 * Regex para 1º colocado de grupo: "1A".."1L".
 * Captura a letra do grupo.
 */
const PRIMEIRO_GRUPO_REGEX = /^1([A-L])$/;

/**
 * Regex para 2º colocado de grupo: "2A".."2L".
 * Captura a letra do grupo.
 */
const SEGUNDO_GRUPO_REGEX = /^2([A-L])$/;

/**
 * Regex para melhor terceiro: "3A/B/C/D/F" etc.
 * Captura a lista de grupos (ex.: "A/B/C/D/F").
 */
const TERCEIRO_GRUPO_REGEX = /^3([A-Z](\/[A-Z])+)$/;

/**
 * Regex para vencedor de jogo: "W74" etc.
 * Captura o número do jogo.
 */
const VENCEDOR_JOGO_REGEX = /^W(\d+)$/;

/**
 * Regex para perdedor de jogo: "L101" etc.
 * Captura o número do jogo.
 */
const PERDEDOR_JOGO_REGEX = /^L(\d+)$/;

/**
 * Converte um teamId placeholder para o rótulo pt-BR correspondente.
 * Retorna null se o teamId não for um placeholder reconhecido.
 */
function placeholderLabel(teamId: string): string | null {
  let m: RegExpExecArray | null;

  // "1A" → "1º do Grupo A"
  m = PRIMEIRO_GRUPO_REGEX.exec(teamId);
  if (m) return `1º do Grupo ${m[1]!}`;

  // "2L" → "2º do Grupo L"
  m = SEGUNDO_GRUPO_REGEX.exec(teamId);
  if (m) return `2º do Grupo ${m[1]!}`;

  // "3A/B/C/D/F" → "3º do Grupo A/B/C/D/F"
  m = TERCEIRO_GRUPO_REGEX.exec(teamId);
  if (m) return `3º do Grupo ${m[1]!}`;

  // "W74" → "Vencedor Jogo 74"
  m = VENCEDOR_JOGO_REGEX.exec(teamId);
  if (m) return `Vencedor Jogo ${m[1]!}`;

  // "L101" → "Perdedor Jogo 101"
  m = PERDEDOR_JOGO_REGEX.exec(teamId);
  if (m) return `Perdedor Jogo ${m[1]!}`;

  return null;
}

/**
 * Resolve um teamId para um KnockoutSide.
 *
 * Precedência:
 *  1. Time encontrado no índice → lado real (defined:true).
 *  2. Placeholder reconhecido → rótulo pt-BR (defined:false).
 *  3. Corrompido → name = raw id (defined:false, nunca lança).
 */
function resolveSide(teamId: string, teamIndex: Map<string, TeamWithId>): KnockoutSide {
  // 1) Time real encontrado no índice.
  const team = teamIndex.get(teamId);
  if (team !== undefined) {
    return {
      name: team.name,
      code: team.code,
      // Spread condicional: omite a chave quando flagUrl está ausente.
      ...(team.flagUrl !== undefined ? { flagUrl: team.flagUrl } : {}),
      defined: true,
    };
  }

  // 2) Placeholder: verificar se é reconhecido e gerar rótulo pt-BR.
  const isPlaceholder = PLACEHOLDER_REGEX.test(teamId);
  if (isPlaceholder) {
    const label = placeholderLabel(teamId);
    if (label !== null) {
      return { name: label, defined: false };
    }
    // Placeholder reconhecido pela regex genérica mas sem rótulo específico.
    // (defensivo — não deve ocorrer com a regex alinhada às do mapper)
    return { name: teamId, defined: false };
  }

  // 3) Corrompido — não-placeholder, fora do índice.
  return { name: teamId, defined: false };
}

// ─── Derivação de status e placares ──────────────────────────────────────────

/**
 * Deriva o status e os placares (opcionais) de um KnockoutMatch.
 * Regras (spec §6, regras 4–5):
 *  - Qualquer lado não-defined → "aguardando" (sem placares).
 *  - Ambos defined + finished  → "encerrado"  (com placares).
 *  - Ambos defined + demais    → "definido"   (sem placares).
 */
function deriveStatus(
  homeSide: KnockoutSide,
  awaySide: KnockoutSide,
  match: MatchWithId,
): Pick<KnockoutMatch, "status" | "homeScore" | "awayScore"> {
  // Qualquer lado indefinido → aguardando (placares omitidos).
  if (!homeSide.defined || !awaySide.defined) {
    return { status: "aguardando" };
  }

  // Ambos defined + finished → encerrado com placares.
  if (match.status === "finished") {
    return {
      status: "encerrado",
      homeScore: match.homeScore!,
      awayScore: match.awayScore!,
    };
  }

  // Ambos defined + não finished → definido (sem placares).
  return { status: "definido" };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Deriva o chaveamento eliminatório a partir das partidas e seleções.
 *
 * @param matches partidas (qualquer fase — filtradas internamente para não-grupos)
 * @param teams   seleções do torneio (usadas para resolver nomes/bandeiras)
 * @returns       BracketPayload com 6 buckets, cada um ordenado por num do id asc
 */
export function deriveBracket(
  matches: MatchWithId[],
  teams: TeamWithId[],
): BracketPayload {
  // Índice id→TeamWithId para lookup O(1).
  const teamIndex = new Map<string, TeamWithId>(teams.map((t) => [t.id, t]));

  // Inicializa todos os 6 buckets vazios.
  const payload: BracketPayload = {
    roundOf32:     [],
    roundOf16:     [],
    quarterFinals: [],
    semiFinals:    [],
    thirdPlace:    [],
    final:         [],
  };

  for (const match of matches) {
    // Regra 1: somente stage !== "grupos".
    const bucketKey = STAGE_TO_BUCKET[match.stage];
    if (bucketKey === undefined) continue;

    // Resolução dos lados.
    const homeSide = resolveSide(match.homeTeamId, teamIndex);
    const awaySide = resolveSide(match.awayTeamId, teamIndex);

    // Status e placares.
    const statusFields = deriveStatus(homeSide, awaySide, match);

    // Monta o KnockoutMatch.
    const km: KnockoutMatch = {
      id:       match.id,
      phase:    match.stage as KnockoutMatch["phase"],
      homeTeam: homeSide,
      awayTeam: awaySide,
      ...statusFields,
    };

    payload[bucketKey].push(km);
  }

  // Regra 2: ordena cada bucket por número do id asc (ids sem padrão → Infinity → ao final).
  for (const key of Object.keys(payload) as BucketKey[]) {
    payload[key].sort(byMatchNum);
  }

  return payload;
}
