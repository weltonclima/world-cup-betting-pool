import "server-only";

/**
 * Barrel do módulo copaData.
 *
 * Expõe a API pública de dados da Copa (fonte: openfootball/worldcup.json):
 *   fetchAllMatches(): Promise<MatchWithId[]>
 *   fetchAllTeams():   Promise<TeamWithId[]>
 */

import { HttpCopaDataClient } from "./client";
import { COPA_DATA_URL } from "./config";
import { mapOpenFootballMatch } from "./mapper";
import { TEAM_REGISTRY } from "./teamRegistry";
import type { CopaDataClient } from "./client";
import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";

// ─── Factory ────────────────────────────────────────────────────────────────

function getCopaDataClient(): CopaDataClient {
  return new HttpCopaDataClient(COPA_DATA_URL);
}

// ─── Funções públicas ────────────────────────────────────────────────────────

/**
 * Busca todos os matches da Copa 2026 via openfootball, mapeia para MatchWithId[].
 * Retorna grupos + mata-mata (104 matches quando o torneio estiver completo).
 */
export async function fetchAllMatches(): Promise<MatchWithId[]> {
  const client = getCopaDataClient();
  const data = await client.getData();
  return data.matches.map(mapOpenFootballMatch);
}

/**
 * Deriva as 48 seleções participantes do `TEAM_REGISTRY` estático (PRD-13).
 *
 * Sem HTTP: o registry já tem todos os times reais com `groupId` embarcado
 * ("A".."L"). Async só por interface (rota consome com React Query). Placeholders
 * de mata-mata nunca aparecem — o registry só contém seleções reais.
 */
export async function fetchAllTeams(): Promise<TeamWithId[]> {
  return Object.values(TEAM_REGISTRY).map((entry) => ({
    id: entry.id,
    name: entry.name,
    code: entry.code,
    flagUrl: entry.flagUrl,
    groupId: entry.groupId,
  }));
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  CopaDataTimeoutError,
  CopaDataFetchError,
  CopaDataParseError,
} from "./client";
export type { CopaDataClient } from "./client";
export { COPA_DATA_URL, REVALIDATE_MATCHES, REVALIDATE_TEAMS } from "./config";
export type { MatchWithId, TeamWithId };

// Pipeline ESPN como fonte primária (PRD-13) — consumido por matchSource.
export { EspnScoreClient, ESPN_TOURNAMENT_RANGES } from "./espnClient";
export { mapEspnEventsToMatches, mapEspnEventToMatch } from "./espnMapper";
export type { EspnMatchPatch } from "./espnMapper";
