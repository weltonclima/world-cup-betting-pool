/**
 * GET /api/matches — todas as partidas da Copa, mapeadas e validadas.
 *
 * Proxy + cache. Resposta: `MatchWithId[]` com id estável (slug para grupos,
 * m{num} para mata-mata). Dados via openfootball/worldcup.json (D-OF1).
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../_lib/copaDataError";
import { fetchAllMatches } from "@/server/copaData";

// Cache de segmento: 1h — dados mudam quando score.ft é populado.
export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  try {
    const matches = await fetchAllMatches();
    return NextResponse.json(matches);
  } catch (err) {
    return copaDataErrorResponse(err);
  }
}
