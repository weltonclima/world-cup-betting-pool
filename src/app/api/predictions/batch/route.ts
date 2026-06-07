import "server-only"; // garante que não vaza para o bundle client

import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionInputSchema } from "@/schemas";
import {
  isPredictionLocked,
  predictionDocId,
} from "@/features/predictions/lib";
import { fetchAllMatches } from "@/server/copaData";
import { copaDataErrorResponse } from "../../_lib/copaDataError";

// Node runtime: firebase-admin + cookies() de next/headers exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê cookies e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schema de validação do body do lote
// ---------------------------------------------------------------------------

/** Total de jogos da Copa do Mundo 2026. */
export const BATCH_MAX_SIZE = 104;

/**
 * batchInputSchema — valida estrutura do body do POST /api/predictions/batch.
 *
 * Valida apenas que `predictions` existe e tem tamanho entre 1 e 104.
 * A validação item a item ocorre no loop (erros vão para `rejected`).
 */
export const batchInputSchema = z.object({
  predictions: z
    .array(z.unknown())
    .min(1, "O lote deve conter pelo menos 1 palpite.")
    .max(BATCH_MAX_SIZE, `O lote não pode exceder ${BATCH_MAX_SIZE} palpites.`),
});

export type BatchInput = z.infer<typeof batchInputSchema>;

// ---------------------------------------------------------------------------
// Tipos de resposta
// ---------------------------------------------------------------------------

interface SavedItem {
  id: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  created: boolean;
}

interface RejectedItem {
  index: number;
  matchId: string | undefined;
  reason: "invalid" | "not_found" | "locked";
  message: string;
}

/**
 * POST /api/predictions/batch — upsert de N palpites em uma única requisição (TASK-04).
 *
 * Fluxo:
 * 1. Lê e valida o session cookie httpOnly via Admin SDK (verifySessionCookie) → uid.
 * 2. Busca users/{uid} no Firestore → 401 se não existe; 403 se status !== "approved".
 * 3. Parseia body → 400 se JSON inválido.
 * 4. Valida body com batchInputSchema → 422 se inválido (predictions ausente, vazio, cap).
 * 5. Chama fetchAllMatches() → erros via copaDataErrorResponse (502/504/500).
 * 6. Captura now = new Date() (timestamp único por requisição).
 * 7. Para cada predictions[i]:
 *    a. Valida item com predictionInputSchema → rejected(reason="invalid") se falhar.
 *    b. Busca match por matchId → rejected(reason="not_found") se inexistente.
 *    c. Verifica isPredictionLocked → rejected(reason="locked") se bloqueada.
 *    d. Determina isCreate via doc.get(); monta payload; batch.set(docRef, payload, { merge: true }).
 * 8. Leituras de existência (create vs update) em paralelo via Promise.all.
 * 9. Chama batch.commit() → 500 se lança.
 * 10. Retorna 200 { saved, rejected }.
 *
 * Campos NUNCA gravados: status, points (responsabilidade do handler de pontuação).
 * uid SEMPRE da sessão, nunca do body.
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

  // ─── 3. Parsear body ──────────────────────────────────────────────────────
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)." },
      { status: 400 },
    );
  }

  // ─── 4. Validar estrutura do lote ─────────────────────────────────────────
  const parsedBatch = batchInputSchema.safeParse(json);
  if (!parsedBatch.success) {
    return NextResponse.json(
      { error: "Dados de entrada inválidos.", issues: parsedBatch.error.issues },
      { status: 422 },
    );
  }

  const { predictions: rawPredictions } = parsedBatch.data;

  // ─── 5. Buscar partidas ───────────────────────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }

  // Mapa matchId → match para lookup O(1)
  const matchesMap = new Map(matches.map((m) => [m.id, m]));

  // ─── 6. Timestamp único por requisição ───────────────────────────────────
  const now = new Date();
  const nowIso = now.toISOString();

  // ─── 7. Classificar itens: válidos para escrita vs rejeitados ────────────
  const saved: SavedItem[] = [];
  const rejected: RejectedItem[] = [];

  // Primeiro passo: validar cada item e filtrar os que serão escritos
  interface ItemToWrite {
    index: number;
    matchId: string;
    homeScore: number;
    awayScore: number;
  }

  const itemsToWrite: ItemToWrite[] = [];

  for (let i = 0; i < rawPredictions.length; i++) {
    const raw = rawPredictions[i];

    // 7a. Validação de schema do item individual
    const parsedItem = predictionInputSchema.safeParse(raw);
    if (!parsedItem.success) {
      const matchId =
        raw !== null && typeof raw === "object" && "matchId" in raw
          ? String((raw as Record<string, unknown>).matchId)
          : undefined;
      rejected.push({
        index: i,
        matchId,
        reason: "invalid",
        message: "Item com dados inválidos.",
      });
      continue;
    }

    const { matchId, homeScore, awayScore } = parsedItem.data;

    // 7b. Verificar existência da partida
    const match = matchesMap.get(matchId);
    if (!match) {
      rejected.push({
        index: i,
        matchId,
        reason: "not_found",
        message: "Partida não encontrada.",
      });
      continue;
    }

    // 7c. Verificar bloqueio
    if (isPredictionLocked(match, now)) {
      rejected.push({
        index: i,
        matchId,
        reason: "locked",
        message: "O prazo para palpites nesta partida foi encerrado.",
      });
      continue;
    }

    // Item válido — enfileirar para escrita
    itemsToWrite.push({ index: i, matchId, homeScore, awayScore });
  }

  // ─── 8. Leituras de existência em paralelo (create vs update) ────────────
  const predictionsCollection = db.collection("predictions");
  const existenceChecks = await Promise.all(
    itemsToWrite.map(async (item) => {
      const docId = predictionDocId(uid, item.matchId);
      const docRef = predictionsCollection.doc(docId);
      const snap = await docRef.get();
      return { ...item, docId, docRef, isCreate: !snap.exists };
    }),
  );

  // ─── 9. Montar e executar WriteBatch ────────────────────────────────────
  const batch = db.batch();

  for (const item of existenceChecks) {
    const payload: Record<string, unknown> = {
      uid,
      matchId: item.matchId,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      updatedAt: nowIso,
    };

    if (item.isCreate) {
      payload.createdAt = nowIso;
    }

    batch.set(item.docRef, payload, { merge: true });

    saved.push({
      id: item.docId,
      matchId: item.matchId,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      created: item.isCreate,
    });
  }

  // ─── 10. Commit do batch (só se houver itens a gravar — evita round-trip à toa
  //         quando todos os itens foram rejeitados; review WARNING-01 TASK-04) ──
  if (saved.length > 0) {
    try {
      await batch.commit();
    } catch {
      return NextResponse.json(
        { error: "Erro ao salvar o lote de palpites." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ saved, rejected }, { status: 200 });
}
