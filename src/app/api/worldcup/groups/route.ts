/**
 * GET /api/worldcup/groups — classificação da fase de grupos com cache Firestore.
 *
 * Fluxo read-through (spec §6):
 *  1. Lê snapshot do Firestore; se fresco → retorna payload cacheado.
 *  2. Cache stale/ausente → busca matches + teams, computa, grava best-effort.
 *  3. Falha no fetch + snapshot presente (mesmo stale) → retorna stale (resiliência).
 *  4. Falha no fetch + sem snapshot → copaDataErrorResponse (502/504/500).
 *
 * Resposta: GroupsResponse = { groups: GroupTable[], hasLiveGroupMatch: boolean }
 */

import { NextResponse } from "next/server";

import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { fetchAllMatches, fetchAllTeams } from "@/server/copaData";
import { isFresh, readSnapshot, writeSnapshot } from "@/server/worldcup/cache";
import { computeGroupStandings } from "@/server/worldcup/standings";
import type { GroupsResponse } from "@/types/worldcup";

// Força modo dinâmico — sem ISR; cache gerenciado pelo helper Firestore.
export const dynamic = "force-dynamic";

/**
 * Monta o header Cache-Control conforme presença de jogo ao vivo.
 *
 * @param hasLive `true` quando há partida ao vivo na fase de grupos.
 */
function cacheControl(hasLive: boolean): Record<string, string> {
  const ttl = hasLive ? 60 : 86400;
  return { "Cache-Control": `s-maxage=${ttl}, stale-while-revalidate=60` };
}

export async function GET(): Promise<NextResponse> {
  const now = Date.now();

  // 1. Tenta usar snapshot fresco do Firestore.
  const snap = await readSnapshot<GroupsResponse>("groups");

  if (snap && isFresh(snap, now)) {
    return NextResponse.json(snap.payload, {
      headers: cacheControl(snap.hasLiveGroupMatch),
    });
  }

  // 2/3/4. Cache stale ou ausente → recomputa.
  try {
    const [matches, teams] = await Promise.all([fetchAllMatches(), fetchAllTeams()]);

    const groups = computeGroupStandings(matches, teams);
    const hasLive = matches.some(
      (m) => m.stage === "grupos" && m.status === "live",
    );

    const payload: GroupsResponse = { groups, hasLiveGroupMatch: hasLive };

    // Grava best-effort; erro engolido dentro de writeSnapshot.
    await writeSnapshot("groups", payload, hasLive, now);

    return NextResponse.json(payload, { headers: cacheControl(hasLive) });
  } catch (err) {
    // Resiliência: openfootball indisponível mas snapshot (mesmo stale) existe.
    if (snap) {
      console.error("[worldcup/groups] Falha no fetch; retornando snapshot stale:", err);
      return NextResponse.json(snap.payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return copaDataErrorResponse(err);
  }
}
