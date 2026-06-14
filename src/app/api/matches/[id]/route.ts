/**
 * GET /api/matches/[id] — uma partida pelo id estável.
 *
 * 404 quando não encontrada. Filtra a lista completa de matches mapeados.
 *
 * Fonte: `getEffectiveMatches` (openfootball + overrides manuais, PRD-11) — espelha
 * /api/matches. Sem o overlay, placares/status corrigidos pelo super_admin em
 * `matches/{id}` nunca chegariam ao detalhe do jogo (renderizava sempre o
 * openfootball cru, ignorando a edição manual).
 *
 * Cache (A5): 1h — alinhado com /api/matches. Invalidado pelo edit/delete admin
 * via revalidatePath.
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { getEffectiveMatches } from "@/server/copaData/matchSource";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const matches = await getEffectiveMatches();
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
