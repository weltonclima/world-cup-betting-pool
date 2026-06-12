import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { scorePrediction } from "@/features/predictions/lib";
import {
  buildDistribution,
  computeAccuracy,
  rankParticipants,
  type RankableParticipant,
} from "@/features/rankings/lib";
import { predictionSchema, userSchema } from "@/schemas";
import type { Match, MatchWithId, RankingEntry } from "@/types";
import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { safeSecretEqual } from "../../_lib/secret";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fases que possuem ranking próprio (PRD-05). Exclui dezesseis-avos e terceiro. */
const RANKING_STAGE_SCOPES = [
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
] as const;
type RankingStageScope = (typeof RANKING_STAGE_SCOPES)[number];

type Stage = Match["stage"];

/** Acumulador por usuário. */
interface UserAgg {
  pointsGeral: number;
  wrongGeral: number;
  correctByStage: Partial<Record<Stage, number>>;
  byStageScope: Map<RankingStageScope, { points: number; wrong: number }>;
  byGroup: Map<string, { points: number; wrong: number }>;
  firstPredictionAt: string | undefined;
  finishedPreds: Array<{ kickoffAt: string; correct: boolean }>;
}

function emptyAgg(): UserAgg {
  return {
    pointsGeral: 0,
    wrongGeral: 0,
    correctByStage: {},
    byStageScope: new Map(),
    byGroup: new Map(),
    firstPredictionAt: undefined,
    finishedPreds: [],
  };
}

/** Maior sequência de acertos consecutivos (ordem cronológica por kickoff). */
function longestStreak(preds: Array<{ kickoffAt: string; correct: boolean }>): number {
  const ordered = [...preds].sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
  let max = 0;
  let run = 0;
  for (const p of ordered) {
    if (p.correct) {
      run += 1;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  return max;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Autorização: header secret (cron) OU sessão admin ──────────────────
  const cronSecret = process.env["RANKINGS_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");

  let authorized = safeSecretEqual(cronSecret, headerSecret);

  const db = getAdminFirestore();

  if (!authorized) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (userSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    authorized = true;
  }

  // ─── 2. Buscar partidas finalizadas ────────────────────────────────────────
  let matches: MatchWithId[];
  try {
    matches = await getEffectiveMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }

  const finished = matches.filter((m) => m.status === "finished");
  const matchById = new Map(finished.map((m) => [m.id, m]));

  // Denominadores de aproveitamento (partidas finalizadas elegíveis ao escopo).
  const finishedGeral = finished.length;
  const finishedByStage = new Map<RankingStageScope, number>();
  const finishedByGroup = new Map<string, number>();
  for (const m of finished) {
    if ((RANKING_STAGE_SCOPES as readonly string[]).includes(m.stage)) {
      const s = m.stage as RankingStageScope;
      finishedByStage.set(s, (finishedByStage.get(s) ?? 0) + 1);
    }
    if (m.stage === "grupos" && m.groupId) {
      finishedByGroup.set(m.groupId, (finishedByGroup.get(m.groupId) ?? 0) + 1);
    }
  }

  // ─── 3. Usuários aprovados ─────────────────────────────────────────────────
  const usersSnap = await db
    .collection("users")
    .where("status", "==", "approved")
    .get();
  const approved = usersSnap.docs
    .map((d) => {
      const parsed = userSchema.safeParse(d.data());
      if (!parsed.success) {
        console.warn("[recalc] user malformado ignorado:", d.id, parsed.error.issues);
        return null;
      }
      return parsed.data;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  // ─── 4. Predictions agrupadas por uid ──────────────────────────────────────
  const predSnap = await db.collection("predictions").get();
  const predsByUid = new Map<string, Array<ReturnType<typeof predictionSchema.parse>>>();
  for (const d of predSnap.docs) {
    const parsed = predictionSchema.safeParse(d.data());
    if (!parsed.success) {
      console.warn("[recalc] prediction malformada ignorada:", d.id, parsed.error.issues);
      continue;
    }
    const list = predsByUid.get(parsed.data.uid) ?? [];
    list.push(parsed.data);
    predsByUid.set(parsed.data.uid, list);
  }

  // ─── 5. Agregação por usuário ──────────────────────────────────────────────
  const aggByUid = new Map<string, UserAgg>();
  for (const user of approved) {
    const agg = emptyAgg();
    const userPreds = predsByUid.get(user.uid) ?? [];

    for (const pred of userPreds) {
      // firstPredictionAt = menor createdAt (considera todos os palpites).
      if (pred.createdAt !== undefined) {
        if (agg.firstPredictionAt === undefined || pred.createdAt < agg.firstPredictionAt) {
          agg.firstPredictionAt = pred.createdAt;
        }
      }

      const match = matchById.get(pred.matchId);
      if (!match) continue; // partida não finalizada / inexistente

      const { status, points } = scorePrediction(pred, match);
      const correct = status === "correct";
      agg.finishedPreds.push({ kickoffAt: match.kickoffAt, correct });

      agg.pointsGeral += points;
      if (status === "wrong") agg.wrongGeral += 1;
      if (points > 0) {
        agg.correctByStage[match.stage] = (agg.correctByStage[match.stage] ?? 0) + points;
      }

      if ((RANKING_STAGE_SCOPES as readonly string[]).includes(match.stage)) {
        const s = match.stage as RankingStageScope;
        const cur = agg.byStageScope.get(s) ?? { points: 0, wrong: 0 };
        cur.points += points;
        if (status === "wrong") cur.wrong += 1;
        agg.byStageScope.set(s, cur);
      }

      if (match.stage === "grupos" && match.groupId) {
        const cur = agg.byGroup.get(match.groupId) ?? { points: 0, wrong: 0 };
        cur.points += points;
        if (status === "wrong") cur.wrong += 1;
        agg.byGroup.set(match.groupId, cur);
      }
    }

    aggByUid.set(user.uid, agg);
  }

  const userByUid = new Map(approved.map((u) => [u.uid, u]));
  const toEntry = (r: { uid: string; position: number; points: number; wrong: number; accuracy: number }): RankingEntry => {
    const u = userByUid.get(r.uid)!;
    return {
      uid: r.uid,
      nickname: u.nickname,
      name: u.name,
      position: r.position,
      points: r.points,
      wrong: r.wrong,
      accuracy: r.accuracy,
    };
  };

  const nowIso = new Date().toISOString();
  const writes: Array<Promise<unknown>> = [];

  // ─── 6. Ranking geral ──────────────────────────────────────────────────────
  const geralParticipants: RankableParticipant[] = approved.map((u) => {
    const a = aggByUid.get(u.uid)!;
    return {
      uid: u.uid,
      points: a.pointsGeral,
      accuracy: computeAccuracy(a.pointsGeral, finishedGeral),
      wrong: a.wrongGeral,
      firstPredictionAt: a.firstPredictionAt,
    };
  });
  const geralRanked = rankParticipants(geralParticipants);
  const geralPositionByUid = new Map(geralRanked.map((r) => [r.uid, r.position]));
  writes.push(
    db.collection("rankings").doc("geral").set({
      scope: "geral",
      updatedAt: nowIso,
      entries: geralRanked.map(toEntry),
    }),
  );

  // ─── 6.1 Rankings por pool (multi-tenant, PRD-09 TASK-10) ──────────────────
  // Mesma pontuação geral (acertos do usuário são absolutos), mas RE-RANKEADA
  // dentro de cada pool: a posição é relativa só aos membros do mesmo `groupId`.
  // Consumido por GET /api/group/users/approved, que lê `rankings/pool-{id}-geral`
  // (D5: lê, não recalcula). Usuário sem `groupId` (legado pré-backfill) fica de
  // fora — não há pool a que pertencer.
  const geralByUid = new Map(geralParticipants.map((p) => [p.uid, p]));
  const poolMembers = new Map<string, RankableParticipant[]>();
  for (const u of approved) {
    if (!u.groupId) continue;
    const list = poolMembers.get(u.groupId) ?? [];
    list.push(geralByUid.get(u.uid)!);
    poolMembers.set(u.groupId, list);
  }
  let poolsWritten = 0;
  for (const [poolId, participants] of poolMembers) {
    writes.push(
      db.collection("rankings").doc(`pool-${poolId}-geral`).set({
        scope: "geral",
        updatedAt: nowIso,
        entries: rankParticipants(participants).map(toEntry),
      }),
    );
    poolsWritten += 1;
  }

  // ─── 7. Rankings por fase (5) ──────────────────────────────────────────────
  let scopesWritten = 1;
  for (const scope of RANKING_STAGE_SCOPES) {
    const denom = finishedByStage.get(scope) ?? 0;
    const participants: RankableParticipant[] = approved.map((u) => {
      const a = aggByUid.get(u.uid)!.byStageScope.get(scope) ?? { points: 0, wrong: 0 };
      return {
        uid: u.uid,
        points: a.points,
        accuracy: computeAccuracy(a.points, denom),
        wrong: a.wrong,
        firstPredictionAt: aggByUid.get(u.uid)!.firstPredictionAt,
      };
    });
    writes.push(
      db.collection("rankings").doc(scope).set({
        scope,
        updatedAt: nowIso,
        entries: rankParticipants(participants).map(toEntry),
      }),
    );
    scopesWritten += 1;
  }

  // ─── 8. Rankings por grupo ─────────────────────────────────────────────────
  let groupsWritten = 0;
  for (const [groupId, denom] of finishedByGroup) {
    const participants: RankableParticipant[] = approved.map((u) => {
      const a = aggByUid.get(u.uid)!.byGroup.get(groupId) ?? { points: 0, wrong: 0 };
      return {
        uid: u.uid,
        points: a.points,
        accuracy: computeAccuracy(a.points, denom),
        wrong: a.wrong,
        firstPredictionAt: aggByUid.get(u.uid)!.firstPredictionAt,
      };
    });
    writes.push(
      db.collection("rankings").doc(`grupo-${groupId}`).set({
        groupId,
        updatedAt: nowIso,
        entries: rankParticipants(participants).map(toEntry),
      }),
    );
    groupsWritten += 1;
  }

  // ─── 9. Statistics por usuário (com positionHistory) ───────────────────────
  const statsWrites = approved.map(async (u) => {
    const a = aggByUid.get(u.uid)!;
    const existingSnap = await db.collection("statistics").doc(u.uid).get();
    const existing = existingSnap.exists ? existingSnap.data() : undefined;
    const prevHistory = Array.isArray(existing?.["positionHistory"])
      ? (existing!["positionHistory"] as Array<Record<string, unknown>>)
      : [];
    const prevMaxRound = prevHistory.reduce(
      (max, h) => (typeof h["round"] === "number" && h["round"] > max ? (h["round"] as number) : max),
      0,
    );
    const newPosition = geralPositionByUid.get(u.uid) ?? 1;
    // Só registra novo ponto quando a posição geral MUDOU em relação ao último
    // snapshot (TASK-14, WR-02 da TASK-03): evita poluir a Tela 04 e o crescimento
    // ilimitado do histórico quando o recalc roda sem mudança de estado.
    const last = prevHistory[prevHistory.length - 1];
    const positionUnchanged =
      last !== undefined &&
      last["scope"] === "geral" &&
      typeof last["position"] === "number" &&
      last["position"] === newPosition;
    const positionHistory = positionUnchanged
      ? prevHistory
      : [
          ...prevHistory,
          {
            at: nowIso,
            scope: "geral" as const,
            position: newPosition,
            round: prevMaxRound + 1,
          },
        ];

    await db.collection("statistics").doc(u.uid).set(
      {
        uid: u.uid,
        totalCorrect: a.pointsGeral,
        totalWrong: a.wrongGeral,
        accuracy: computeAccuracy(a.pointsGeral, finishedGeral),
        longestStreak: longestStreak(a.finishedPreds),
        correctByStage: a.correctByStage,
        positionHistory,
      },
      { merge: true },
    );
  });
  writes.push(...statsWrites);

  // ─── 10. Pool stats ────────────────────────────────────────────────────────
  const pointsList = approved.map((u) => aggByUid.get(u.uid)!.pointsGeral);
  const totalCorrect = pointsList.reduce((s, p) => s + p, 0);
  const highestPoints = pointsList.length > 0 ? Math.max(...pointsList) : 0;
  const lowestPoints = pointsList.length > 0 ? Math.min(...pointsList) : 0;
  const averagePoints = pointsList.length > 0 ? totalCorrect / pointsList.length : 0;
  const leader = geralRanked[0];
  const poolStats = {
    updatedAt: nowIso,
    totalParticipants: approved.length,
    highestPoints,
    ...(leader && approved.length > 0 ? { highestPointsName: userByUid.get(leader.uid)!.name } : {}),
    lowestPoints,
    averagePoints,
    totalCorrect,
    distribution: buildDistribution(pointsList, finishedGeral),
  };
  writes.push(db.collection("pool_stats").doc("current").set(poolStats));

  await Promise.all(writes);

  return NextResponse.json(
    {
      scopes: scopesWritten,
      groups: groupsWritten,
      pools: poolsWritten,
      participants: approved.length,
      finishedMatches: finished.length,
      statisticsUpdated: approved.length,
    },
    { status: 200 },
  );
}
