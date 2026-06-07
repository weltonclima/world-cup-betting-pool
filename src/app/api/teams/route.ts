/**
 * GET /api/teams (TASK-04) — todas as seleções participantes, mapeadas e validadas.
 *
 * Resposta: `TeamWithId[]` com `id = String(team.id)` (teams não são persistidos).
 *
 * Cache (A5): `REVALIDATE.selecoes` (24h) — composição de seleções é estática.
 */

import { NextResponse } from "next/server";

import { REVALIDATE } from "@/server/cache/tiers";

import { apiFootballErrorResponse } from "../_lib/apiFootballError";
import { fetchAllTeams } from "../_lib/apiFootballData";

export const revalidate = REVALIDATE.selecoes;

export async function GET(): Promise<NextResponse> {
  try {
    const teams = await fetchAllTeams();
    return NextResponse.json(teams);
  } catch (err) {
    return apiFootballErrorResponse(err);
  }
}
