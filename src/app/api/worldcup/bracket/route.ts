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
import { fetchAllTeams } from "@/server/copaData";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { isFresh, readSnapshot, writeSnapshot } from "@/server/worldcup/cache";
import { deriveBracket } from "@/server/worldcup/bracket";
import { bracketResponseSchema } from "@/schemas/worldcup";
import type { BracketResponse } from "@/types/worldcup";

// Força modo dinâmico — sem ISR; cache gerenciado pelo helper Firestore.
export const dynamic = "force-dynamic";

/** Achata todos os 6 buckets do bracket numa lista única de confrontos. */
function allMatches(payload: BracketResponse) {
  return [
    payload.roundOf32,
    payload.roundOf16,
    payload.quarterFinals,
    payload.semiFinals,
    payload.thirdPlace,
    payload.final,
  ].flat();
}

/**
 * Snapshot legado (pré-PRD-16 TASK-01) não carrega `kickoffAt` nos confrontos —
 * `kickoffAt` é opcional no schema, então um snapshot velho parseia mas a UI
 * mostra "Data a confirmar". Como a ESPN SEMPRE traz a data, um payload onde
 * algum confronto não tem `kickoffAt` é um snapshot desatualizado: tratamos como
 * cache miss para recomputar da fonte (auto-cura, sem intervenção no Firestore).
 *
 * Vazio → `true` (nada a recomputar por causa de data).
 */
function snapshotHasKickoff(payload: BracketResponse): boolean {
  return allMatches(payload).every((m) => m.kickoffAt !== undefined);
}

/**
 * Detecta o congelamento "chicken-egg": um snapshot gravado ANTES do kickoff
 * marca `hasLiveGroupMatch=false` → TTL de 24h em `isFresh`, então a rota nunca
 * recomputa quando o jogo começa e o placar ao vivo/resultado final fica preso.
 *
 * Um confronto com horário já no passado (`kickoffAt <= now`) cujo status ainda
 * é `definido` (não começou no snapshot) ou `em-andamento` (placar ao vivo pode
 * estar velho) significa que o snapshot ficou para trás da realidade da ESPN.
 * Tratamos como cache miss → recomputa (auto-cura). `aguardando`/`encerrado` são
 * estados estáveis e não forçam recomputo.
 */
function snapshotHasDueMatch(payload: BracketResponse, now: number): boolean {
  return allMatches(payload).some(
    (m) =>
      (m.status === "definido" || m.status === "em-andamento") &&
      m.kickoffAt !== undefined &&
      Date.parse(m.kickoffAt) <= now,
  );
}

/**
 * Monta o header Cache-Control conforme presença de jogo ao vivo.
 *
 * @param hasLive `true` quando há qualquer partida ao vivo (grupos ou mata-mata).
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
    if (
      parsed.success &&
      snapshotHasKickoff(parsed.data) &&
      !snapshotHasDueMatch(parsed.data, now)
    ) {
      return NextResponse.json(parsed.data, {
        headers: cacheControl(snap.hasLiveGroupMatch),
      });
    }
    console.error(
      !parsed.success
        ? "[worldcup/bracket] snapshot em cache fora do contrato — recomputando"
        : !snapshotHasKickoff(parsed.data)
          ? "[worldcup/bracket] snapshot fresco sem kickoffAt (legado) — recomputando"
          : "[worldcup/bracket] snapshot fresco mas jogo já passou do kickoff (placar preso) — recomputando",
    );
  }

  // 2/3/4. Cache stale, ausente ou corrompido → recomputa.
  try {
    const [matches, teams] = await Promise.all([getEffectiveMatches(), fetchAllTeams()]);

    // Qualquer jogo ao vivo (não só de grupos): no mata-mata um confronto live
    // precisa encurtar o TTL para 60s — senão o bracket congela 24h durante o
    // jogo (knockout-live blind spot). Jogo de grupo ao vivo também encurta, pois
    // seu encerramento pode definir um lado do bracket (aguardando → definido).
    const hasLive = matches.some((m) => m.status === "live");

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
