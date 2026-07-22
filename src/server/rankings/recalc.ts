import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { DEFAULT_CHAMPIONSHIP_ID, getChampionship } from "@/server/copaData/championshipCatalog";
import { loadChampionshipStatuses } from "@/server/copaData/championshipState";
import { applyAvatarBudget } from "@/server/rankings/avatarBudget";
import { championshipScope } from "@/server/rankings/championshipScope";
import {
  aggregateChampionshipScopes,
  type ChampionshipScopeSource,
} from "@/server/rankings/aggregateScopes";
import { getEnabledChampionships } from "@/lib/poolChampionships";
import { scorePrediction, type ScoreOptions } from "@/features/predictions/lib";
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
import type { Pool } from "@/types/pools";

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
 * Versão do FORMATO persistido pelo recalc (entries de `rankings/*`, `statistics/*`,
 * `pool_stats`). Faz par com a assinatura no gate de frescor: a assinatura detecta
 * mudança de DADOS (novo placar finalizado); a versão detecta mudança de SHAPE
 * (campos novos) num deploy que NÃO mexe em partida finalizada.
 *
 * Sem isso, um deploy que adiciona campos não invalida a assinatura → `ensureRankingsFresh`
 * vira no-op → docs stale (sem o campo novo) seguem servidos → a UI cai em 0 (ex.: A/V/E
 * no ranking, totalPartial no hero da Home). Bumpe esta constante ao mudar o shape: o
 * próximo read força UM recalc que regrava tudo no formato novo, depois estabiliza.
 *
 * Histórico:
 *  1 (implícito, docs sem o campo `version`) — formato base {uid,nickname,position,points,...}.
 *  2 — + correct/winner/draw na entry (Tela 01) e totalPartial em statistics (commit 89eeca3).
 *  3 — + docs por pool nas fases e grupos da Copa (`pool-{poolId}-{scope}`,
 *      `pool-{poolId}-grupo-{groupId}`): isolamento multi-tenant da Tela 03 (PRD-09).
 *  4 — + ranking agregado das eliminatórias (`rankings/eliminatorias` e
 *      `pool-{poolId}-eliminatorias`): soma das 5 fases mata-mata incl. dezesseis-avos
 *      (PRD-16 / TASK-02).
 *  5 — + rankings `geral` por campeonato habilitado NÃO-legado (`rankings/{C}-geral`
 *      global e `pool-{poolId}-{C}-geral` por pool que habilitou): scoring multi-championship
 *      (multi-championship-launch / TASK-11). Copa legada segue nos escopos bare (sem regressão).
 *  6 — + ranking `geral` AGREGADO por pool (`pool-{poolId}-agregado`): soma bruta dos pontos
 *      do membro entre os campeonatos pontuáveis que o pool habilita (Copa legada + ligas
 *      ativas). Escrito só quando o pool tem ≥2 campeonatos pontuáveis (multi-championship-launch
 *      / TASK-12). Modo `geral` da pool serve este doc; `por-campeonato` serve por campeonato.
 */
export const RECALC_VERSION = 6;

/**
 * Scope do ranking `geral` AGREGADO por pool (`pool-{poolId}-agregado`, TASK-12).
 * Não é uma fase da Copa (não entra em RANKING_STAGE_SCOPES) nem carrega
 * `championshipId` — é a soma bruta entre campeonatos habilitados do pool.
 */
export const AGGREGATE_SCOPE = "agregado";

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
const RANKING_STAGE_SCOPES = ["grupos", "oitavas", "quartas", "semifinal", "final"] as const;
type RankingStageScope = (typeof RANKING_STAGE_SCOPES)[number];

/**
 * Fases mata-mata que compõem o AGREGADO `eliminatorias` (PRD-16 / TASK-02).
 * Inclui `dezesseis-avos`, que NÃO está em `RANKING_STAGE_SCOPES` (sem card de
 * fase próprio na Copa 2026) — por isso o agregado precisa de path próprio e
 * NÃO pode ser derivado de `byStageScope` (que dropparia dezesseis-avos, D2).
 */
const ELIMINATION_STAGES = ["dezesseis-avos", "oitavas", "quartas", "semifinal", "final"] as const;
const ELIMINATION_SCOPE = "eliminatorias" as const;

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
  byElimination: ScopeCounts; // AGREGADO das 5 fases mata-mata (incl. dezesseis-avos)
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
    byElimination: emptyScopeCounts(),
    byGroup: new Map(),
    firstPredictionAt: undefined,
    finishedPreds: [],
  };
}

/**
 * Agrega os palpites finalizados de UM usuário num `UserAgg` (todos os scopes:
 * geral, fases, eliminatórias, grupos, streak, firstPredictionAt). Pura.
 *
 * `options` é repassado a `scorePrediction`: sem options (default) reproduz
 * EXATAMENTE o comportamento anterior (placar final) — usado no recalc global e
 * nos docs globais. Com `{ ignoreOvertimeGoals: true }` pontua eliminatórias com
 * prorrogação pelo placar de 90min — usado por pool flagged (TASK-03).
 */
function aggregateUser(
  userPreds: Array<ReturnType<typeof predictionSchema.parse>>,
  matchById: Map<string, MatchWithId>,
  options?: ScoreOptions,
): UserAgg {
  const agg = emptyAgg();

  for (const pred of userPreds) {
    // firstPredictionAt = menor createdAt (considera todos os palpites).
    if (pred.createdAt !== undefined) {
      if (agg.firstPredictionAt === undefined || pred.createdAt < agg.firstPredictionAt) {
        agg.firstPredictionAt = pred.createdAt;
      }
    }

    const match = matchById.get(pred.matchId);
    if (!match) continue; // partida não finalizada / inexistente

    const { status, points } = scorePrediction(pred, match, options);
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

    // AGREGADO eliminatórias: path próprio (inclui dezesseis-avos, fora de
    // RANKING_STAGE_SCOPES). NÃO derivar de byStageScope (dropparia 16-avos, D2).
    if ((ELIMINATION_STAGES as readonly string[]).includes(match.stage)) {
      const el = agg.byElimination;
      el.points += points;
      if (correct) el.correct += 1;
      if (isWinner) el.winner += 1;
      if (isDraw) el.draw += 1;
      if (status === "wrong") el.wrong += 1;
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

  return agg;
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

/**
 * Delta de posição por usuário (TASK-05) — entrada do disparo `ranking`.
 * `previousPosition: undefined` = sem baseline (1º recalc / sem histórico ou doc
 * de pool prévio) → o helper NÃO notifica (não inventa "subiu" no marco zero).
 */
export interface RankingPositionDelta {
  uid: string;
  previousPosition: number | undefined;
  newPosition: number;
}

export interface RecalcSummary {
  scopes: number;
  groups: number;
  pools: number;
  participants: number;
  finishedMatches: number;
  statisticsUpdated: number;
  /**
   * Campeonatos NÃO-legados pontuados neste recalc (TASK-11). Aditivo — a Copa
   * legada (escopos bare) não conta aqui. `0` quando nenhum pool habilitou outro
   * campeonato ou todas as fontes extras falharam (best-effort).
   */
  championshipsProcessed: number;
  /**
   * Docs de ranking `geral` AGREGADO escritos (`pool-{poolId}-agregado`, TASK-12) —
   * um por pool com ≥2 campeonatos pontuáveis. `0` quando nenhum pool agrega.
   */
  aggregatesWritten: number;
  /**
   * Delta geral (global) por usuário — `previousPosition` = última posição `geral`
   * do `positionHistory`; `newPosition` = posição recém-rankeada. Aditivo: derivado
   * do que o loop de statistics já computa, sem novo fetch/write.
   */
  deltas: RankingPositionDelta[];
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
  // Denominador do agregado: finalizadas em TODAS as 5 stages mata-mata (incl.
  // dezesseis-avos) — casa com o numerador de exatos do `byElimination` (D2).
  let finishedElimination = 0;
  for (const m of finished) {
    if ((RANKING_STAGE_SCOPES as readonly string[]).includes(m.stage)) {
      const s = m.stage as RankingStageScope;
      finishedByStage.set(s, (finishedByStage.get(s) ?? 0) + 1);
    }
    if ((ELIMINATION_STAGES as readonly string[]).includes(m.stage)) {
      finishedElimination += 1;
    }
    if (m.stage === "grupos" && m.groupId) {
      finishedByGroup.set(m.groupId, (finishedByGroup.get(m.groupId) ?? 0) + 1);
    }
  }

  // ─── 2. Usuários aprovados ─────────────────────────────────────────────────
  const usersSnap = await db.collection("users").where("status", "==", "approved").get();
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

  // ─── 4. Agregação por usuário (GLOBAL, placar final) ───────────────────────
  // Sem options → placar final. Alimenta TODOS os docs globais (geral, fases,
  // grupos, eliminatórias) — comportamento inalterado.
  const aggByUid = new Map<string, UserAgg>();
  for (const user of approved) {
    aggByUid.set(user.uid, aggregateUser(predsByUid.get(user.uid) ?? [], matchById));
  }

  // ─── 4.1 Flags de pool + re-agregação por pool flagged (TASK-03) ───────────
  // Pools com `ignoreOvertimeGoals === true` pontuam eliminatórias com
  // prorrogação pelo placar de 90min. Leitura tolerante (flag ausente/false = OFF;
  // pool malformado não quebra o recalc). Re-agrega só os membros desses pools.
  const flaggedPoolIds = new Set<string>();
  // TASK-11: campeonatos habilitados por pool (default de leitura = só Copa). Alimenta
  // o cleanup de órfão dos escopos por campeonato E os writes por campeonato (§7.5).
  const enabledByPool = new Map<string, string[]>();
  try {
    const poolsSnap = await db.collection("pools").get();
    for (const d of poolsSnap.docs) {
      const data = d.data();
      if ((data as { ignoreOvertimeGoals?: unknown }).ignoreOvertimeGoals === true) {
        flaggedPoolIds.add(d.id);
      }
      enabledByPool.set(d.id, getEnabledChampionships(data as Pool));
    }
  } catch (err) {
    // Falha ao ler pools não deve derrubar o recalc: degrada para nenhum flagged
    // (placar final em tudo) e nenhum campeonato extra — fallback seguro (só Copa).
    console.warn("[recalc] falha ao ler flags/campeonatos de pool:", err);
  }

  // União dos campeonatos PONTUÁVEIS habilitados em qualquer pool — os que ganham
  // escopo `geral` próprio (§7.5). A Copa (`fifa.world`) sai da união: já é coberta
  // pelos escopos bare acima. Sem pool habilitando outro campeonato → conjunto vazio.
  //
  // GATE DE TIPO (invariante crítica — proteção da Copa legada): SÓ `type: "league"`.
  // Só o path de liga (`mapEspnEventToLeagueMatch`) namespaceia o matchId
  // (`{championshipId}:{event.id}`). Cups NÃO-legados roteiam pelo mapper da Copa
  // (`mapEspnEventsToMatches`), que gera ids BARE (`m73`, `{data}-{home}-{away}`) —
  // idênticos aos da Copa. Pontuá-los aqui sobrescreveria palpites/rankings reais
  // da Copa (colisão de matchId). Cups ficam de fora até seus ids serem namespaced
  // (foundation/TASK-10). Sem isso, o gate quebraria a garantia de zero-regressão.
  // TASK-13: status resolvido DINAMICAMENTE (override do doc `championships/{id}`
  // sobre o default estático do catálogo), não `champ.status` cru — assim ligas
  // arquivadas EM RUNTIME saem do union. Uma leitura por passada (batch). Falha
  // degrada para os defaults do catálogo (fallback seguro dentro do resolvedor).
  const dynamicStatuses = await loadChampionshipStatuses(db);
  const championshipUnion = new Set<string>();
  for (const ids of enabledByPool.values()) {
    for (const id of ids) {
      if (id === DEFAULT_CHAMPIONSHIP_ID) continue;
      const champ = getChampionship(id);
      // TASK-21/13: sweep só ATIVOS — liga (único path namespaced) E não-arquivado
      // (arquivado é congelado/servido do banco pela TASK-13/14; não re-pontuar ao vivo).
      const status = dynamicStatuses.get(id) ?? champ?.status;
      if (champ?.type === "league" && status !== "archived") championshipUnion.add(id);
    }
  }

  // Agregado 90min por (poolId flagged → uid → UserAgg). Só membros de pool flagged.
  const flaggedAggByPool = new Map<string, Map<string, UserAgg>>();
  for (const u of approved) {
    if (!u.groupId || !flaggedPoolIds.has(u.groupId)) continue;
    const perUid = flaggedAggByPool.get(u.groupId) ?? new Map<string, UserAgg>();
    perUid.set(
      u.uid,
      aggregateUser(predsByUid.get(u.uid) ?? [], matchById, { ignoreOvertimeGoals: true }),
    );
    flaggedAggByPool.set(u.groupId, perUid);
  }

  /**
   * Agregado a usar ao montar os docs de um pool: flagged (90min) quando o pool
   * tem a flag; senão o agregado global (placar final). Docs GLOBAIS nunca usam
   * isto — sempre `aggByUid` direto.
   */
  const aggForPool = (poolId: string, uid: string): UserAgg =>
    flaggedAggByPool.get(poolId)?.get(uid) ?? aggByUid.get(uid)!;

  // Construtores de RankableParticipant por escopo, a partir de um UserAgg. Usados
  // com `aggByUid` (docs globais, placar final) e com `aggForPool` (docs de pool,
  // 90min quando flagged). Centralizam a montagem p/ garantir consistência global↔pool.
  const geralPart = (uid: string, a: UserAgg): RankableParticipant => ({
    uid,
    points: a.pointsGeral,
    accuracy: computeAccuracy(a.correctGeral, finishedGeral),
    wrong: a.wrongGeral,
    correct: a.correctGeral,
    winner: a.winnerGeral,
    draw: a.drawGeral,
    firstPredictionAt: a.firstPredictionAt,
  });
  // TASK-11: participante `geral` de um campeonato NÃO-legado. Idêntico a `geralPart`,
  // exceto o denominador de aproveitamento — o total de finalizadas DAQUELE campeonato
  // (não `finishedGeral`, que é da Copa). `a` vem de `aggregateUser` sobre as partidas
  // do campeonato → `pointsGeral`/`correctGeral` já são exclusivos dele.
  const champGeralPart = (uid: string, a: UserAgg, finishedCount: number): RankableParticipant => ({
    uid,
    points: a.pointsGeral,
    accuracy: computeAccuracy(a.correctGeral, finishedCount),
    wrong: a.wrongGeral,
    correct: a.correctGeral,
    winner: a.winnerGeral,
    draw: a.drawGeral,
    firstPredictionAt: a.firstPredictionAt,
  });
  const stagePart = (
    uid: string,
    a: UserAgg,
    scope: RankingStageScope,
    denom: number,
  ): RankableParticipant => {
    const s = a.byStageScope.get(scope) ?? emptyScopeCounts();
    return {
      uid,
      points: s.points,
      accuracy: computeAccuracy(s.correct, denom),
      wrong: s.wrong,
      correct: s.correct,
      winner: s.winner,
      draw: s.draw,
      firstPredictionAt: a.firstPredictionAt,
    };
  };
  const elimPart = (uid: string, a: UserAgg): RankableParticipant => {
    const el = a.byElimination;
    return {
      uid,
      points: el.points,
      accuracy: computeAccuracy(el.correct, finishedElimination),
      wrong: el.wrong,
      correct: el.correct,
      winner: el.winner,
      draw: el.draw,
      firstPredictionAt: a.firstPredictionAt,
    };
  };
  const groupPart = (
    uid: string,
    a: UserAgg,
    groupId: string,
    denom: number,
  ): RankableParticipant => {
    const g = a.byGroup.get(groupId) ?? emptyScopeCounts();
    return {
      uid,
      points: g.points,
      accuracy: computeAccuracy(g.correct, denom),
      wrong: g.wrong,
      correct: g.correct,
      winner: g.winner,
      draw: g.draw,
      firstPredictionAt: a.firstPredictionAt,
    };
  };

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

  // ─── 5. Ranking geral (GLOBAL, placar final) ───────────────────────────────
  const geralParticipants: RankableParticipant[] = approved.map((u) =>
    geralPart(u.uid, aggByUid.get(u.uid)!),
  );
  const geralRanked = rankParticipants(geralParticipants);
  const geralPositionByUid = new Map(geralRanked.map((r) => [r.uid, r.position]));
  writes.push(
    db
      .collection("rankings")
      .doc("geral")
      .set({
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
  for (const [poolId, members] of poolMembers) {
    // Pool flagged → re-pontua pelo 90min (aggForPool); senão usa o global.
    const participants = members.map((m) => geralPart(m.uid, aggForPool(poolId, m.uid)));
    writes.push(
      db
        .collection("rankings")
        .doc(`pool-${poolId}-geral`)
        .set({
          scope: "geral",
          updatedAt: nowIso,
          entries: toBudgetedEntries(rankParticipants(participants)),
        }),
    );
    poolsWritten += 1;
  }

  // Limpa docs de pool ÓRFÃOS (HG-02): pools que perderam todos os membros — ex.:
  // usuário movido p/ outro pool, último membro removido/bloqueado. Sem isso,
  // as rotas de pool serviriam entries stale de um pool já vazio. Cobre TODAS as
  // variantes de doc por pool (geral, fases e grupos da Copa — PRD-09 Tela 03):
  // um doc `pool-*` é órfão quando NENHUM pool vivo o reivindica. Testar por
  // pertencimento (e não por regex que extrai o poolId) evita ambiguidade quando
  // o próprio poolId contém hífens.
  const livePoolIds = [...poolMembers.keys()];
  // TASK-12: nº de campeonatos PONTUÁVEIS que um pool habilita — Copa legada
  // (`fifa.world`, escopo bare) + ligas ATIVAS (na união). Gate do doc `agregado`.
  const countableChampionships = (poolId: string): number =>
    (enabledByPool.get(poolId) ?? []).reduce(
      (n, cid) => (cid === DEFAULT_CHAMPIONSHIP_ID || championshipUnion.has(cid) ? n + 1 : n),
      0,
    );
  const ownedByLivePool = (docId: string): boolean =>
    livePoolIds.some(
      (p) =>
        docId === `pool-${p}-geral` ||
        docId === `pool-${p}-${ELIMINATION_SCOPE}` ||
        (RANKING_STAGE_SCOPES as readonly string[]).some((s) => docId === `pool-${p}-${s}`) ||
        docId.startsWith(`pool-${p}-grupo-`) ||
        // TASK-12: agregado só é reivindicado por pool com ≥2 campeonatos pontuáveis
        // (idêntico ao gate de escrita §7.6). Pool que caiu para 1 → doc vira órfão → limpo.
        (docId === `pool-${p}-${AGGREGATE_SCOPE}` && countableChampionships(p) >= 2) ||
        // TASK-11: doc `geral` por campeonato de um pool VIVO que ainda habilita o
        // campeonato E que está sendo pontuado (`championshipUnion` = ligas). Sem esta
        // cláusula o cleanup apagaria o doc recém-escrito; com `championshipUnion.has`,
        // um pool que DESABILITOU a liga (ou um cup nunca pontuado) não é protegido → limpo.
        (enabledByPool.get(p) ?? []).some(
          (cid) => championshipUnion.has(cid) && docId === `pool-${p}-${cid}-geral`,
        ),
    );
  // TASK-11 (MR-01): doc GLOBAL `{C}-geral` de campeonato pontuável some quando C sai
  // da união (nenhum pool o habilita mais) — senão serviria ranking stale para sempre.
  // Só alcança docs cujo prefixo é um campeonato NÃO-default do catálogo: o `geral`
  // bare da Copa (`getChampionship("") === undefined`) e escopos de fase/grupo nunca casam.
  const isStaleChampionshipGlobal = (docId: string): boolean => {
    if (!docId.endsWith("-geral")) return false;
    const cid = docId.slice(0, -"-geral".length);
    const champ = getChampionship(cid);
    return champ !== undefined && cid !== DEFAULT_CHAMPIONSHIP_ID && !championshipUnion.has(cid);
  };
  const existingRankingDocs = await db.collection("rankings").get();
  for (const d of existingRankingDocs.docs) {
    if (d.id.startsWith("pool-")) {
      if (!ownedByLivePool(d.id)) writes.push(d.ref.delete());
    } else if (isStaleChampionshipGlobal(d.id)) {
      writes.push(d.ref.delete());
    }
  }

  // ─── 6. Rankings por fase (5) ──────────────────────────────────────────────
  // Global (`rankings/{scope}`) + por pool (`pool-{poolId}-{scope}`, PRD-09 Tela 03):
  // mesma pontuação por fase, RE-RANKEADA só entre os membros do pool. Sem o doc por
  // pool a Tela 03 cairia no global e vazaria participantes de outros bolões.
  let scopesWritten = 1;
  for (const scope of RANKING_STAGE_SCOPES) {
    const denom = finishedByStage.get(scope) ?? 0;
    // Global (placar final).
    const globalPart = approved.map((u) => stagePart(u.uid, aggByUid.get(u.uid)!, scope, denom));
    writes.push(
      db
        .collection("rankings")
        .doc(scope)
        .set({
          scope,
          updatedAt: nowIso,
          entries: toBudgetedEntries(rankParticipants(globalPart)),
        }),
    );
    scopesWritten += 1;

    // Por pool — flagged re-pontua pelo 90min (só afeta fases eliminatórias).
    for (const [poolId, members] of poolMembers) {
      const poolPart = members.map((m) => stagePart(m.uid, aggForPool(poolId, m.uid), scope, denom));
      writes.push(
        db
          .collection("rankings")
          .doc(`pool-${poolId}-${scope}`)
          .set({
            scope,
            updatedAt: nowIso,
            entries: toBudgetedEntries(rankParticipants(poolPart)),
          }),
      );
    }
  }

  // ─── 6.1 Ranking AGREGADO eliminatórias (PRD-16 / TASK-02) ─────────────────
  // Soma das 5 fases mata-mata (incl. dezesseis-avos) — `rankings/eliminatorias`
  // (global) + `pool-{poolId}-eliminatorias` (re-rankeado só entre membros do pool,
  // pelos pontos do agregado, NÃO por pointsGeral). Espelha o loop das fases.
  const elimGlobalPart = approved.map((u) => elimPart(u.uid, aggByUid.get(u.uid)!));
  writes.push(
    db
      .collection("rankings")
      .doc(ELIMINATION_SCOPE)
      .set({
        scope: ELIMINATION_SCOPE,
        updatedAt: nowIso,
        entries: toBudgetedEntries(rankParticipants(elimGlobalPart)),
      }),
  );
  scopesWritten += 1;
  // Por pool — flagged re-pontua o agregado eliminatórias pelo 90min.
  for (const [poolId, members] of poolMembers) {
    const poolPart = members.map((m) => elimPart(m.uid, aggForPool(poolId, m.uid)));
    writes.push(
      db
        .collection("rankings")
        .doc(`pool-${poolId}-${ELIMINATION_SCOPE}`)
        .set({
          scope: ELIMINATION_SCOPE,
          updatedAt: nowIso,
          entries: toBudgetedEntries(rankParticipants(poolPart)),
        }),
    );
  }

  // ─── 7. Rankings por grupo da Copa (A–L) ───────────────────────────────────
  // Global (`rankings/grupo-{groupId}`) + por pool (`pool-{poolId}-grupo-{groupId}`,
  // PRD-09 Tela 03): mesma pontuação no grupo, RE-RANKEADA só entre os membros do pool.
  let groupsWritten = 0;
  for (const [groupId, denom] of finishedByGroup) {
    // Fase de grupos nunca tem prorrogação → aggForPool == aggByUid aqui (flag
    // inócua). Uso uniforme dos helpers p/ consistência com os demais scopes.
    const globalPart = approved.map((u) => groupPart(u.uid, aggByUid.get(u.uid)!, groupId, denom));
    writes.push(
      db
        .collection("rankings")
        .doc(`grupo-${groupId}`)
        .set({
          groupId,
          updatedAt: nowIso,
          entries: toBudgetedEntries(rankParticipants(globalPart)),
        }),
    );
    groupsWritten += 1;

    for (const [poolId, members] of poolMembers) {
      const poolPart = members.map((m) =>
        groupPart(m.uid, aggForPool(poolId, m.uid), groupId, denom),
      );
      writes.push(
        db
          .collection("rankings")
          .doc(`pool-${poolId}-grupo-${groupId}`)
          .set({
            groupId,
            updatedAt: nowIso,
            entries: toBudgetedEntries(rankParticipants(poolPart)),
          }),
      );
    }
  }

  // ─── 7.5 Rankings `geral` por campeonato habilitado (TASK-11) ──────────────
  // Além da Copa legada (escopos bare acima), pontua cada campeonato NÃO-legado
  // habilitado em algum pool. SÓ a dimensão `geral`: global (`rankings/{C}-geral`)
  // + por pool que habilitou (`pool-{poolId}-{C}-geral`). Ligas e copas novas NÃO
  // replicam a máquina de fase/grupo da Copa (decisão travada da TASK-11).
  // Best-effort POR campeonato: matchId é globalmente único (namespaced), então a
  // pontuação não colide entre campeonatos; a falha da fonte de UM campeonato loga
  // e é pulada, sem cascatear para os demais nem para a Copa.
  // TASK-12: acumula, por pool, as fontes por campeonato (participantes já pontuados
  // + total de finalizadas) para montar o ranking `geral` AGREGADO abaixo (§7.6).
  // Só ligas efetivamente pontuadas aqui entram — falha de fonte (best-effort) exclui
  // o campeonato do agregado E da contagem do gate, mantendo a coerência.
  const poolChampSources = new Map<string, ChampionshipScopeSource[]>();
  let championshipsProcessed = 0;
  for (const championshipId of championshipUnion) {
    const championship = getChampionship(championshipId);
    if (!championship || championship.legacyMatchId === true) continue; // legado já coberto
    try {
      const champMatches = await getEffectiveMatches(championshipId);
      const champFinished = champMatches.filter((m) => m.status === "finished");
      const champMatchById = new Map(champFinished.map((m) => [m.id, m]));
      const champFinishedCount = champFinished.length;
      const scope = championshipScope(championship, "geral"); // ex.: `bra.1-2026-geral`

      // Agregado por usuário SOBRE as partidas deste campeonato — palpites de outros
      // campeonatos não resolvem em `champMatchById` e são ignorados (isolamento).
      const champAggByUid = new Map<string, UserAgg>();
      for (const u of approved) {
        champAggByUid.set(u.uid, aggregateUser(predsByUid.get(u.uid) ?? [], champMatchById));
      }

      // Global — todos os aprovados pontuados no campeonato.
      const champGlobalPart = approved.map((u) =>
        champGeralPart(u.uid, champAggByUid.get(u.uid)!, champFinishedCount),
      );
      writes.push(
        db
          .collection("rankings")
          .doc(scope)
          .set({
            scope,
            championshipId,
            updatedAt: nowIso,
            entries: toBudgetedEntries(rankParticipants(champGlobalPart)),
          }),
      );

      // Por pool — só pools VIVOS que habilitaram este campeonato, re-rankeados
      // apenas entre os próprios membros (`pool-{poolId}-{C}-geral`).
      for (const [poolId, members] of poolMembers) {
        if (!(enabledByPool.get(poolId) ?? []).includes(championshipId)) continue;
        const poolPart = members.map((m) =>
          champGeralPart(m.uid, champAggByUid.get(m.uid)!, champFinishedCount),
        );
        writes.push(
          db
            .collection("rankings")
            .doc(`pool-${poolId}-${scope}`)
            .set({
              scope,
              championshipId,
              updatedAt: nowIso,
              entries: toBudgetedEntries(rankParticipants(poolPart)),
            }),
        );
        // TASK-12: mesma contribuição por membro alimenta o agregado do pool.
        const sources = poolChampSources.get(poolId) ?? [];
        sources.push({ finished: champFinishedCount, participants: poolPart });
        poolChampSources.set(poolId, sources);
      }
      championshipsProcessed += 1;
    } catch (err) {
      console.warn(`[recalc] falha ao pontuar campeonato ${championshipId}:`, err);
    }
  }

  // ─── 7.6 Ranking `geral` AGREGADO por pool (TASK-12) ───────────────────────
  // Soma bruta dos pontos do membro entre os campeonatos PONTUÁVEIS do pool: a Copa
  // legada (escopo bare `geral`, respeitando a flag 90min via `aggForPool`) MAIS cada
  // liga ativa já pontuada em §7.5 (`poolChampSources`). Escrito em
  // `pool-{poolId}-agregado` SÓ quando o pool tem ≥2 campeonatos pontuáveis — senão o
  // "geral" do pool continua sendo o bare `pool-{poolId}-geral` (zero doc extra, zero
  // regressão). `accuracy` recomputada sobre a soma das finalizadas (helper puro).
  let aggregatesWritten = 0;
  for (const [poolId, members] of poolMembers) {
    const sources: ChampionshipScopeSource[] = [...(poolChampSources.get(poolId) ?? [])];
    if ((enabledByPool.get(poolId) ?? []).includes(DEFAULT_CHAMPIONSHIP_ID)) {
      sources.unshift({
        finished: finishedGeral,
        participants: members.map((m) => geralPart(m.uid, aggForPool(poolId, m.uid))),
      });
    }
    if (sources.length < 2) continue; // gate: agregação exige ≥2 campeonatos pontuáveis
    writes.push(
      db
        .collection("rankings")
        .doc(`pool-${poolId}-${AGGREGATE_SCOPE}`)
        .set({
          scope: AGGREGATE_SCOPE,
          updatedAt: nowIso,
          entries: toBudgetedEntries(rankParticipants(aggregateChampionshipScopes(sources))),
        }),
    );
    aggregatesWritten += 1;
  }

  // ─── 8. Statistics por usuário (com positionHistory) ───────────────────────
  // TASK-05: deltas de posição geral derivados AQUI (aditivo) — `previousPosition`
  // vem do último ponto `geral` do histórico, `newPosition` da nova rankeação.
  const deltas: RankingPositionDelta[] = [];
  const statsWrites = approved.map(async (u) => {
    const a = aggByUid.get(u.uid)!;
    const existingSnap = await db.collection("statistics").doc(u.uid).get();
    const existing = existingSnap.exists ? existingSnap.data() : undefined;
    const prevHistory = Array.isArray(existing?.["positionHistory"])
      ? (existing!["positionHistory"] as Array<Record<string, unknown>>)
      : [];
    const prevMaxRound = prevHistory.reduce(
      (max, h) =>
        typeof h["round"] === "number" && h["round"] > max ? (h["round"] as number) : max,
      0,
    );
    const newPosition = geralPositionByUid.get(u.uid) ?? 1;
    // Só registra novo ponto quando a posição geral MUDOU em relação ao último
    // snapshot (TASK-14, WR-02 da TASK-03): evita poluir a Tela 04 e o crescimento
    // ilimitado do histórico quando o recalc roda sem mudança de estado.
    const last = prevHistory[prevHistory.length - 1];
    // Baseline = última posição `geral` numérica do histórico; senão sem baseline.
    const previousPosition =
      last !== undefined && last["scope"] === "geral" && typeof last["position"] === "number"
        ? (last["position"] as number)
        : undefined;
    deltas.push({ uid: u.uid, previousPosition, newPosition });
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

    await db
      .collection("statistics")
      .doc(u.uid)
      .set(
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
    ...(leader && approved.length > 0
      ? { highestPointsName: userByUid.get(leader.uid)!.name }
      : {}),
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
      version: RECALC_VERSION, // marca o formato regravado (gate de shape, ver constante)
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
    championshipsProcessed,
    aggregatesWritten,
    deltas,
  };
}

export interface RecalcPoolSummary {
  poolId: string;
  participants: number;
  finishedMatches: number;
  /**
   * Delta de posição DENTRO do pool (TASK-05) — `previousPosition` lido do doc
   * `rankings/pool-{poolId}-geral` existente ANTES do overwrite; `newPosition` da
   * rankeação nova. `undefined` quando o uid não estava no doc (ou doc inexistente).
   */
  deltas: RankingPositionDelta[];
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
export async function recalcPoolRanking(db: Firestore, poolId: string): Promise<RecalcPoolSummary> {
  const matches = await getEffectiveMatches();
  const finished = matches.filter((m) => m.status === "finished");
  const matchById = new Map(finished.map((m) => [m.id, m]));
  const finishedGeral = finished.length;

  // Flag do pool: ignorar gols de prorrogação nas eliminatórias (TASK-03). Leitura
  // tolerante (ausente/false = OFF; falha não derruba o recalc → placar final).
  let ignoreOvertimeGoals = false;
  try {
    const poolSnap = await db.collection("pools").doc(poolId).get();
    ignoreOvertimeGoals =
      (poolSnap.data() as { ignoreOvertimeGoals?: unknown } | undefined)
        ?.ignoreOvertimeGoals === true;
  } catch (err) {
    console.warn("[recalc-pool] falha ao ler flag ignoreOvertimeGoals:", err);
  }

  // Membros aprovados do pool. Filtra `groupId` em memória (evita índice composto
  // status+groupId); só este pool é tocado — isolamento multi-tenant (D2).
  const usersSnap = await db.collection("users").where("status", "==", "approved").get();
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
      const scored = scorePrediction(pred, match, { ignoreOvertimeGoals });
      points += scored.points; // ponderado (5/10)
      if (scored.status === "correct")
        correct += 1; // EXATO
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

  // TASK-05 (aditivo): lê o doc de pool EXISTENTE antes do overwrite p/ derivar o
  // `previousPosition` por uid (diff de posição dentro do pool). 1 read marginal;
  // nenhuma nova persistência. Doc/uid ausente → sem baseline (`undefined`).
  const poolDocRef = db.collection("rankings").doc(`pool-${poolId}-geral`);
  const prevSnap = await poolDocRef.get();
  const prevPositionByUid = new Map<string, number>();
  if (prevSnap.exists) {
    const prevEntries = prevSnap.data()?.["entries"];
    if (Array.isArray(prevEntries)) {
      for (const e of prevEntries as Array<Record<string, unknown>>) {
        if (typeof e["uid"] === "string" && typeof e["position"] === "number") {
          prevPositionByUid.set(e["uid"] as string, e["position"] as number);
        }
      }
    }
  }
  const deltas: RankingPositionDelta[] = ranked.map((r) => ({
    uid: r.uid,
    previousPosition: prevPositionByUid.get(r.uid),
    newPosition: r.position,
  }));

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
    deltas,
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
 * Compara a assinatura dos finalizados atuais (`computeFinishedSignature`) E a versão
 * de formato (`RECALC_VERSION`) com o que foi gravado no doc `rankings/_freshness`
 * pelo último recalc:
 *  - doc ausente (cold start) OU assinatura divergente (placar novo) OU versão
 *    divergente (deploy mudou o shape) → recomputa tudo;
 *  - assinatura E versão iguais → no-op (pula a agregação cara; só pagou 1 fetch + 1 read).
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

  // Fresco só quando o doc existe, a assinatura bate (dados) E a versão bate (shape):
  // nada mudou desde o recalc — nem placar novo, nem formato de saída. Docs gravados
  // antes do campo `version` (formato 1) divergem de RECALC_VERSION → forçam 1 recalc.
  const freshData = freshSnap.exists ? freshSnap.data() : undefined;
  if (freshData?.["signature"] === currentSignature && freshData?.["version"] === RECALC_VERSION) {
    return;
  }

  // Cold start OU novo placar finalizado (openfootball/edição) OU shape novo → recomputa.
  try {
    await recalcRankings(db);
  } catch (err) {
    console.error("[rankings] recalc (dirty-by-finish) falhou:", err);
  }
}
