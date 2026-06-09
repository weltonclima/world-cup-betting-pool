/**
 * Mapper de partida: ApiFootball FixtureResponse → documento `matches/{id}` (matchSchema).
 * Função pura — sem side effects, sem imports do Firebase, sem I/O.
 *
 * Fonte única de verdade dos tipos/validação: `@/schemas` (matchSchema é `.strict()`).
 * Output validado por matchSchema, incluindo o refinement placar × status.
 */

import type { z } from "zod";
import { matchSchema, stageSchema, matchStatusSchema } from "@/schemas";
import type { FixtureResponse } from "@/server/apiFootball/types";

export type MappedMatch = z.infer<typeof matchSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;

// ─── Mapeamento de round → stage (config-driven) ───────────────────────────────

/**
 * Mapa de prefixos/valores exatos de league.round da API-Football para os
 * valores do stageSchema. Extensível sem alterar a lógica do mapper.
 */
const ROUND_TO_STAGE_MAP: Record<string, Stage> = {
  "Group Stage": "grupos",
  "Round of 32": "dezesseis-avos", // Copa 2026: 16 avos de final
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
};

/**
 * Converte o valor de league.round da API-Football para o Stage do stageSchema.
 * Round de fase de grupos pode ter sufixo numérico (ex.: "Group Stage - 1").
 *
 * @param round - Valor de league.round da API-Football
 * @throws Error se o round não for reconhecido
 */
export function mapRoundToStage(round: string): Stage {
  // Verificação exata primeiro
  if (round in ROUND_TO_STAGE_MAP) {
    const stage = ROUND_TO_STAGE_MAP[round];
    if (stage !== undefined) return stage;
  }

  // Verificação por prefixo (ex.: "Group Stage - 1" começa com "Group Stage")
  for (const [prefix, stage] of Object.entries(ROUND_TO_STAGE_MAP)) {
    if (round.startsWith(prefix)) {
      return stage;
    }
  }

  throw new Error(
    `Round não reconhecido pela API-Football: "${round}". ` +
      `Adicionar mapeamento em ROUND_TO_STAGE_MAP em matchMapper.ts.`,
  );
}

/**
 * Extrai o número da rodada de um round da fase de grupos.
 * Só faz sentido na fase de grupos ("Group Stage - 2" → 2). Em fases de
 * mata-mata não há rodada (e textos como "Round of 16" contêm dígitos que
 * NÃO são número de rodada) → retorna null.
 *
 * @param round - Valor de league.round da API-Football
 * @param stage - Stage já resolvido (decide se há rodada)
 * @returns número da rodada (int ≥ 1) ou null
 */
export function mapRoundNumber(round: string, stage: Stage): number | null {
  if (stage !== "grupos") return null;
  const matches = round.match(/\d+/g);
  if (matches === null || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  if (last === undefined) return null;
  const n = Number.parseInt(last, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// ─── Mapeamento de status da API-Football → MatchStatus ───────────────────────

/**
 * Status curtos da API-Football → matchStatusSchema do projeto.
 * NS/TBD=Not Started; 1H/HT/2H/ET/P/BT/LIVE=em andamento;
 * FT/AET/PEN/AWD/WO=finalizado; PST=adiado; CANC/SUSP/INT/ABD=cancelado.
 */
const STATUS_MAP: Record<string, MatchStatus> = {
  NS: "scheduled",
  TBD: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  P: "live",
  BT: "live",
  LIVE: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  AWD: "finished",
  WO: "finished",
  PST: "postponed",
  CANC: "canceled",
  SUSP: "canceled",
  INT: "canceled",
  ABD: "canceled",
};

/**
 * Converte fixture.status.short para o MatchStatus do projeto.
 * Status desconhecido → warning observável + fallback "scheduled".
 */
export function mapApiStatusToMatchStatus(short: string): MatchStatus {
  const status = STATUS_MAP[short];
  if (status !== undefined) return status;
  console.warn(
    `[matchMapper] Status desconhecido da API-Football: "${short}". Usando "scheduled" como fallback. ` +
      `Adicionar mapeamento em STATUS_MAP em matchMapper.ts se necessário.`,
  );
  return "scheduled";
}

// ─── Normalização de data ──────────────────────────────────────────────────────

/**
 * Normaliza a data da API-Football para ISO 8601 UTC canônico com sufixo `Z`.
 *
 * A API pode entregar `fixture.date` com offset numérico (`+00:00`, `-03:00`).
 * Sem normalizar, a ordenação lexicográfica por string (camada de serviço) deixa
 * de ser cronológica quando há offsets heterogêneos. Convertendo tudo para `Z`
 * via `Date.toISOString()`, garantimos `kickoffAt` canônico e ordenável por string.
 *
 * @param raw - Valor de `fixture.date` da API-Football
 * @returns String ISO 8601 UTC com sufixo `Z` (ex.: "2026-06-11T15:00:00.000Z")
 * @throws Error se a data for inválida/não parseável
 */
export function normalizeKickoffAt(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Data de partida inválida recebida da API-Football: "${raw}".`,
    );
  }
  return date.toISOString();
}

// ─── Mapeamento de venue ───────────────────────────────────────────────────────

/**
 * Converte fixture.venue da API no shape `{ name, city }` do matchSchema.
 * Só monta o objeto quando name E city são strings não vazias; caso contrário
 * (TBD, campos null/vazios, venue ausente) retorna null — evita violar o
 * `.strict()` do venueSchema (que rejeita strings vazias).
 */
function mapVenue(
  venue: FixtureResponse["fixture"]["venue"],
): { name: string; city: string } | null {
  if (venue === undefined || venue === null) return null;
  const name = venue.name?.trim();
  const city = venue.city?.trim();
  if (!name || !city) return null;
  return { name, city };
}

// ─── Mapper principal ──────────────────────────────────────────────────────────

/**
 * Converte uma FixtureResponse no shape do documento `matches/{id}`.
 *
 * @param raw - Resposta da API-Football para uma partida
 * @param teamIdMap - API id → ID do documento Firestore (teams/{id})
 * @param teamGroupMap - API id → grupo (origem: /standings; A1). Opcional;
 *   sem ele, jogos de grupo ficam groupId null (degradação graciosa).
 * @returns Documento validado por matchSchema
 * @throws Error se homeTeamId/awayTeamId não estiverem no teamIdMap
 * @throws Error se o round não for reconhecido
 * @throws Error se a data da partida (fixture.date) for inválida
 * @throws ZodError se o output não satisfizer matchSchema
 */
export function mapApiFixtureToFirestore(
  raw: FixtureResponse,
  teamIdMap: Record<number, string>,
  teamGroupMap: Record<number, string | undefined> = {},
): MappedMatch {
  const homeApiId = raw.teams.home.id;
  const awayApiId = raw.teams.away.id;

  const homeTeamId = teamIdMap[homeApiId];
  if (homeTeamId === undefined) {
    throw new Error(
      `Time mandante com API id ${homeApiId} não encontrado no teamIdMap.`,
    );
  }

  const awayTeamId = teamIdMap[awayApiId];
  if (awayTeamId === undefined) {
    throw new Error(
      `Time visitante com API id ${awayApiId} não encontrado no teamIdMap.`,
    );
  }

  const status = mapApiStatusToMatchStatus(raw.fixture.status.short);
  const stage = mapRoundToStage(raw.league.round);
  const round = mapRoundNumber(raw.league.round, stage);
  const venue = mapVenue(raw.fixture.venue);

  // groupId: derivado do grupo do mandante, apenas na fase de grupos.
  const groupId =
    stage === "grupos" ? (teamGroupMap[homeApiId] ?? null) : null;

  // Regra de negócio: placares só são gravados quando a partida está finalizada.
  const isFinished = status === "finished";
  const homeScore = isFinished ? (raw.goals.home ?? null) : null;
  const awayScore = isFinished ? (raw.goals.away ?? null) : null;

  const doc = {
    homeTeamId,
    awayTeamId,
    kickoffAt: normalizeKickoffAt(raw.fixture.date),
    stage,
    round,
    groupId,
    venue,
    status,
    homeScore,
    awayScore,
  };

  // parse com Zod valida o output contra matchSchema (.strict() + refinement placar×status)
  return matchSchema.parse(doc);
}
