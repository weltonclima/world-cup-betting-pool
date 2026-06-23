import "server-only"; // garante que não vaza para o bundle client

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Firestore } from "firebase-admin/firestore";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionSchema } from "@/schemas";
import {
  scorePrediction,
  matchResultFingerprint,
  predictionScoreChanged,
} from "@/features/predictions/lib";
import { readScoreState, writeScoreState } from "@/server/scoring/scoreState";
import { fetchAllMatches } from "@/server/copaData";
import { resolveTeamByCode } from "@/server/copaData/teamRegistry";
import {
  fetchPreferencesMap,
  shouldDeliver,
  notifyScoreHit,
  writeNotifications,
  sendPushForNotifications,
  type NotificationCreate,
} from "@/server/notifications";
import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { safeSecretEqual } from "../../_lib/secret";

/**
 * Candidato a notificação `games` coletado no scoring. Só acerto
 * (`correct`/`partial`) gera candidato — `wrong`/`pending` não.
 */
type ScoreHit = {
  uid: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  result: "correct" | "partial";
  predictionIsDraw: boolean;
};

/**
 * Fan-out best-effort das notificações `games` (TASK-04). Aguardado (não
 * fire-and-forget literal — promises não-aguardadas morrem no encerramento
 * serverless), mas isolado em try/catch: qualquer falha loga e NUNCA altera
 * a pontuação já gravada nem o response de scoring.
 *
 * Dedup uids → preferências em 1 batch → filtra `games:true` → factory → write.
 */
async function notifyScoreHitsBestEffort(
  db: Firestore,
  hits: ScoreHit[],
  now: Date,
): Promise<void> {
  if (hits.length === 0) return;
  try {
    const uids = hits.map((h) => h.uid);
    const prefs = await fetchPreferencesMap(db, uids);

    const items: NotificationCreate[] = [];
    for (const hit of hits) {
      const pref = prefs.get(hit.uid);
      if (pref === undefined || !shouldDeliver("games", pref)) continue;
      items.push(
        notifyScoreHit({
          uid: hit.uid,
          matchId: hit.matchId,
          homeTeam: hit.homeTeam,
          awayTeam: hit.awayTeam,
          result: hit.result,
          predictionIsDraw: hit.predictionIsDraw,
        }),
      );
    }

    // TASK-07: writeNotifications retorna só os docs recém-criados; push apenas
    // neles → re-run do cron não repusha (in-app já é idempotente por ID).
    const created = await writeNotifications(db, items, now);
    await sendPushForNotifications(created, now);
  } catch (err) {
    console.warn("[score] fan-out de notificações games falhou:", err);
  }
}

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
      { scoredMatches: 0, updatedPredictions: 0, skippedMatches: 0 },
      { status: 200 },
    );
  }

  // ─── 4. Pontuação paralela ────────────────────────────────────────────────
  const db = getAdminFirestore(); // singleton — retorna mesma instância

  // scoring-write-cost (TASK-03): 1 read do doc de controle. Mapa { matchId: hash }
  // do que já foi pontuado — sustenta o filtro grosso (B). Degrada seguro p/ vazio.
  const scoreState = await readScoreState(db);

  /**
   * Resultado do processamento de UMA partida finished.
   * - `processed: false` → partida pulada pelo filtro grosso (hash inalterado):
   *   nenhuma query de palpites, nenhum write, `hash` = o valor já registrado.
   * - `processed: true` → partida nova/corrigida: `hash` = fingerprint atual,
   *   `count` = palpites efetivamente regravados (filtro fino), `hits` p/ fan-out.
   */
  type MatchResult = {
    matchId: string;
    hash: string;
    processed: boolean;
    /**
     * `true` só quando TODOS os palpites da partida foram parseados com sucesso.
     * Um doc malformado torna a pontuação da partida incompleta: o hash NÃO pode
     * avançar (senão a partida é pulada para sempre pelo filtro grosso e o palpite
     * some do ranking se voltar a ser válido — viola CA3). `false` força re-processo
     * no próximo run (degrada para o comportamento legado só nessa partida).
     */
    complete: boolean;
    count: number;
    hits: ScoreHit[];
  };

  /**
   * Processa uma única partida finished:
   * - Filtro grosso (B): se o fingerprint do resultado bate o estado registrado,
   *   pula tudo (0 reads de palpites, 0 writes).
   * - Caso contrário: busca palpites, pontua e grava via filtro fino (A) — só o
   *   palpite cujo `{ status, points }` mudou. Coleta candidatos a notificação.
   */
  async function processMatch(
    match: (typeof finishedMatches)[number],
  ): Promise<MatchResult> {
    const fingerprint = matchResultFingerprint(match);

    // Filtro grosso (B): resultado inalterado → pula a partida inteira.
    if (scoreState.get(match.id) === fingerprint) {
      return {
        matchId: match.id,
        hash: fingerprint,
        processed: false,
        complete: true,
        count: 0,
        hits: [],
      };
    }

    const snapshot = await db
      .collection("predictions")
      .where("matchId", "==", match.id)
      .get();

    // Resolve nomes 1×/partida (não por palpite). Fallback ao código cru
    // quando não resolve (placeholders de mata-mata `1A`/`W1`).
    const homeTeam = resolveTeamByCode(match.homeTeamId)?.name ?? match.homeTeamId;
    const awayTeam = resolveTeamByCode(match.awayTeamId)?.name ?? match.awayTeamId;

    const writes = snapshot.docs.map(
      async (docSnap): Promise<{ count: number; hit: ScoreHit | null; ok: boolean }> => {
        const parsed = predictionSchema.safeParse(docSnap.data());
        if (!parsed.success) {
          // #1 Observabilidade: doc malformado rastreável em produção. `ok: false`
          // impede o hash de avançar (C1): a partida re-processa no próximo run.
          console.warn(
            "[score] doc malformado ignorado:",
            docSnap.ref.path,
            parsed.error.issues,
          );
          return { count: 0, hit: null, ok: false };
        }

        const prediction = parsed.data;
        const computed = scorePrediction(prediction, match);
        const { status, points } = computed;

        // Filtro fino (A): só grava quando o `{ status, points }` recalculado
        // difere do persistido. Palpite nunca pontuado conta como divergência.
        const changed = predictionScoreChanged(
          { status: prediction.status, points: prediction.points },
          computed,
        );
        if (changed) {
          await docSnap.ref.set({ status, points }, { merge: true });
        }

        // Só acerto vira candidato a notificação — derivado do `status` recalculado,
        // independente de ter havido write (RF5; `writeNotifications` dedup por id).
        // Owner-targeting: notifica sempre `prediction.uid` (dono ganhou os pontos),
        // mesmo se lançado por admin. Invariante: `scorePrediction` só retorna
        // `partial` com palpite empate (homeScore === awayScore) quando a partida
        // também terminou empatada — `predictionIsDraw` distingue "acertou empate".
        const hit: ScoreHit | null =
          status === "correct" || status === "partial"
            ? {
                uid: prediction.uid,
                matchId: match.id,
                homeTeam,
                awayTeam,
                result: status,
                predictionIsDraw: prediction.homeScore === prediction.awayScore,
              }
            : null;

        return { count: changed ? 1 : 0, hit, ok: true };
      },
    );

    // Paraleliza todos os set() da partida
    const results = await Promise.all(writes);
    const count = results.reduce((sum, r) => sum + r.count, 0);
    const complete = results.every((r) => r.ok);
    const hits = results
      .map((r) => r.hit)
      .filter((h): h is ScoreHit => h !== null);
    return { matchId: match.id, hash: fingerprint, processed: true, complete, count, hits };
  }

  // Paraleliza o processamento de todas as partidas finished (#2 timeout risk)
  const perMatch = await Promise.all(finishedMatches.map(processMatch));

  const now = new Date();

  const scoredMatches = finishedMatches.length;
  const updatedPredictions = perMatch.reduce((sum, r) => sum + r.count, 0);
  const skippedMatches = perMatch.filter((r) => !r.processed).length;

  // Atualiza o estado de controle só onde o hash mudou; grava 1× se o mapa mudou
  // (BR6: run estável sem mudança ⇒ 0 writes em predictions E em score_state).
  const newState = new Map(scoreState);
  let stateChanged = false;
  for (const r of perMatch) {
    // C1: só avança o hash de partida totalmente parseada. Partida com doc
    // malformado fica de fora → re-processa no próximo run (nunca é congelada).
    if (!r.complete) continue;
    if (newState.get(r.matchId) !== r.hash) {
      newState.set(r.matchId, r.hash);
      stateChanged = true;
    }
  }
  if (stateChanged) {
    await writeScoreState(db, newState, now);
  }

  // Notificações `games` (best-effort, após a pontuação gravada). `now` injetado.
  const allHits = perMatch.flatMap((r) => r.hits);
  await notifyScoreHitsBestEffort(db, allHits, now);

  // Encadeia o recálculo de rankings/estatísticas (best-effort).
  await chainRecalc(request);

  return NextResponse.json(
    { scoredMatches, updatedPredictions, skippedMatches },
    { status: 200 },
  );
}
