/**
 * GET /api/matches (TASK-04) — todas as partidas da Copa, mapeadas e validadas.
 *
 * Proxy + cache + validação da API-Football. Resposta: `MatchWithId[]` com
 * `id = String(fixture.id)` (matches não são persistidos no Firestore).
 *
 * Cache (A5): base `REVALIDATE.jogoAoVivo` (60s) — endpoint único; granularidade
 * fina por status fica no client (React Query staleTime, TASK-06). Ver spec §5.
 */

import { NextResponse } from "next/server";

import { REVALIDATE } from "@/server/cache/tiers";

import { apiFootballErrorResponse } from "../_lib/apiFootballError";
import { fetchAllMatches } from "../_lib/apiFootballData";

// Cache de segmento (A5): teto fresco único; client segmenta por tier.
export const revalidate = REVALIDATE.jogoAoVivo;

export async function GET(): Promise<NextResponse> {
  try {
    const matches = await fetchAllMatches();
    return NextResponse.json(matches);
  } catch (err) {
    return apiFootballErrorResponse(err);
  }
}
