/**
 * GET /api/matches/[id]?championship={id} — uma partida pelo id estável.
 *
 * 404 quando não encontrada no campeonato pedido. Filtra a lista efetiva daquele
 * campeonato.
 *
 * Fonte: `getEffectiveMatches(championshipId)` (ESPN + overrides manuais, TASK-05)
 * — espelha /api/matches. `?championship=` escopa a fonte (TASK-06); ausente →
 * default `fifa.world`; id fora do catálogo → `400`.
 *
 * Cache (A5): 1h — alinhado com /api/matches. Ler o query param opta a rota para
 * dinâmica (dedup/TTL no data cache por-slug do `EspnScoreClient`).
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "../../_lib/copaDataError";
import {
  resolveChampionshipFromRequest,
  UnknownChampionshipError,
  unknownChampionshipResponse,
} from "../../_lib/championshipParam";
import { getEffectiveMatches } from "@/server/copaData/matchSource";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 3600;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  // Id namespaced de liga (`{championshipId}:{espnId}`) traz ':' — Next/Turbopack
  // normaliza o ':' para `%3A` em `params.id` (e o cliente encoda 1× no fetch), então
  // o param chega percent-encodado. Decodifica p/ casar com o id efetivo CRU (senão
  // 404 no detalhe de jogo de liga). Match ids não contêm '%' → decode é idempotente;
  // guarda contra sequência malformada caindo no valor cru.
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = rawId;
  }

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
