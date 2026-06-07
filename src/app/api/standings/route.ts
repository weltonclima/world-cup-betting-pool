/**
 * GET /api/standings — grupos derivados das seleções.
 *
 * O agrupamento por grupo é DERIVADO do campo `groupId` de cada seleção.
 * groupId vem de match.group do openfootball ("Group A" → "A").
 *
 * Resposta (StandingsResponse):
 *   {
 *     groups:    [{ groupId: "A", teams: TeamWithId[] }, ...]  // ordenado por groupId
 *     ungrouped: TeamWithId[]                                   // seleções sem grupo
 *   }
 *
 * Cache: 24h — composição dos grupos é estática.
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../_lib/copaDataError";
import { fetchAllTeams, type TeamWithId } from "@/server/copaData";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 86400;

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
    return copaDataErrorResponse(err);
  }
}
