import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { computeFinishedSignature } from "@/server/rankings/recalc";
import { championshipScope } from "@/server/rankings/championshipScope";
import { getEnabledChampionships } from "@/lib/poolChampionships";
import {
  championshipStateSchema,
  historyParticipantStatSchema,
  historySnapshotSchema,
  type HistoryParticipantStat,
} from "@/schemas";
import type { Championship } from "@/types/championships";
import type { MatchWithId } from "@/types/matches";
import type { Pool } from "@/types/pools";

/**
 * Pipeline de arquivamento de campeonato encerrado (multi-championship TASK-13).
 *
 * Congela o estado final de forma durável e imutável e transiciona o status para
 * `archived` de modo observável em runtime. Três artefatos por arquivamento:
 *  1. Schedule completo persistido em `matches/{id}` (fonte DB-first da TASK-14).
 *  2. Ranking + estatísticas finais por-bolão e global-do-campeonato em `history/*`
 *     (imune a recalc/pesos futuros).
 *  3. Estado `archived` em `championships/{id}` (resolvido por `championshipState`).
 *
 * INVARIANTE DE SEGURANÇA DE DADOS: o freeze do snapshot + o flip de status são
 * commitados no MESMO `WriteBatch` atômico, e o schedule é commitado ANTES. O
 * sweep de recalc (que deleta `rankings/*` fora do union) só observa `archived`
 * depois que `history/*` já está durável — elimina a race do sweep de 30 min.
 */

/** Teto de writes por batch (Firestore hard cap 500; folga de segurança). */
const BATCH_CHUNK = 400;

/**
 * Status de partida "ativos" (ainda não terminais) — espelha a heurística de
 * `homeDashboardHelpers`. Enquanto houver qualquer um destes, o campeonato NÃO
 * está encerrado.
 */
const ACTIVE_MATCH_STATUSES = new Set(["scheduled", "live"]);

export type ArchiveSummary = {
  championshipId: string;
  matchesPersisted: number;
  poolsArchived: number;
  historyDocs: number;
  alreadyArchived: boolean;
};

/** Erro tipado: tentativa de arquivar campeonato ainda não encerrado (→ 409). */
export class ChampionshipNotFinishedError extends Error {
  constructor(championshipId: string) {
    super(`Campeonato "${championshipId}" não está encerrado; arquivamento abortado.`);
    this.name = "ChampionshipNotFinishedError";
  }
}

/**
 * Detecção pura de "campeonato 100% encerrado". Conservadora:
 * - lista vazia → false (sem schedule ≠ encerrado);
 * - qualquer match `scheduled`/`live` → false;
 * - todos terminais (`finished`/`postponed`/`canceled`) COM ≥1 `finished` → true
 *   (campeonato só-cancelado/adiado não arquiva).
 */
export function isChampionshipFinished(matches: MatchWithId[]): boolean {
  if (matches.length === 0) return false;
  if (matches.some((m) => ACTIVE_MATCH_STATUSES.has(m.status))) return false;
  return matches.some((m) => m.status === "finished");
}

/** Doc de `matches/{id}` a partir de um match efetivo (remove o `id` do payload). */
function matchDocData(m: MatchWithId): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...m };
  delete doc["id"];
  return doc;
}

/** Recorte de `statistics/{uid}` congelado no snapshot por-bolão (só agregados). */
function participantStatFrom(data: Record<string, unknown>): HistoryParticipantStat | null {
  const parsed = historyParticipantStatSchema.safeParse({
    uid: data["uid"],
    totalCorrect: data["totalCorrect"],
    totalPartial: data["totalPartial"],
    totalWrong: data["totalWrong"],
    accuracy: data["accuracy"],
    longestStreak: data["longestStreak"],
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Arquiva um campeonato encerrado. Idempotente: re-executar recomputa e regrava
 * o snapshot (refresh determinístico) e reflete `alreadyArchived`.
 *
 * @throws ChampionshipNotFinishedError se o campeonato ainda tem jogo pendente.
 */
export async function archiveChampionship(
  db: Firestore,
  championship: Championship,
): Promise<ArchiveSummary> {
  const cid = championship.id;

  // 1. Matches efetivos + validação de encerramento.
  const matches = await getEffectiveMatches(cid);
  if (!isChampionshipFinished(matches)) {
    throw new ChampionshipNotFinishedError(cid);
  }
  const finishedSignature = computeFinishedSignature(matches);
  const archivedAt = new Date().toISOString();

  // Idempotência: já `archived`? (ainda assim regrava o snapshot — refresh).
  const stateSnap = await db.collection("championships").doc(cid).get();
  const alreadyArchived =
    stateSnap.exists &&
    (stateSnap.data() as { status?: unknown } | undefined)?.status === "archived";

  // 2. Persiste schedule completo em `matches/{id}` — batches chunkados ANTES do
  //    flip (pré-requisito DB-first; não some no sweep, que só toca `rankings`).
  for (let i = 0; i < matches.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const m of matches.slice(i, i + BATCH_CHUNK)) {
      batch.set(db.collection("matches").doc(m.id), matchDocData(m));
    }
    await batch.commit();
  }

  // 3. Freeze do snapshot + flip de status no MESMO batch atômico.
  const freezeBatch = db.batch();
  let historyDocs = 0;
  let poolsArchived = 0;

  const scope = championshipScope(championship, "geral"); // ex.: bra.1-2026-geral

  // 3a. Global do campeonato (`history/{cid}__geral`).
  //     PRESERVA o snapshot anterior: num RE-arquivamento o doc `rankings/{scope}`
  //     ao vivo já não existe — o sweep de recalc apaga os docs da liga arquivada
  //     (fora do `championshipUnion`). Ler a fonte ao vivo devolveria `[]` e
  //     regravaria o histórico congelado como vazio (perda de dados). Regra: usa a
  //     fonte ao vivo quando tem entradas; senão cai para o `history/*` já
  //     congelado. Nunca sobrescreve um snapshot bom com `[]`.
  const globalHistoryRef = db.collection("history").doc(`${cid}__geral`);
  const [globalLiveSnap, globalPriorSnap] = await Promise.all([
    db.collection("rankings").doc(scope).get(),
    globalHistoryRef.get(),
  ]);
  const globalLive = globalLiveSnap.exists
    ? ((globalLiveSnap.data() as { entries?: unknown[] } | undefined)?.entries ?? [])
    : [];
  const globalPrior = globalPriorSnap.exists
    ? ((globalPriorSnap.data() as { ranking?: unknown[] } | undefined)?.ranking ?? [])
    : [];
  freezeBatch.set(
    globalHistoryRef,
    historySnapshotSchema.parse({
      championshipId: cid,
      scopeKey: "geral",
      poolId: null,
      archivedAt,
      finishedSignature,
      ranking: globalLive.length > 0 ? globalLive : globalPrior,
    }),
  );
  historyDocs += 1;

  // 3b. Por bolão que habilita o campeonato (`history/{cid}__{poolId}`).
  const poolsSnap = await db.collection("pools").get();
  for (const pd of poolsSnap.docs) {
    const pool = pd.data() as Pool;
    if (!getEnabledChampionships(pool).includes(cid)) continue;
    const poolId = pd.id;

    const poolHistoryRef = db.collection("history").doc(`${cid}__${poolId}`);
    const [poolRankSnap, poolPriorSnap] = await Promise.all([
      db.collection("rankings").doc(`pool-${poolId}-${scope}`).get(),
      poolHistoryRef.get(),
    ]);
    const liveRanking = poolRankSnap.exists
      ? ((poolRankSnap.data() as { entries?: Array<{ uid?: string }> } | undefined)?.entries ??
        [])
      : [];

    let poolRanking: unknown[];
    let statistics: HistoryParticipantStat[];
    if (liveRanking.length > 0) {
      // Fonte ao vivo presente → recorta `statistics/{uid}` dos participantes.
      poolRanking = liveRanking;
      statistics = [];
      for (const entry of liveRanking) {
        const uid = entry?.uid;
        if (!uid) continue;
        const sSnap = await db.collection("statistics").doc(uid).get();
        if (!sSnap.exists) {
          console.warn(
            `[archive] statistics/${uid} ausente ao congelar ${cid}__${poolId}; participante omitido do recorte.`,
          );
          continue;
        }
        const stat = participantStatFrom(sSnap.data() as Record<string, unknown>);
        if (stat) statistics.push(stat);
        else
          console.warn(
            `[archive] statistics/${uid} fora do contrato ao congelar ${cid}__${poolId}; participante omitido do recorte.`,
          );
      }
    } else {
      // Fonte ao vivo sumiu (re-arquivamento pós-sweep) → PRESERVA o snapshot
      // congelado em vez de zerá-lo.
      const prior = poolPriorSnap.exists
        ? (poolPriorSnap.data() as
            | { ranking?: unknown[]; statistics?: HistoryParticipantStat[] }
            | undefined)
        : undefined;
      poolRanking = prior?.ranking ?? [];
      statistics = prior?.statistics ?? [];
    }

    freezeBatch.set(
      poolHistoryRef,
      historySnapshotSchema.parse({
        championshipId: cid,
        scopeKey: poolId,
        poolId,
        archivedAt,
        finishedSignature,
        ranking: poolRanking,
        statistics,
      }),
    );
    historyDocs += 1;
    poolsArchived += 1;
  }

  // 3c. Flip de status — NO MESMO batch do freeze (snapshot durável antes/junto).
  freezeBatch.set(
    db.collection("championships").doc(cid),
    championshipStateSchema.parse({
      status: "archived",
      archivedAt,
      finishedSignature,
    }),
  );
  await freezeBatch.commit();

  return {
    championshipId: cid,
    matchesPersisted: matches.length,
    poolsArchived,
    historyDocs,
    alreadyArchived,
  };
}
