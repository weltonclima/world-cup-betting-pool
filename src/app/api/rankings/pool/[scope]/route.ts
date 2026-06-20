import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { ensureRankingsFresh } from "@/server/rankings/recalc";
import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";
import { rankingSchema } from "@/schemas";
import { rankingScopeSchema } from "@/schemas/shared";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rankings/pool/{scope} — ranking de uma FASE recortado ao pool do usuário
 * logado (PRD-09, Tela 03 "Por Fase").
 *
 * Isolamento multi-tenant: o `groupId` (pool) vem SEMPRE da sessão, NUNCA do request.
 * Serve `rankings/pool-{groupId}-{scope}` (re-rankeado só com membros do pool pelo
 * recalc). Usuário sem pool → `null`. Aplica o recalc preguiçoso (dirty-by-finish)
 * via `ensureRankingsFresh`. Espelha `GET /api/rankings/{scope}`, mas com recorte
 * por pool em vez do doc global.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ scope: string }> },
): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const { scope } = await ctx.params;
  const parsedScope = rankingScopeSchema.safeParse(scope);
  if (!parsedScope.success) {
    return NextResponse.json({ error: "Escopo de ranking inválido." }, { status: 400 });
  }

  const db = getAdminFirestore();

  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const groupId = userSnap.data()?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) {
    // Sem pool: deny-by-default semântico — não há ranking a servir.
    return NextResponse.json(null, { status: 200 });
  }

  // Recalc-on-read (best-effort, nunca lança): mantém os docs de ranking frescos.
  await ensureRankingsFresh(db);

  const snap = await db
    .collection("rankings")
    .doc(`pool-${groupId}-${parsedScope.data}`)
    .get();
  if (!snap.exists) {
    return NextResponse.json(null, { status: 200 });
  }

  const parsed = rankingSchema.safeParse(snap.data());
  if (!parsed.success) {
    console.warn(
      "[rankings] pool scope doc fora do schema:",
      groupId,
      parsedScope.data,
      parsed.error.issues,
    );
    return NextResponse.json(null, { status: 200 });
  }

  // Foto/nome de exibição resolvidos AO VIVO (não do snapshot do recalc).
  const entries = await hydrateRankingEntries(db, parsed.data.entries);
  return NextResponse.json({ ...parsed.data, entries }, { status: 200 });
}
