/**
 * GET /api/worldcup/groups — classificação da fase de grupos com cache Firestore.
 *
 * Fluxo read-through (spec §6):
 *  1. Lê snapshot do Firestore; se fresco E válido pelo schema → retorna payload cacheado.
 *  2. Cache stale/ausente/corrompido → busca matches + teams, computa, grava best-effort.
 *  3. Falha no fetch + snapshot presente (mesmo stale) → retorna stale (resiliência).
 *  4. Falha no fetch + sem snapshot → copaDataErrorResponse (502/504/500).
 *
 * Resposta: GroupsResponse = { groups: GroupTable[], hasLiveGroupMatch: boolean }
 */

import { after, NextResponse } from "next/server";

import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { fetchAllTeams } from "@/server/copaData";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { isFresh, readSnapshot, writeSnapshot } from "@/server/worldcup/cache";
import { computeGroupStandings } from "@/server/worldcup/standings";
import { groupsResponseSchema } from "@/schemas/worldcup";

// Força modo dinâmico — sem ISR; cache gerenciado pelo helper Firestore.
export const dynamic = "force-dynamic";

/**
 * Monta o header Cache-Control conforme presença de jogo ao vivo.
 *
 * @param hasLive `true` quando há partida ao vivo na fase de grupos.
 * Fix 4 (WR-02): stale-while-revalidate=0 quando ao vivo, evitando servir dado
 * desatualizado de CDN durante partidas em andamento.
 */
function cacheControl(hasLive: boolean): Record<string, string> {
  if (hasLive) {
    return { "Cache-Control": "s-maxage=60, stale-while-revalidate=0" };
  }
  return { "Cache-Control": "s-maxage=86400, stale-while-revalidate=60" };
}

export async function GET(): Promise<NextResponse> {
  const now = Date.now();

  // 1. Tenta usar snapshot fresco do Firestore.
  const snap = await readSnapshot("groups");

  // Fix 1 (CR-01 + WR-04): valida o payload do snapshot antes de servir.
  // Snapshot corrompido é tratado como cache miss — cai no caminho de recomputo.
  if (snap && isFresh(snap, now)) {
    const parsed = groupsResponseSchema.safeParse(snap.payload);
    if (parsed.success) {
      return NextResponse.json(parsed.data, {
        headers: cacheControl(snap.hasLiveGroupMatch),
      });
    }
    console.error(
      "[worldcup/groups] snapshot em cache fora do contrato — recomputando",
    );
  }

  // 2/3/4. Cache stale, ausente ou corrompido → recomputa.
  try {
    const [matches, teams] = await Promise.all([getEffectiveMatches(), fetchAllTeams()]);

    const hasLive = matches.some(
      (m) => m.stage === "grupos" && m.status === "live",
    );

    // Fix 2 (WR-06): valida o payload computado antes de gravar/retornar.
    // .parse lança ZodError se nosso próprio código produziu shape inválido —
    // sinaliza bug real; capturado pelo catch abaixo → 500 via copaDataErrorResponse.
    const payload = groupsResponseSchema.parse({
      groups: computeGroupStandings(matches, teams),
      hasLiveGroupMatch: hasLive,
    });

    // Fix 3 (CR-02): desacopla escrita de cache do response usando after().
    // writeSnapshot engole seus próprios erros; after() garante execução pós-response.
    after(() => writeSnapshot("groups", payload, hasLive, now));

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
