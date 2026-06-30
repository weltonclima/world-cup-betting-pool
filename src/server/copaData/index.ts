import "server-only";

/**
 * Barrel do módulo copaData.
 *
 * Fonte única de dados da Copa = ESPN (PRD-13). Expõe:
 *   - `fetchAllTeams()`: 48 seleções derivadas do `TEAM_REGISTRY` estático.
 *   - Pipeline ESPN (`EspnScoreClient`, `mapEspnEventsToMatches`, …).
 *   - Mapa de slots de bracket via core API (`fetchEspnBracketMap`, …).
 */

import { TEAM_REGISTRY } from "./teamRegistry";
import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";

// ─── Funções públicas ────────────────────────────────────────────────────────

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

export { REVALIDATE_MATCHES, REVALIDATE_TEAMS } from "./config";
export type { MatchWithId, TeamWithId };

// Pipeline ESPN como fonte única (PRD-13) — consumido por matchSource.
export { EspnScoreClient, ESPN_TOURNAMENT_RANGES } from "./espnClient";
export { mapEspnEventsToMatches, mapEspnEventToMatch } from "./espnMapper";
export type { EspnMatchPatch } from "./espnMapper";

// Mapa de slots de bracket via core API (TASK-07) — base das arestas (TASK-08).
export {
  fetchEspnBracketMap,
  fetchEspnMatchNumber,
  deriveSlotInRound,
} from "./espnBracketMap";
export type { EspnBracketMap, EspnBracketSlot } from "./espnBracketMap";
