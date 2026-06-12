import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { applyAvatarBudget } from "@/server/rankings/avatarBudget";
import { scorePrediction } from "@/features/predictions/lib";
import {
  buildDistribution,
  computeAccuracy,
  rankParticipants,
  type RankableParticipant,
} from "@/features/rankings/lib";
import { predictionSchema, userSchema } from "@/schemas";
import type { Match, RankingEntry } from "@/types";

/**
 * Núcleo de recálculo de rankings/estatísticas (PRD-05, TASK-03) extraído do
 * Route Handler para ser reutilizável in-process.
 *
 * Gatilho real (PRD-11): o placar entra SÓ por edição manual do super_admin
 * (`PUT /api/admin/matches/[id]`) — o openfootball não envia placares. Por isso o
 * recalc é encadeado nesse save (best-effort, `recalcRankingsBestEffort`). O
 * `ensureRankingsFresh` cobre só o cold start (popula o doc se ainda não existe).
 *
 * `recalcRankings` recomputa tudo do zero (idempotente): lê palpites crus +
 * partidas efetivas e pontua internamente via `scorePrediction` — NÃO depende dos
 * campos `status/points` persistidos nos palpites.
 */

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

/**
 * Acumulador por usuário (TASK-03 — regra ponderada).
 * Mantém DOIS números por escopo: pontos PONDERADOS (5/10) para a "pontuação"
 * do ranking, e contagem de acertos EXATOS (`status === "correct"`) para
 * aproveitamento/streak/distribuição (D2/R3/R4). `partial` soma só ao primeiro.
 */
interface UserAgg {
  pointsGeral: number; // ponderado (5/10) — ordena o ranking geral
  correctGeral: number; // exatos — alimenta accuracy/totalCorrect/distribution
  wrongGeral: number;
  correctByStage: Partial<Record<Stage, number>>; // contagem de EXATOS por fase
  byStageScope: Map<RankingStageScope, { points: number; correct: number; wrong: number }>;
  byGroup: Map<string, { points: number; correct: number; wrong: number }>;
  firstPredictionAt: string | undefined;
  finishedPreds: Array<{ kickoffAt: string; correct: boolean }>;
}

function emptyAgg(): UserAgg {
  return {
    pointsGeral: 0,
    correctGeral: 0,
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

export interface RecalcSummary {
  scopes: number;
  groups: number;
  pools: number;
  participants: number;
  finishedMatches: number;
  statisticsUpdated: number;
}

/**
 * Agregação completa de rankings, pools, fases, grupos, estatísticas e pool_stats.
 * Idempotente (função pura de pontuação + `set`/`merge`). Lança em falha de fonte
 * de dados (`getEffectiveMatches`) — o chamador decide o tratamento.
 */
export async function recalcRankings(db: Firestore): Promise<RecalcSummary> {
  // ─── 1. Buscar partidas finalizadas ────────────────────────────────────────
  const matches = await getEffectiveMatches();

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

  // ─── 2. Usuários aprovados ─────────────────────────────────────────────────
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

  // ─── 3. Predictions agrupadas por uid ──────────────────────────────────────
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

  // ─── 4. Agregação por usuário ──────────────────────────────────────────────
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
      const correct = status === "correct"; // EXATO (10). `partial` (5) NÃO é correct.
      agg.finishedPreds.push({ kickoffAt: match.kickoffAt, correct });

      // Pontos PONDERADOS (5/10) somam ao escopo; acertos EXATOS contam à parte.
      agg.pointsGeral += points;
      if (correct) agg.correctGeral += 1;
      if (status === "wrong") agg.wrongGeral += 1;
      // correctByStage = contagem de EXATOS por fase (D2); `partial` não entra.
      if (correct) {
        agg.correctByStage[match.stage] = (agg.correctByStage[match.stage] ?? 0) + 1;
      }

      if ((RANKING_STAGE_SCOPES as readonly string[]).includes(match.stage)) {
        const s = match.stage as RankingStageScope;
        const cur = agg.byStageScope.get(s) ?? { points: 0, correct: 0, wrong: 0 };
        cur.points += points;
        if (correct) cur.correct += 1;
        if (status === "wrong") cur.wrong += 1;
        agg.byStageScope.set(s, cur);
      }

      if (match.stage === "grupos" && match.groupId) {
        const cur = agg.byGroup.get(match.groupId) ?? { points: 0, correct: 0, wrong: 0 };
        cur.points += points;
        if (correct) cur.correct += 1;
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
      // TASK-05: foto real (PRD-06). Incluída só quando o usuário tem avatar; o
      // orçamento por doc (`applyAvatarBudget`) pode omiti-la depois (R2/D4).
      ...(u.avatarUrl !== undefined ? { avatarUrl: u.avatarUrl } : {}),
    };
  };

  /**
   * Monta as entries de um doc de ranking a partir dos participantes já rankeados
   * (ordenados por posição) e aplica o orçamento de avatares por documento (TASK-05).
   */
  const toBudgetedEntries = (ranked: Array<{ uid: string; position: number; points: number; wrong: number; accuracy: number }>): RankingEntry[] =>
    applyAvatarBudget(ranked.map(toEntry));

  const nowIso = new Date().toISOString();
  const writes: Array<Promise<unknown>> = [];

  // ─── 5. Ranking geral ──────────────────────────────────────────────────────
  const geralParticipants: RankableParticipant[] = approved.map((u) => {
    const a = aggByUid.get(u.uid)!;
    return {
      uid: u.uid,
      points: a.pointsGeral, // ponderado (ordena o ranking)
      accuracy: computeAccuracy(a.correctGeral, finishedGeral), // exatos
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
      entries: toBudgetedEntries(geralRanked),
    }),
  );

  // ─── 5.1 Rankings por pool (multi-tenant, PRD-09 TASK-10) ──────────────────
  // Mesma pontuação geral (acertos do usuário são absolutos), mas RE-RANKEADA
  // dentro de cada pool: a posição é relativa só aos membros do mesmo `groupId`.
  // Consumido pelo GET /api/rankings/pool (ranking fechado por pool) e por
  // GET /api/group/users/approved. Usuário sem `groupId` fica de fora — não há
  // pool a que pertencer (e nunca aparece no ranking de outro grupo).
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
        entries: toBudgetedEntries(rankParticipants(participants)),
      }),
    );
    poolsWritten += 1;
  }

  // Limpa docs de pool ÓRFÃOS (HG-02): pools que perderam todos os membros — ex.:
  // usuário movido p/ outro pool, último membro removido/bloqueado. Sem isso,
  // GET /api/rankings/pool serviria entries stale de um pool já vazio.
  const existingRankingDocs = await db.collection("rankings").get();
  for (const d of existingRankingDocs.docs) {
    const m = /^pool-(.+)-geral$/.exec(d.id);
    if (m && m[1] && !poolMembers.has(m[1])) {
      writes.push(d.ref.delete());
    }
  }

  // ─── 6. Rankings por fase (5) ──────────────────────────────────────────────
  let scopesWritten = 1;
  for (const scope of RANKING_STAGE_SCOPES) {
    const denom = finishedByStage.get(scope) ?? 0;
    const participants: RankableParticipant[] = approved.map((u) => {
      const a = aggByUid.get(u.uid)!.byStageScope.get(scope) ?? { points: 0, correct: 0, wrong: 0 };
      return {
        uid: u.uid,
        points: a.points, // ponderado
        accuracy: computeAccuracy(a.correct, denom), // exatos
        wrong: a.wrong,
        firstPredictionAt: aggByUid.get(u.uid)!.firstPredictionAt,
      };
    });
    writes.push(
      db.collection("rankings").doc(scope).set({
        scope,
        updatedAt: nowIso,
        entries: toBudgetedEntries(rankParticipants(participants)),
      }),
    );
    scopesWritten += 1;
  }

  // ─── 7. Rankings por grupo ─────────────────────────────────────────────────
  let groupsWritten = 0;
  for (const [groupId, denom] of finishedByGroup) {
    const participants: RankableParticipant[] = approved.map((u) => {
      const a = aggByUid.get(u.uid)!.byGroup.get(groupId) ?? { points: 0, correct: 0, wrong: 0 };
      return {
        uid: u.uid,
        points: a.points, // ponderado
        accuracy: computeAccuracy(a.correct, denom), // exatos
        wrong: a.wrong,
        firstPredictionAt: aggByUid.get(u.uid)!.firstPredictionAt,
      };
    });
    writes.push(
      db.collection("rankings").doc(`grupo-${groupId}`).set({
        groupId,
        updatedAt: nowIso,
        entries: toBudgetedEntries(rankParticipants(participants)),
      }),
    );
    groupsWritten += 1;
  }

  // ─── 8. Statistics por usuário (com positionHistory) ───────────────────────
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
        totalCorrect: a.correctGeral, // EXATOS (não pontos ponderados)
        totalWrong: a.wrongGeral,
        accuracy: computeAccuracy(a.correctGeral, finishedGeral), // exatos
        longestStreak: longestStreak(a.finishedPreds),
        correctByStage: a.correctByStage,
        positionHistory,
      },
      { merge: true },
    );
  });
  writes.push(...statsWrites);

  // ─── 9. Pool stats ─────────────────────────────────────────────────────────
  // D2: highest/lowest/averagePoints = PONDERADO ("pontos"); totalCorrect e
  // distribution = EXATOS (acertos de placar). Duas listas distintas.
  const pointsList = approved.map((u) => aggByUid.get(u.uid)!.pointsGeral); // ponderado
  const correctList = approved.map((u) => aggByUid.get(u.uid)!.correctGeral); // exatos
  const totalCorrect = correctList.reduce((s, c) => s + c, 0); // exatos
  const sumPoints = pointsList.reduce((s, p) => s + p, 0); // ponderado (p/ média)
  const highestPoints = pointsList.length > 0 ? Math.max(...pointsList) : 0;
  const lowestPoints = pointsList.length > 0 ? Math.min(...pointsList) : 0;
  const averagePoints = pointsList.length > 0 ? sumPoints / pointsList.length : 0;
  const leader = geralRanked[0];
  const poolStats = {
    updatedAt: nowIso,
    totalParticipants: approved.length,
    highestPoints, // ponderado
    ...(leader && approved.length > 0 ? { highestPointsName: userByUid.get(leader.uid)!.name } : {}),
    lowestPoints, // ponderado
    averagePoints, // ponderado
    totalCorrect, // EXATOS
    distribution: buildDistribution(correctList, finishedGeral), // EXATOS (D2)
  };
  writes.push(db.collection("pool_stats").doc("current").set(poolStats));

  await Promise.all(writes);

  return {
    scopes: scopesWritten,
    groups: groupsWritten,
    pools: poolsWritten,
    participants: approved.length,
    finishedMatches: finished.length,
    statisticsUpdated: approved.length,
  };
}

/**
 * Recalcula best-effort (nunca lança). Use após gravar um resultado
 * (`PUT/DELETE /api/admin/matches/[id]`): mantém o ranking fresco em segundos sem
 * derrubar o save se o recálculo falhar.
 */
export async function recalcRankingsBestEffort(db: Firestore): Promise<void> {
  try {
    await recalcRankings(db);
  } catch (err) {
    console.error("[rankings] recalc (best-effort) falhou:", err);
  }
}

/**
 * Cold start (recalc-on-read): popula os docs de ranking SE ainda não existem.
 * A frescura corrente é mantida pelo encadeamento no save do resultado
 * (`recalcRankingsBestEffort`), não aqui — se `rankings/geral` já existe, no-op.
 * Best-effort: nunca lança.
 */
export async function ensureRankingsFresh(db: Firestore): Promise<void> {
  let snap;
  try {
    snap = await db.collection("rankings").doc("geral").get();
  } catch (err) {
    console.error("[rankings] falha lendo rankings/geral no ensureFresh:", err);
    return;
  }

  if (snap.exists) return; // já populado — o save do resultado mantém fresco

  try {
    await recalcRankings(db);
  } catch (err) {
    console.error("[rankings] recalc inicial (cold start) falhou:", err);
  }
}
