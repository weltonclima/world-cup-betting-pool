/**
 * Helpers de busca + mapeamento + validação compartilhados pelos Route Handlers
 * da API-Football (TASK-04). Mantém a lógica de montar teamIdMap/teamGroupMap em
 * um único lugar (consumido por /api/matches e /api/matches/[id]).
 *
 * Como teams NÃO são persistidos no Firestore, o id do doc = `String(team.id)`
 * da API (matches idem: id = `String(fixture.id)`).
 */

import { getApiFootballClient, COPA_2026_CONFIG } from "@/server/apiFootball";
import type { TeamResponse } from "@/server/apiFootball";
import { mapApiFixtureToFirestore } from "@/server/mappers/matchMapper";
import {
  mapApiTeamToFirestore,
  type MappedTeam,
} from "@/server/mappers/teamMapper";
import type { MatchWithId } from "@/types/matches";

/** Seleção com o id do doc (= String(team.id) da API) injetado. */
export type TeamWithId = MappedTeam & { id: string };

/** Constrói os mapas API id → doc id e API id → grupo a partir da resposta de teams. */
function buildTeamMaps(teamsRaw: TeamResponse[]): {
  teamIdMap: Record<number, string>;
  teamGroupMap: Record<number, string | undefined>;
} {
  const teamIdMap: Record<number, string> = {};
  const teamGroupMap: Record<number, string | undefined> = {};
  for (const t of teamsRaw) {
    teamIdMap[t.team.id] = String(t.team.id);
    teamGroupMap[t.team.id] = t.group;
  }
  return { teamIdMap, teamGroupMap };
}

/**
 * Busca fixtures + teams, mapeia e valida cada partida, devolvendo `MatchWithId[]`.
 * O `id` de cada partida é `String(fixture.id)` (matches não são persistidos).
 */
export async function fetchAllMatches(): Promise<MatchWithId[]> {
  const client = getApiFootballClient();
  const { leagueId, season } = COPA_2026_CONFIG;

  // Teams primeiro: necessário para resolver homeTeamId/awayTeamId/groupId.
  const teamsRaw = await client.getTeamsByTournament(leagueId, season);
  const fixturesRaw = await client.getFixtures(leagueId, season);

  const { teamIdMap, teamGroupMap } = buildTeamMaps(teamsRaw);

  return fixturesRaw.map((raw) => {
    // mapApiFixtureToFirestore já valida com matchSchema (.parse) internamente;
    // não re-parsear aqui (seria validação duplicada). Só injeta o id.
    const match = mapApiFixtureToFirestore(raw, teamIdMap, teamGroupMap);
    return { id: String(raw.fixture.id), ...match };
  });
}

/** Busca + mapeia + valida todas as seleções, devolvendo `TeamWithId[]`. */
export async function fetchAllTeams(): Promise<TeamWithId[]> {
  const client = getApiFootballClient();
  const { leagueId, season } = COPA_2026_CONFIG;

  const teamsRaw = await client.getTeamsByTournament(leagueId, season);

  return teamsRaw.map((raw) => {
    // mapApiTeamToFirestore já valida com teamSchema (.parse) internamente;
    // não re-parsear aqui (seria validação duplicada). Só injeta o id.
    const team = mapApiTeamToFirestore(raw);
    return { id: String(raw.team.id), ...team };
  });
}
