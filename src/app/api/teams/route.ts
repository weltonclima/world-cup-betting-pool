/**
 * GET /api/teams — todas as seleções participantes, mapeadas e validadas.
 *
 * Resposta: `TeamWithId[]` derivados dos matches de grupo do openfootball (D-OF1).
 *
 * Cache: 24h — composição de seleções é estática.
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../_lib/copaDataError";
import { fetchAllTeams } from "@/server/copaData";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 86400;

export async function GET(): Promise<NextResponse> {
  try {
    const teams = await fetchAllTeams();
    return NextResponse.json(teams);
  } catch (err) {
    return copaDataErrorResponse(err);
  }
}
