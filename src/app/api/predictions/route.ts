import "server-only"; // garante que não vaza para o bundle client

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionInputSchema } from "@/schemas";
import {
  isPredictionLocked,
  predictionDocId,
} from "@/features/predictions/lib";
import { fetchAllMatches } from "../_lib/apiFootballData";
import { apiFootballErrorResponse } from "../_lib/apiFootballError";

// Node runtime: firebase-admin + cookies() de next/headers exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê cookies e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/predictions — upsert de palpite (TASK-03).
 *
 * Fluxo:
 * 1. Lê e valida o session cookie httpOnly via Admin SDK (verifySessionCookie) → uid.
 * 2. Busca users/{uid} no Firestore → 403 se não aprovado.
 * 3. Valida body com predictionInputSchema → 422 se inválido.
 * 4. Busca partida em fetchAllMatches → 404 se inexistente.
 * 5. Verifica bloqueio via isPredictionLocked → 423 se travado.
 * 6. Grava predictions/${predictionDocId(uid, matchId)} via set({ merge: true }).
 *    - Nunca grava status nem points (responsabilidade de TASK-04).
 *    - uid SEMPRE da sessão, nunca do body.
 * 7. 201 para create; 200 para update.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Autenticação: ler e verificar session cookie ─────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const auth = getAdminAuth();
  let uid: string;
  try {
    const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
    uid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // ─── 2. Autorização: verificar status do usuário no Firestore ────────────
  const db = getAdminFirestore();
  const userSnap = await db.collection("users").doc(uid).get();

  if (!userSnap.exists) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const userData = userSnap.data();
  if (userData?.status !== "approved") {
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      { status: 403 },
    );
  }

  // ─── 3. Validação do body ─────────────────────────────────────────────────
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)." },
      { status: 400 },
    );
  }

  const parsed = predictionInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de entrada inválidos.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { matchId, homeScore, awayScore } = parsed.data;

  // ─── 4. Busca da partida ──────────────────────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return apiFootballErrorResponse(err);
  }

  const match = matches.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json(
      { error: "Partida não encontrada." },
      { status: 404 },
    );
  }

  // ─── 5. Verificação de bloqueio ───────────────────────────────────────────
  const now = new Date();
  if (isPredictionLocked(match, now)) {
    return NextResponse.json(
      { error: "O prazo para palpites nesta partida foi encerrado." },
      { status: 423 },
    );
  }

  // ─── 6. Determinar create vs update ──────────────────────────────────────
  const docId = predictionDocId(uid, matchId);
  const docRef = db.collection("predictions").doc(docId);

  const snap = await docRef.get();
  const isCreate = !snap.exists;
  const nowIso = now.toISOString();

  const payload: Record<string, unknown> = {
    uid,
    matchId,
    homeScore,
    awayScore,
    updatedAt: nowIso,
  };

  if (isCreate) {
    payload.createdAt = nowIso;
  }

  // ─── 7. Gravação via Admin SDK ────────────────────────────────────────────
  try {
    await docRef.set(payload, { merge: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar o palpite." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      prediction: {
        id: docId,
        uid,
        matchId,
        homeScore,
        awayScore,
      },
    },
    { status: isCreate ? 201 : 200 },
  );
}
