/**
 * GET /api/matches/[id] — uma partida pelo id estável.
 *
 * 404 quando não encontrada. Filtra a lista completa de matches mapeados.
 *
 * Cache (A5): 1h — alinhado com /api/matches.
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { fetchAllMatches } from "@/server/copaData";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 3600;

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
    return copaDataErrorResponse(err);
  }
}
