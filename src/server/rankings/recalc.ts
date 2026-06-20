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
  type RankedParticipant,
} from "@/features/rankings/lib";
import { predictionSchema, userSchema } from "@/schemas";
import type { Match, RankingEntry } from "@/types";
import type { MatchWithId } from "@/types/matches";

/**
 * Núcleo de recálculo de rankings/estatísticas (PRD-05, TASK-03) extraído do
 * Route Handler para ser reutilizável in-process.
 *
 * Gatilhos do recalc:
 *  1. Edição manual do super_admin (`PUT /api/admin/matches/[id]`) → encadeado
 *     best-effort (`recalcRankingsBestEffort`).
 *  2. On-read dirty-by-finish (`ensureRankingsFresh`): o openfootball PUBLICA
 *     placares (`score.ft` presente → `status: "finished"`, ver mapper). Logo um
 *     jogo finaliza SEM edição manual; o guard de frescor detecta isso comparando
 *     a assinatura dos finalizados (`computeFinishedSignature`) com a do último
 *     recalc (doc `rankings/_freshness`) e recomputa quando diverge.
 *
 * `recalcRankings` recomputa tudo do zero (idempotente): lê palpites crus +
 * partidas efetivas e pontua internamente via `scorePrediction` — NÃO depende dos
 * campos `status/points` persistidos nos palpites.
 */

/**
 * Doc-sentinela de frescor (id fora do conjunto de scopes válidos e da regex de
 * órfãos `pool-*-geral`, então nunca é lido como ranking nem removido na limpeza).
 * Guarda a assinatura dos finalizados do último recalc para o dirty-by-finish.
 */
const FRESHNESS_DOC_ID = "_freshness";

/**
 * Assinatura determinística do conjunto de partidas FINALIZADAS, incluindo o
 * placar de cada uma. Muda quando um jogo novo finaliza (openfootball publica
 * `score.ft`) E também quando um placar já finalizado é corrigido (edição manual).
 * Formato: "{count}:{hash FNV-1a 32-bit hex}" — pequeno o bastante p/ o doc meta.
 */
export function computeFinishedSignature(matches: MatchWithId[]): string {
  const parts = matches
    .filter((m) => m.status === "finished")
    .map((m) => `${m.id}:${m.homeScore}-${m.awayScore}`)
    .sort();
  let h = 0x811c9dc5;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${parts.length}:${(h >>> 0).toString(16)}`;
}

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
/** Contagem por tipo de acerto num escopo (Tela 01). winner/draw = `partial` (5). */
interface ScopeCounts {
  points: number;
  correct: number; // exatos (10)
  winner: number; // acertou vencedor sem placar (partial, palpite ≠ empate)
  draw: number; // acertou empate sem placar (partial, palpite = empate)
  wrong: number;
}

interface UserAgg {
  pointsGeral: number; // ponderado (5/10) — ordena o ranking geral
  correctGeral: number; // exatos — alimenta accuracy/totalCorrect/distribution
  winnerGeral: number; // vencedor sem placar (5) — Tela 01
  drawGeral: number; // empate sem placar (5) — Tela 01
  wrongGeral: number;
  correctByStage: Partial<Record<Stage, number>>; // contagem de EXATOS por fase
  byStageScope: Map<RankingStageScope, ScopeCounts>;
  byGroup: Map<string, ScopeCounts>;
  firstPredictionAt: string | undefined;
  finishedPreds: Array<{ kickoffAt: string; correct: boolean }>;
}

function emptyScopeCounts(): ScopeCounts {
  return { points: 0, correct: 0, winner: 0, draw: 0, wrong: 0 };
}

function emptyAgg(): UserAgg {
  return {
    pointsGeral: 0,
    correctGeral: 0,
    winnerGeral: 0,
    drawGeral: 0,
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
  // Assinatura dos finalizados deste recalc — gravada no doc de frescor para o
  // dirty-by-finish (`ensureRankingsFresh`) detectar mudanças em leituras futuras.
  const finishedSignature = computeFinishedSignature(matches);

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
      // `partial` (5): vencedor sem placar vs empate sem placar — split pelo PALPITE.
      const isWinner = status === "partial" && pred.homeScore !== pred.awayScore;
      const isDraw = status === "partial" && pred.homeScore === pred.awayScore;
      agg.finishedPreds.push({ kickoffAt: match.kickoffAt, correct });

      // Pontos PONDERADOS (5/10) somam ao escopo; acertos EXATOS contam à parte.
      agg.pointsGeral += points;
      if (correct) agg.correctGeral += 1;
      if (isWinner) agg.winnerGeral += 1;
      if (isDraw) agg.drawGeral += 1;
      if (status === "wrong") agg.wrongGeral += 1;
      // correctByStage = contagem de EXATOS por fase (D2); `partial` não entra.
      if (correct) {
        agg.correctByStage[match.stage] = (agg.correctByStage[match.stage] ?? 0) + 1;
      }

      if ((RANKING_STAGE_SCOPES as readonly string[]).includes(match.stage)) {
        const s = match.stage as RankingStageScope;
        const cur = agg.byStageScope.get(s) ?? emptyScopeCounts();
        cur.points += points;
        if (correct) cur.correct += 1;
        if (isWinner) cur.winner += 1;
        if (isDraw) cur.draw += 1;
        if (status === "wrong") cur.wrong += 1;
        agg.byStageScope.set(s, cur);
      }

      if (match.stage === "grupos" && match.groupId) {
        const cur = agg.byGroup.get(match.groupId) ?? emptyScopeCounts();
        cur.points += points;
        if (correct) cur.correct += 1;
        if (isWinner) cur.winner += 1;
        if (isDraw) cur.draw += 1;
        if (status === "wrong") cur.wrong += 1;
        agg.byGroup.set(match.groupId, cur);
      }
    }

    aggByUid.set(user.uid, agg);
  }

  const userByUid = new Map(approved.map((u) => [u.uid, u]));
  const toEntry = (r: RankedParticipant): RankingEntry => {
    const u = userByUid.get(r.uid)!;
    return {
      uid: r.uid,
      nickname: u.nickname,
      name: u.name,
      position: r.position,
      points: r.points,
      // Decomposição dos acertos (Tela 01). Default 0 — participante sem palpites
      // no escopo grava 0, mantendo a entry consistente p/ a UI.
      correct: r.correct ?? 0,
      winner: r.winner ?? 0,
      draw: r.draw ?? 0,
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
  const toBudgetedEntries = (ranked: RankedParticipant[]): RankingEntry[] =>
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
      correct: a.correctGeral,
      winner: a.winnerGeral,
      draw: a.drawGeral,
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
      const a = aggByUid.get(u.uid)!.byStageScope.get(scope) ?? emptyScopeCounts();
      return {
        uid: u.uid,
        points: a.points, // ponderado
        accuracy: computeAccuracy(a.correct, denom), // exatos
        wrong: a.wrong,
        correct: a.correct,
        winner: a.winner,
        draw: a.draw,
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
      const a = aggByUid.get(u.uid)!.byGroup.get(groupId) ?? emptyScopeCounts();
      return {
        uid: u.uid,
        points: a.points, // ponderado
        accuracy: computeAccuracy(a.correct, denom), // exatos
        wrong: a.wrong,
        correct: a.correct,
        winner: a.winner,
        draw: a.draw,
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
        totalPartial: a.winnerGeral + a.drawGeral, // parciais (vencedor + empate)
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

  // ─── 10. Doc de frescor (dirty-by-finish) ──────────────────────────────────
  // Última coisa a entrar no lote: assinatura dos finalizados + timestamp deste
  // recalc. `ensureRankingsFresh` compara contra isto para decidir recomputar.
  writes.push(
    db.collection("rankings").doc(FRESHNESS_DOC_ID).set({
      signature: finishedSignature,
      updatedAt: nowIso,
    }),
  );

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

export interface RecalcPoolSummary {
  poolId: string;
  participants: number;
  finishedMatches: number;
}

/**
 * Recálculo ESCOPADO a um único pool (PRD-09 multi-tenant).
 *
 * Reprocessa só o ranking fechado do pool `poolId` — doc `rankings/pool-{poolId}-geral`,
 * o mesmo servido por `GET /api/rankings/pool` e exibido na Tela 01 (GeneralRanking).
 * Gatilho: botão do group_admin na tela de ranking (`POST /api/group/rankings/recalc`),
 * para corrigir defasagem do próprio pool sem o custo do recalc global (super_admin).
 *
 * Pontuação idêntica à do recalc geral (placar exato = 10, vencedor = 5 via
 * `scorePrediction`), mas a posição é RE-RANKEADA só entre os membros do pool. O
 * denominador de aproveitamento é o de partidas finalizadas GLOBAL (`finishedGeral`),
 * igual ao `geralParticipants` do recalc completo. Idempotente. Lança em falha de
 * fonte de dados (`getEffectiveMatches`) — o chamador trata.
 */
export async function recalcPoolRanking(
  db: Firestore,
  poolId: string,
): Promise<RecalcPoolSummary> {
  const matches = await getEffectiveMatches();
  const finished = matches.filter((m) => m.status === "finished");
  const matchById = new Map(finished.map((m) => [m.id, m]));
  const finishedGeral = finished.length;

  // Membros aprovados do pool. Filtra `groupId` em memória (evita índice composto
  // status+groupId); só este pool é tocado — isolamento multi-tenant (D2).
  const usersSnap = await db
    .collection("users")
    .where("status", "==", "approved")
    .get();
  const members = usersSnap.docs
    .map((d) => {
      const parsed = userSchema.safeParse(d.data());
      if (!parsed.success) {
        console.warn("[recalc-pool] user malformado ignorado:", d.id);
        return null;
      }
      return parsed.data;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null && u.groupId === poolId);

  // Palpites só dos membros — lotes de 10 (limite do operador `in` do Firestore).
  const predsByUid = new Map<string, Array<ReturnType<typeof predictionSchema.parse>>>();
  const uids = members.map((u) => u.uid);
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    if (chunk.length === 0) continue;
    const snap = await db.collection("predictions").where("uid", "in", chunk).get();
    for (const d of snap.docs) {
      const parsed = predictionSchema.safeParse(d.data());
      if (!parsed.success) continue;
      const list = predsByUid.get(parsed.data.uid) ?? [];
      list.push(parsed.data);
      predsByUid.set(parsed.data.uid, list);
    }
  }

  // Agregação ponderada por membro (mesma regra do recalc geral).
  const participants: RankableParticipant[] = members.map((u) => {
    let points = 0;
    let correct = 0; // exatos — alimenta o aproveitamento
    let winner = 0; // acertou vencedor sem placar (5)
    let draw = 0; // acertou empate sem placar (5)
    let wrong = 0;
    let firstPredictionAt: string | undefined;
    for (const pred of predsByUid.get(u.uid) ?? []) {
      if (
        pred.createdAt !== undefined &&
        (firstPredictionAt === undefined || pred.createdAt < firstPredictionAt)
      ) {
        firstPredictionAt = pred.createdAt;
      }
      const match = matchById.get(pred.matchId);
      if (!match) continue; // partida não finalizada / inexistente
      const scored = scorePrediction(pred, match);
      points += scored.points; // ponderado (5/10)
      if (scored.status === "correct") correct += 1; // EXATO
      else if (scored.status === "partial") {
        if (pred.homeScore === pred.awayScore) draw += 1;
        else winner += 1;
      } else if (scored.status === "wrong") wrong += 1;
    }
    return {
      uid: u.uid,
      points,
      accuracy: computeAccuracy(correct, finishedGeral),
      wrong,
      correct,
      winner,
      draw,
      firstPredictionAt,
    };
  });

  const userByUid = new Map(members.map((u) => [u.uid, u]));
  const ranked = rankParticipants(participants);
  const entries: RankingEntry[] = applyAvatarBudget(
    ranked.map((r) => {
      const u = userByUid.get(r.uid)!;
      return {
        uid: r.uid,
        nickname: u.nickname,
        name: u.name,
        position: r.position,
        points: r.points,
        correct: r.correct ?? 0,
        winner: r.winner ?? 0,
        draw: r.draw ?? 0,
        wrong: r.wrong,
        accuracy: r.accuracy,
        ...(u.avatarUrl !== undefined ? { avatarUrl: u.avatarUrl } : {}),
      };
    }),
  );

  await db.collection("rankings").doc(`pool-${poolId}-geral`).set({
    scope: "geral",
    updatedAt: new Date().toISOString(),
    entries,
  });

  return {
    poolId,
    participants: members.length,
    finishedMatches: finished.length,
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
 * Recalc-on-read DIRTY-BY-FINISH: recomputa quando o conjunto de partidas
 * finalizadas mudou desde o último recalc — cobre o caso em que o openfootball
 * publica um placar (`score.ft`) SEM edição manual (era o bug: o cold-start puro
 * deixava o ranking congelado após a 1ª população).
 *
 * Compara a assinatura dos finalizados atuais (`computeFinishedSignature`) com a
 * gravada no doc `rankings/_freshness` pelo último recalc:
 *  - doc ausente (cold start) OU assinatura divergente → recomputa tudo;
 *  - assinatura igual → no-op (pula a agregação cara; só pagou 1 fetch + 1 read).
 *
 * Best-effort: nunca lança. Falha lendo a fonte/Firestore → serve o que já existe.
 */
export async function ensureRankingsFresh(db: Firestore): Promise<void> {
  let matches: MatchWithId[];
  try {
    matches = await getEffectiveMatches();
  } catch (err) {
    console.error("[rankings] falha lendo partidas efetivas no ensureFresh:", err);
    return; // sem dados frescos não há como decidir — serve o doc existente
  }

  const currentSignature = computeFinishedSignature(matches);

  let freshSnap;
  try {
    freshSnap = await db.collection("rankings").doc(FRESHNESS_DOC_ID).get();
  } catch (err) {
    console.error("[rankings] falha lendo doc de frescor no ensureFresh:", err);
    return;
  }

  // Fresco só quando o doc existe E a assinatura bate — nada mudou desde o recalc.
  if (freshSnap.exists && freshSnap.data()?.["signature"] === currentSignature) {
    return;
  }

  // Cold start OU novo placar finalizado (openfootball/edição) → recomputa.
  try {
    await recalcRankings(db);
  } catch (err) {
    console.error("[rankings] recalc (dirty-by-finish) falhou:", err);
  }
}
