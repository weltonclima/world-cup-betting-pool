import "server-only"; // garante que não vaza para o bundle client

import { NextResponse } from "next/server";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { fetchAllMatches } from "@/server/copaData";
import { recalcRankingsBestEffort } from "@/server/rankings/recalc";
import { writeAuditLog } from "@/server/admin/auditLog";
import {
  groupManualPredictionInputSchema,
  isSuperAdminRole,
  roleSchema,
} from "@/schemas";
import {
  isPredictionLocked,
  predictionDocId,
} from "@/features/predictions/lib";
import { copaDataErrorResponse } from "../../_lib/copaDataError";

// Node runtime: firebase-admin + cookies() (via authorize) exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê sessão e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/group/predictions — palpite manual do admin de grupo (PRD-12).
 *
 * Endpoint ISOLADO (não reusa /api/predictions): os invariantes daquele fluxo
 * — uid-da-sessão e lock-bloqueia — são exatamente o que aqui precisa ser
 * invertido de forma controlada. O admin lança o palpite de OUTRO usuário
 * (`targetUid`) num jogo BLOQUEADO. Segurança por:
 *  - autorização escopada (`authorizeGroupAdminOfPool` — groupId da sessão, D2);
 *  - alvo fail-closed (aprovado + mesmo pool + não super_admin);
 *  - override de lock como pré-condição INVERTIDA (jogo aberto → 409);
 *  - auditoria anterior→novo (A2 read-before-write) + recalc in-process.
 *
 * `targetUid` vem do body mas SÓ identifica o alvo — nunca autoriza. Admin/role/
 * groupId vêm SEMPRE da sessão.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // ─── 1. Autorização escopada ao pool ─────────────────────────────────────
  const authResult = await authorizeGroupAdminOfPool();
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { uid: adminUid, groupId: sessionGroupId, role } = authResult.auth;

  // ─── 2. Validação do body ─────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)." },
      { status: 400 },
    );
  }

  const parsed = groupManualPredictionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de entrada inválidos.", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { targetUid, matchId, homeScore, awayScore } = parsed.data;

  const db = getAdminFirestore();

  // ─── 3. Escopo do alvo (fail-closed) ─────────────────────────────────────
  const targetSnap = await db.collection("users").doc(targetUid).get();
  if (!targetSnap.exists) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }
  const targetData = targetSnap.data();
  // Alvo de outro pool é invisível para este admin (isolamento D2).
  if (targetData?.["groupId"] !== sessionGroupId) {
    return NextResponse.json(
      { error: "Usuário não pertence ao seu grupo." },
      { status: 403 },
    );
  }
  if (targetData?.["status"] !== "approved") {
    return NextResponse.json(
      { error: "Usuário não está aprovado no grupo." },
      { status: 403 },
    );
  }
  // Super admin é intocável por um group_admin (proteção de papel).
  const targetRole = roleSchema.safeParse(targetData?.["role"]);
  if (targetRole.success && isSuperAdminRole(targetRole.data)) {
    return NextResponse.json(
      { error: "Não é possível lançar palpite para este usuário." },
      { status: 403 },
    );
  }

  // ─── 4. Jogo + override de lock (A1) ─────────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }
  const match = matches.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json(
      { error: "Partida não encontrada." },
      { status: 404 },
    );
  }
  const now = new Date();
  // Pré-condição INVERTIDA: lançar palpite manual SÓ em jogo bloqueado.
  // Jogo aberto (futuro/scheduled) não é papel do admin → 409.
  if (!isPredictionLocked(match, now)) {
    return NextResponse.json(
      { error: "Este jogo ainda está aberto para palpites do próprio participante." },
      { status: 409 },
    );
  }

  // ─── 5. A2 — read-before-write (captura placar anterior p/ auditoria) ────
  const docId = predictionDocId(targetUid, matchId);
  const docRef = db.collection("predictions").doc(docId);
  const priorSnap = await docRef.get();
  const prior = priorSnap.exists ? priorSnap.data() : undefined;
  const priorLabel =
    prior &&
    typeof prior["homeScore"] === "number" &&
    typeof prior["awayScore"] === "number"
      ? `${prior["homeScore"]}x${prior["awayScore"]}`
      : "—";

  // ─── 6. Gravação (só chaves de predictionSchema — .strict / não-descarte) ─
  const nowIso = now.toISOString();
  const payload: Record<string, unknown> = {
    uid: targetUid, // autor do palpite = alvo
    matchId,
    homeScore,
    awayScore,
    editedBy: adminUid, // quem lançou (admin da sessão)
    editedByRole: role, // role da sessão (group_admin/super_admin), nunca participante
    editedAt: nowIso,
    updatedAt: nowIso,
  };
  if (!priorSnap.exists) payload["createdAt"] = nowIso;

  try {
    await docRef.set(payload, { merge: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar o palpite." },
      { status: 500 },
    );
  }

  // ─── 7. Auditoria (best-effort, nunca derruba a ação) ────────────────────
  try {
    await writeAuditLog({
      type: "group_admin_manual_prediction",
      actorUid: adminUid,
      targetUid,
      message: `Palpite manual no jogo ${matchId}: ${priorLabel} → ${homeScore}x${awayScore} (alvo ${targetUid}).`,
      level: "info",
    });
  } catch (err) {
    console.error("[group/predictions] auditoria falhou (best-effort):", err);
  }

  // ─── 8. Recalc in-process (espelha _moderation.ts) — nunca /score ────────
  await recalcRankingsBestEffort(db);

  return NextResponse.json(
    {
      saved: {
        id: docId,
        uid: targetUid,
        matchId,
        homeScore,
        awayScore,
        editedBy: adminUid,
        editedByRole: role,
        editedAt: nowIso,
      },
    },
    { status: 200 },
  );
}
