/**
 * GET /api/matches?championship={id} — partidas de um campeonato, mapeadas e
 * validadas.
 *
 * Proxy + cache. Resposta: `MatchWithId[]` com id estável. Base ESPN por
 * campeonato + overlay das partidas persistidas/editadas manualmente
 * (`getEffectiveMatches(championshipId)`, TASK-05). Sem o overlay, placares/status
 * corrigidos pelo super_admin em `matches/{id}` não chegariam à Home.
 *
 * `?championship=` escopa a fonte (TASK-06). Ausente → default `fifa.world`
 * (compat byte-a-byte). Id fora do catálogo → `400` (input inválido, não `500`).
 * Ler o query param opta a rota para dinâmica; a deduplicação/TTL passa a residir
 * no data cache por-slug do `EspnScoreClient`.
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../_lib/copaDataError";
import {
  resolveChampionshipFromRequest,
  UnknownChampionshipError,
  unknownChampionshipResponse,
} from "../_lib/championshipParam";
import { getEffectiveMatches } from "@/server/copaData/matchSource";

// Cache de segmento: 1min — alinhado ao ciclo ESPN ao vivo (fonte primária, PRD-13).
export const revalidate = 60;

export async function GET(request: Request): Promise<NextResponse> {
  let championshipId: string;
  try {
    championshipId = resolveChampionshipFromRequest(request).id;
  } catch (err) {
    if (err instanceof UnknownChampionshipError) {
      return unknownChampionshipResponse();
    }
    throw err;
  }

  try {
    const matches = await getEffectiveMatches(championshipId);
    return NextResponse.json(matches);
  } catch (err) {
    return copaDataErrorResponse(err);
  }
}
