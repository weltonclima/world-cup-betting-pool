import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { ensureRankingsFresh } from "@/server/rankings/recalc";
import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";
import { rankingSchema } from "@/schemas";
import { rankingScopeSchema } from "@/schemas/shared";

// firebase-admin exige Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rankings/{scope} — leitura do ranking de um escopo ("geral" ou uma das
 * 5 fases) com recalc preguiçoso (TTL + stale-while-revalidate via
 * `ensureRankingsFresh`). Substitui a leitura client-side direta no Firestore: o
 * recalc só roda no servidor (admin SDK) e mantém todos os docs de ranking frescos
 * sem depender de cron. Retorna o doc (validado) ou `null` quando ausente.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ scope: string }> },
): Promise<NextResponse> {
  // Mesma proteção que a leitura client-side antiga tinha via firestore.rules
  // (isApproved): sem sessão aprovada não há ranking. (Antes este handler ficou
  // sem auth — regressão corrigida.)
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const { scope } = await ctx.params;
  const parsedScope = rankingScopeSchema.safeParse(scope);
  if (!parsedScope.success) {
    return NextResponse.json({ error: "Escopo de ranking inválido." }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Recalc-on-read (best-effort, nunca lança): popula/atualiza os docs de ranking.
  await ensureRankingsFresh(db);

  const snap = await db.collection("rankings").doc(parsedScope.data).get();
  if (!snap.exists) {
    return NextResponse.json(null, { status: 200 });
  }

  const parsed = rankingSchema.safeParse(snap.data());
  if (!parsed.success) {
    console.warn("[rankings] doc fora do schema:", parsedScope.data, parsed.error.issues);
    return NextResponse.json(null, { status: 200 });
  }

  // Foto/nome de exibição resolvidos AO VIVO (não do snapshot do recalc): garante que
  // trocar avatar/apelido reflita no ranking sem depender de um recalc disparar.
  const entries = await hydrateRankingEntries(db, parsed.data.entries);
  return NextResponse.json({ ...parsed.data, entries }, { status: 200 });
}
