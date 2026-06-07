/**
 * GET /api/standings (TASK-04, A1) — grupos derivados das seleções.
 *
 * A API-Football não tem (nesta camada) um endpoint dedicado de standings; o
 * agrupamento por grupo é DERIVADO do campo `groupId` de cada seleção (A1).
 *
 * Resposta (StandingsResponse):
 *   {
 *     groups:    [{ groupId: "A", teams: TeamWithId[] }, ...]  // ordenado por groupId
 *     ungrouped: TeamWithId[]                                   // seleções sem grupo
 *   }
 *
 * Cache (A5): `REVALIDATE.grupos` (24h) — composição dos grupos é estática.
 */

import { NextResponse } from "next/server";

import { REVALIDATE } from "@/server/cache/tiers";

import { apiFootballErrorResponse } from "../_lib/apiFootballError";
import { fetchAllTeams, type TeamWithId } from "../_lib/apiFootballData";

export const revalidate = REVALIDATE.grupos;

interface GroupStanding {
  groupId: string;
  teams: TeamWithId[];
}

interface StandingsResponse {
  groups: GroupStanding[];
  ungrouped: TeamWithId[];
}

export async function GET(): Promise<NextResponse> {
  try {
    const teams = await fetchAllTeams();

    const byGroup = new Map<string, TeamWithId[]>();
    const ungrouped: TeamWithId[] = [];

    for (const team of teams) {
      if (team.groupId === undefined) {
        ungrouped.push(team);
        continue;
      }
      const bucket = byGroup.get(team.groupId);
      if (bucket === undefined) {
        byGroup.set(team.groupId, [team]);
      } else {
        bucket.push(team);
      }
    }

    const groups: GroupStanding[] = Array.from(byGroup.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupId, groupTeams]) => ({
        groupId,
        teams: [...groupTeams].sort((a, b) => a.name.localeCompare(b.name)),
      }));

    ungrouped.sort((a, b) => a.name.localeCompare(b.name));

    const body: StandingsResponse = { groups, ungrouped };
    return NextResponse.json(body);
  } catch (err) {
    return apiFootballErrorResponse(err);
  }
}
