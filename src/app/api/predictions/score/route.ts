import "server-only"; // garante que não vaza para o bundle client

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionSchema } from "@/schemas";
import { scorePrediction } from "@/features/predictions/lib";
import { fetchAllMatches } from "@/server/copaData";
import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { safeSecretEqual } from "../../_lib/secret";

/**
 * Encadeamento (TASK-14): após pontuar, dispara o recálculo de rankings/estatísticas.
 * Best-effort e não-fatal — só roda quando RANKINGS_SECRET está configurado (cron/produção);
 * falha de rede apenas loga (o recalc também roda no próprio cron como fallback).
 */
async function chainRecalc(request: NextRequest): Promise<void> {
  const secret = process.env["RANKINGS_SECRET"];
  if (secret === undefined || secret.length === 0) return;
  try {
    const url = new URL("/api/rankings/recalc", request.url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    if (!res.ok) {
      console.warn("[score] recalc encadeado retornou status", res.status);
    }
  } catch (err) {
    console.warn("[score] recalc encadeado falhou:", err);
  }
}

// Node runtime: firebase-admin + cookies() de next/headers exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê cookies e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/predictions/score — calcula e grava pontuação binária (TASK-04).
 *
 * Proteção dupla:
 * (A) header x-cron-secret === process.env["SCORE_SECRET"] (cron externo)
 * (B) sessão admin via cookie __session (disparo manual pelo admin)
 *
 * Fluxo:
 * 1. Verificar autorização (A ou B) — 401/403 se não autorizado.
 * 2. Buscar todas as partidas via fetchAllMatches() → filtrar status==="finished".
 * 3. Para cada partida finished: query predictions.where(matchId) → scorePrediction → set merge.
 * 4. Responder { scoredMatches, updatedPredictions }.
 * Idempotente: re-rodar grava os mesmos { status, points } (função pura + set merge).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Autorização: header secret (cron externo) ─────────────────────────
  const cronSecret = process.env["SCORE_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");

  let authorized = safeSecretEqual(cronSecret, headerSecret);

  // ─── 2. Autorização: sessão admin (fallback) ──────────────────────────────
  if (!authorized) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const auth = getAdminAuth();
    let uid: string;
    try {
      const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
      uid = decodedToken.uid;
    } catch {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const db = getAdminFirestore();
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const userData = userSnap.data();
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    authorized = true;
  }

  // ─── 3. Buscar e filtrar partidas finished ────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }

  const finishedMatches = matches.filter((m) => m.status === "finished");

  if (finishedMatches.length === 0) {
    return NextResponse.json(
      { scoredMatches: 0, updatedPredictions: 0 },
      { status: 200 },
    );
  }

  // ─── 4. Pontuação paralela ────────────────────────────────────────────────
  const db = getAdminFirestore(); // singleton — retorna mesma instância

  /**
   * Processa uma única partida finished:
   * - Busca todos os palpites (matchId ==)
   * - Parseia, pontua e grava em paralelo
   * - Retorna o número de palpites escritos com sucesso
   */
  async function processMatch(
    match: (typeof finishedMatches)[number],
  ): Promise<number> {
    const snapshot = await db
      .collection("predictions")
      .where("matchId", "==", match.id)
      .get();

    const writes = snapshot.docs.map(async (docSnap): Promise<number> => {
      const parsed = predictionSchema.safeParse(docSnap.data());
      if (!parsed.success) {
        // #1 Observabilidade: doc malformado rastreável em produção
        console.warn(
          "[score] doc malformado ignorado:",
          docSnap.ref.path,
          parsed.error.issues,
        );
        return 0;
      }

      const { status, points } = scorePrediction(parsed.data, match);

      // Idempotente: set merge sempre grava os mesmos valores derivados de função pura
      await docSnap.ref.set({ status, points }, { merge: true });
      return 1;
    });

    // Paraleliza todos os set() da partida
    const results = await Promise.all(writes);
    return results.reduce((sum, n) => sum + n, 0);
  }

  // Paraleliza o processamento de todas as partidas finished (#2 timeout risk)
  const perMatchCounts = await Promise.all(finishedMatches.map(processMatch));

  const scoredMatches = finishedMatches.length;
  const updatedPredictions = perMatchCounts.reduce((sum, n) => sum + n, 0);

  // Encadeia o recálculo de rankings/estatísticas (best-effort).
  await chainRecalc(request);

  return NextResponse.json({ scoredMatches, updatedPredictions }, { status: 200 });
}
