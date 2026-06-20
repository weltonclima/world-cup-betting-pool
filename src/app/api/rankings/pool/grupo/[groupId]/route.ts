import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { ensureRankingsFresh } from "@/server/rankings/recalc";
import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";
import { groupRankingSchema } from "@/schemas";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Grupos válidos da Copa 2026 (A–L). Restringe o doc id (sem traversal/injeção). */
const COPA_GROUP_RE = /^[A-L]$/;

/**
 * GET /api/rankings/pool/grupo/{groupId} — ranking de um GRUPO da Copa (A–L)
 * recortado ao pool do usuário logado (PRD-09, Tela 03 "Por Grupo").
 *
 * Dois "grupos" em jogo: o `{groupId}` da rota é o grupo da COPA (A–L); o pool
 * (bolão) vem SEMPRE da sessão (`users/{uid}.groupId`), NUNCA do request. Serve
 * `rankings/pool-{poolId}-grupo-{groupId}` (re-rankeado só com membros do pool).
 * Usuário sem pool → `null`. Aplica o recalc preguiçoso via `ensureRankingsFresh`.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const { groupId: copaGroupId } = await ctx.params;
  if (!COPA_GROUP_RE.test(copaGroupId)) {
    return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
  }

  const db = getAdminFirestore();

  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const poolId = userSnap.data()?.["groupId"];
  if (typeof poolId !== "string" || poolId.length === 0) {
    // Sem pool: deny-by-default semântico — não há ranking a servir.
    return NextResponse.json(null, { status: 200 });
  }

  // Recalc-on-read (best-effort, nunca lança): mantém os docs de ranking frescos.
  await ensureRankingsFresh(db);

  const snap = await db
    .collection("rankings")
    .doc(`pool-${poolId}-grupo-${copaGroupId}`)
    .get();
  if (!snap.exists) {
    return NextResponse.json(null, { status: 200 });
  }

  const parsed = groupRankingSchema.safeParse(snap.data());
  if (!parsed.success) {
    console.warn(
      "[rankings] pool grupo doc fora do schema:",
      poolId,
      copaGroupId,
      parsed.error.issues,
    );
    return NextResponse.json(null, { status: 200 });
  }

  // Foto/nome de exibição resolvidos AO VIVO (não do snapshot do recalc).
  const entries = await hydrateRankingEntries(db, parsed.data.entries);
  return NextResponse.json({ ...parsed.data, entries }, { status: 200 });
}
