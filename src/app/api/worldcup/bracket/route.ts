/**
 * GET /api/worldcup/bracket — chaveamento eliminatório com cache Firestore.
 *
 * Fluxo read-through (spec §6):
 *  1. Lê snapshot do Firestore; se fresco E válido pelo schema → retorna payload cacheado.
 *  2. Cache stale/ausente/corrompido → busca matches + teams, deriva bracket, grava best-effort.
 *  3. Falha no fetch + snapshot presente (mesmo stale) → retorna stale (resiliência).
 *  4. Falha no fetch + sem snapshot → copaDataErrorResponse (502/504/500).
 *
 * Resposta: BracketResponse (contrato TASK-01 — sem hasLiveGroupMatch no body).
 * A flag `hasLiveGroupMatch` é usada apenas para TTL/header e writeSnapshot.
 */

import { after, NextResponse } from "next/server";

import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { fetchAllMatches, fetchAllTeams } from "@/server/copaData";
import { isFresh, readSnapshot, writeSnapshot } from "@/server/worldcup/cache";
import { deriveBracket } from "@/server/worldcup/bracket";
import { bracketResponseSchema } from "@/schemas/worldcup";

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
  const snap = await readSnapshot("bracket");

  // Fix 1 (CR-01 + WR-04): valida o payload do snapshot antes de servir.
  // Snapshot corrompido é tratado como cache miss — cai no caminho de recomputo.
  if (snap && isFresh(snap, now)) {
    const parsed = bracketResponseSchema.safeParse(snap.payload);
    if (parsed.success) {
      return NextResponse.json(parsed.data, {
        headers: cacheControl(snap.hasLiveGroupMatch),
      });
    }
    console.error(
      "[worldcup/bracket] snapshot em cache fora do contrato — recomputando",
    );
  }

  // 2/3/4. Cache stale, ausente ou corrompido → recomputa.
  try {
    const [matches, teams] = await Promise.all([fetchAllMatches(), fetchAllTeams()]);

    const hasLive = matches.some(
      (m) => m.stage === "grupos" && m.status === "live",
    );

    // Fix 2 (WR-06): valida o payload computado antes de gravar/retornar.
    // Bracket body é puro (sem hasLiveGroupMatch) para não violar contrato TASK-01.
    // .parse lança ZodError se nosso próprio código produziu shape inválido —
    // sinaliza bug real; capturado pelo catch abaixo → 500 via copaDataErrorResponse.
    const payload = bracketResponseSchema.parse(deriveBracket(matches, teams));

    // Fix 3 (CR-02): desacopla escrita de cache do response usando after().
    // writeSnapshot engole seus próprios erros; after() garante execução pós-response.
    after(() => writeSnapshot("bracket", payload, hasLive, now));

    return NextResponse.json(payload, { headers: cacheControl(hasLive) });
  } catch (err) {
    // Resiliência: openfootball indisponível mas snapshot (mesmo stale) existe.
    if (snap) {
      console.error("[worldcup/bracket] Falha no fetch; retornando snapshot stale:", err);
      return NextResponse.json(snap.payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return copaDataErrorResponse(err);
  }
}
