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
import { resolveTeam } from "./teamRegistry";
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
 * Deriva as seleções participantes a partir dos matches de grupo
 * (times reais, excluindo placeholders de mata-mata).
 * groupId vem do campo `group` do match de grupo ("Group A" → "A").
 */
export async function fetchAllTeams(): Promise<TeamWithId[]> {
  const client = getCopaDataClient();
  const data = await client.getData();

  const seen = new Set<string>();
  const teams: TeamWithId[] = [];

  for (const match of data.matches) {
    if (!match.group) continue; // só jogos de grupo têm times reais com nome

    const groupId = match.group.replace(/^Group\s+/i, "").trim();

    for (const teamName of [match.team1, match.team2]) {
      const entry = resolveTeam(teamName);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      teams.push({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        flagUrl: entry.flagUrl,
        groupId,
      });
    }
  }

  return teams;
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

// Pipeline ESPN live scores (PRD-12) — consumido pelo merge em matchSource.
export { EspnScoreClient } from "./espnClient";
export { buildEspnPatchMap } from "./espnMatcher";
export type { EspnMatchPatch } from "./espnMapper";
