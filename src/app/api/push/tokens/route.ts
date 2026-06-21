import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { fcmTokenInputSchema, fcmTokenSchema, type FcmToken } from "@/schemas";

// Node runtime: firebase-admin + cookies() (via requireApprovedUser) exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê sessão e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";

const FCM_TOKENS = "fcm_tokens";

/**
 * Store de tokens FCM por usuário (web-push-pwa TASK-03). Doc id = o próprio
 * token; escrita exclusiva via Admin SDK (Rules negam acesso client). `uid`
 * SEMPRE da sessão, nunca do body. Padrão write-server-side (espelha
 * `predictions`/WebAuthn).
 */

async function parseTokenBody(
  request: NextRequest,
): Promise<{ token: string } | { errorResponse: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { errorResponse: NextResponse.json({ error: "Corpo inválido." }, { status: 400 }) };
  }
  const parsed = fcmTokenInputSchema.safeParse(raw);
  if (!parsed.success) {
    // Não vaza `issues` (minimize sensitive data in errors).
    return { errorResponse: NextResponse.json({ error: "Dados inválidos." }, { status: 422 }) };
  }
  return { token: parsed.data.token };
}

/**
 * POST /api/push/tokens — registra/atualiza um token FCM do device atual.
 * Upsert idempotente por token (`set({merge:true})`): `createdAt` preservado no
 * re-registro; `userId`/`userAgent`/`lastSeenAt` atualizados. Reatribui `userId`
 * ao uid da sessão se o token era de outro usuário (device compartilhado).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApprovedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { uid } = authResult.user;

  const parsed = await parseTokenBody(request);
  if ("errorResponse" in parsed) return parsed.errorResponse;
  const { token } = parsed;

  const userAgent = request.headers.get("user-agent") ?? "";
  const now = new Date().toISOString();

  const db = getAdminFirestore();
  const ref = db.collection(FCM_TOKENS).doc(token);

  try {
    const snap = await ref.get();
    // Preserva `createdAt` só se o doc existente for válido pelo schema (evita
    // propagar createdAt corrompido/legado que depois falharia em getUserTokens).
    const existing = snap.exists ? fcmTokenSchema.safeParse(snap.data()) : null;
    const createdAt = existing?.success ? existing.data.createdAt : now;

    const payload: FcmToken = { token, userId: uid, userAgent, createdAt, lastSeenAt: now };
    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true }, { status: snap.exists ? 200 : 201 });
  } catch (err) {
    console.error("[push/tokens POST] erro inesperado:", err);
    return NextResponse.json({ error: "Erro ao registrar o token." }, { status: 500 });
  }
}

/**
 * DELETE /api/push/tokens — remove um token (logout / permissão revogada /
 * device compartilhado). Escopado ao DONO: só apaga token do uid da sessão (um
 * approved não deregistra o device de outro). Idempotente: token inexistente
 * retorna sucesso (cleanup de logout não pode falhar).
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireApprovedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { uid } = authResult.user;

  const parsed = await parseTokenBody(request);
  if ("errorResponse" in parsed) return parsed.errorResponse;
  const { token } = parsed;

  const db = getAdminFirestore();
  try {
    const ref = db.collection(FCM_TOKENS).doc(token);
    const snap = await ref.get();
    // Token ausente → sucesso idempotente (cleanup de token já removido).
    if (!snap.exists) return NextResponse.json({ ok: true });
    // Token de outro usuário → 403 (não deregistra device alheio).
    if (snap.data()?.["userId"] !== uid) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/tokens DELETE] erro inesperado:", err);
    return NextResponse.json({ error: "Erro ao remover o token." }, { status: 500 });
  }
}
