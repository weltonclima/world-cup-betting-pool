import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { ensureRankingsFresh } from "@/server/rankings/recalc";
import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";
import { rankingSchema } from "@/schemas";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rankings/pool — ranking FECHADO do pool do usuário logado (PRD-09).
 *
 * Isolamento multi-tenant: o `groupId` vem SEMPRE da sessão (`users/{uid}.groupId`),
 * NUNCA do request — senão um usuário pediria o pool de outro grupo. Serve
 * `rankings/pool-{groupId}-geral` (re-rankeado só com membros do pool pelo recalc).
 * Usuário sem pool → `null` (não pertence a ranking nenhum e nunca aparece em outro).
 * Aplica o recalc preguiçoso (dirty-by-finish) via `ensureRankingsFresh`.
 */
export async function GET(): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const db = getAdminFirestore();

  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const groupId = userSnap.data()?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) {
    // Sem pool: deny-by-default semântico — não há ranking a servir.
    return NextResponse.json(null, { status: 200 });
  }

  // Recalc-on-read (best-effort, nunca lança): mantém os docs de ranking frescos.
  await ensureRankingsFresh(db);

  const snap = await db.collection("rankings").doc(`pool-${groupId}-geral`).get();
  if (!snap.exists) {
    return NextResponse.json(null, { status: 200 });
  }

  const parsed = rankingSchema.safeParse(snap.data());
  if (!parsed.success) {
    console.warn("[rankings] pool doc fora do schema:", groupId, parsed.error.issues);
    return NextResponse.json(null, { status: 200 });
  }

  // Flag de exibição do pool (split-phase-ranking TASK-02): lida SÓ da sessão
  // (pools/{groupId}), nunca do request. Ausente/não-booleano = OFF (omitido do
  // payload; telas tratam ausência como false). Expomos APENAS este campo a
  // membros — nenhum outro dado do pool vaza no payload de ranking.
  const poolSnap = await db.collection("pools").doc(groupId).get();
  const rawFlag: unknown = poolSnap.data()?.["splitPhaseRanking"];
  const splitPhaseRanking = typeof rawFlag === "boolean" ? rawFlag : undefined;

  // Foto/nome de exibição resolvidos AO VIVO (não do snapshot do recalc): garante que
  // trocar avatar/apelido reflita no ranking sem depender de um recalc disparar.
  const entries = await hydrateRankingEntries(db, parsed.data.entries);
  return NextResponse.json(
    { ...parsed.data, entries, splitPhaseRanking },
    { status: 200 },
  );
}
