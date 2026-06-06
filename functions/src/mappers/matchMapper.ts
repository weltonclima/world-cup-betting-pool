/**
 * Mapper de partida: ApiFootball FixtureResponse → documento Firestore (matchSchema).
 * Função pura — sem side effects, sem imports do Firebase, sem I/O.
 * Output validado por matchSchema para garantir integridade dos dados no Firestore.
 */

import type { z } from "zod";
import { matchSchema, stageSchema, matchStatusSchema } from "../shared/schemas";
import type { FixtureResponse } from "../apiFootball/client";

export type MappedMatch = z.infer<typeof matchSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;

// ─── Mapeamento de round → stage (config-driven) ───────────────────────────────

/**
 * Mapa de prefixos/valores exatos de league.round da API-Football para os
 * valores do stageSchema do projeto. Extensível sem alterar a lógica do mapper.
 */
const ROUND_TO_STAGE_MAP: Record<string, Stage> = {
  "Group Stage": "grupos",
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "Final": "final",
};

/**
 * Converte o valor de league.round da API-Football para o Stage do stageSchema.
 * Round de fase de grupos pode ter sufixo numérico (ex.: "Group Stage - 1").
 *
 * @param round - Valor de league.round da API-Football
 * @returns Stage correspondente
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

// ─── Mapeamento de status da API-Football → MatchStatus ───────────────────────

/**
 * Converte o status curto da API-Football (fixture.status.short) para o
 * matchStatusSchema do projeto.
 *
 * Referência dos status API-Football:
 * NS  = Not Started
 * 1H  = First Half
 * HT  = Halftime
 * 2H  = Second Half
 * ET  = Extra Time
 * P   = Penalty In Progress
 * FT  = Match Finished
 * AET = Match Finished After Extra Time
 * PEN = Match Finished After Penalty
 * PST = Match Postponed
 * CANC = Match Cancelled
 * SUSP = Match Suspended
 * INT  = Match Interrupted
 * ABD  = Match Abandoned
 * AWD  = Technical Loss
 * WO   = WalkOver
 * LIVE = In Progress
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
 * Converte o status curto da API-Football para o MatchStatus do projeto.
 *
 * @param short - Valor de fixture.status.short da API-Football
 * @returns MatchStatus correspondente (fallback para "scheduled" se desconhecido)
 */
export function mapApiStatusToMatchStatus(short: string): MatchStatus {
  const status = STATUS_MAP[short];
  if (status !== undefined) return status;
  // WR-03: status desconhecido — logar warning para tornar o problema observável em produção
  // sem interromper o pipeline (status é menos crítico que stage; mantemos fallback seguro).
  console.warn(
    `[matchMapper] Status desconhecido da API-Football: "${short}". Usando "scheduled" como fallback. ` +
      `Adicionar mapeamento em STATUS_MAP em matchMapper.ts se necessário.`,
  );
  return "scheduled";
}

// ─── Mapper principal ──────────────────────────────────────────────────────────

/**
 * Converte uma FixtureResponse da API-Football no shape do documento `matches/{id}` no Firestore.
 *
 * @param raw - Resposta da API-Football para uma partida
 * @param teamIdMap - Mapa de ID numérico da API-Football → ID do documento Firestore (teams/{id})
 * @returns Documento Firestore validado pelo matchSchema
 * @throws Error se homeTeamId ou awayTeamId não forem encontrados no teamIdMap
 * @throws Error se o round não for reconhecido
 * @throws ZodError se o output não satisfizer matchSchema
 */
export function mapApiFixtureToFirestore(
  raw: FixtureResponse,
  teamIdMap: Record<number, string>,
): MappedMatch {
  const homeApiId = raw.teams.home.id;
  const awayApiId = raw.teams.away.id;

  const homeTeamId = teamIdMap[homeApiId];
  if (homeTeamId === undefined) {
    throw new Error(
      `Time mandante com API id ${homeApiId} não encontrado no teamIdMap. ` +
        `Execute syncTeams antes de sincronizar partidas.`,
    );
  }

  const awayTeamId = teamIdMap[awayApiId];
  if (awayTeamId === undefined) {
    throw new Error(
      `Time visitante com API id ${awayApiId} não encontrado no teamIdMap. ` +
        `Execute syncTeams antes de sincronizar partidas.`,
    );
  }

  const status = mapApiStatusToMatchStatus(raw.fixture.status.short);
  const stage = mapRoundToStage(raw.league.round);

  // Regra de negócio: placares só são gravados quando a partida está finalizada
  const isFinished = status === "finished";
  const homeScore = isFinished ? (raw.goals.home ?? null) : null;
  const awayScore = isFinished ? (raw.goals.away ?? null) : null;

  const doc = {
    homeTeamId,
    awayTeamId,
    kickoffAt: raw.fixture.date,
    stage,
    status,
    homeScore,
    awayScore,
  };

  // parse com Zod valida o output contra matchSchema (incl. refinement placar×status)
  return matchSchema.parse(doc);
}
