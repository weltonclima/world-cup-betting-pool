/**
 * GET /api/matches/[id] (TASK-04) — uma partida pelo id (= String(fixture.id)).
 *
 * 404 quando não encontrada. A API-Football não tem endpoint por jogo nesta
 * camada (é um único endpoint de fixtures), então filtramos a lista mapeada.
 *
 * Cache (A5): mesma base de /api/matches — `REVALIDATE.jogoAoVivo` (60s). Ver spec §5.
 */

import { NextResponse } from "next/server";

import { apiFootballErrorResponse } from "../../_lib/apiFootballError";
import { fetchAllMatches } from "../../_lib/apiFootballData";

// Literal estático obrigatório pelo Next.js (MemberExpression não é suportado).
// Valor: REVALIDATE.jogoAoVivo = 60s (1min).
export const revalidate = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const matches = await fetchAllMatches();
    const match = matches.find((m) => m.id === id);

    if (match === undefined) {
      return NextResponse.json(
        { error: "Partida não encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json(match);
  } catch (err) {
    return apiFootballErrorResponse(err);
  }
}
