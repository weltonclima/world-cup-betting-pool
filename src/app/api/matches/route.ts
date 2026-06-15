/**
 * GET /api/matches — todas as partidas da Copa, mapeadas e validadas.
 *
 * Proxy + cache. Resposta: `MatchWithId[]` com id estável (slug para grupos,
 * m{num} para mata-mata). Base via openfootball/worldcup.json (D-OF1), com
 * overlay das partidas persistidas/editadas manualmente (`getEffectiveMatches`,
 * PRD-11) — espelha bracket/groups. Sem o overlay, placares/status corrigidos
 * pelo super_admin em `matches/{id}` não chegariam à Home (último resultado /
 * desempenho ficavam vazios mesmo com dado no banco).
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../_lib/copaDataError";
import { getEffectiveMatches } from "@/server/copaData/matchSource";

// Cache de segmento: 5min — alinhado ao ciclo ESPN (fonte primária, PRD-13).
export const revalidate = 300;

export async function GET(): Promise<NextResponse> {
  try {
    const matches = await getEffectiveMatches();
    return NextResponse.json(matches);
  } catch (err) {
    return copaDataErrorResponse(err);
  }
}
