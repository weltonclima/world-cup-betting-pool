import { doc, getDoc } from "firebase/firestore";

import { firestore } from "@/firebase";
import {
  groupRankingSchema,
  poolStatsSchema,
  rankingSchema,
  statisticsSchema,
} from "@/schemas";
import type {
  GroupRanking,
  PoolStats,
  Ranking,
  RankingEntry,
  RankingScope,
  Statistics,
} from "@/types";

/**
 * Camada de serviço de rankings (PRD-05, TASK-04).
 *
 * Funções puras de Firestore (Client SDK) para leitura. Sem React/cache — os hooks
 * TanStack Query ficam na TASK-05. Erros do Firebase propagam crus (com `code`);
 * esta camada NÃO traduz mensagens. Cada doc é validado por schema (.parse) —
 * doc fora do schema faz a Promise rejeitar. Doc inexistente → `null`.
 *
 * Leitura por doc id direto (mais barata que query) — alinhada aos paths gravados
 * pelo recalc (TASK-03): `rankings/{scope}`, `rankings/grupo-{groupId}`,
 * `statistics/{uid}`, `pool_stats/current`.
 */

/** Ranking de um escopo ("geral" ou uma das 5 fases). */
export async function getRankingByScope(
  scope: RankingScope,
): Promise<Ranking | null> {
  const snapshot = await getDoc(doc(firestore, "rankings", scope));
  if (!snapshot.exists()) return null;
  return rankingSchema.parse(snapshot.data());
}

/** Ranking geral consolidado. Delega a `getRankingByScope("geral")`. */
export async function getGeneralRanking(): Promise<Ranking | null> {
  return getRankingByScope("geral");
}

/** Ranking de um grupo individual (A–L). Doc `rankings/grupo-{groupId}`. */
export async function getGroupRanking(
  groupId: string,
): Promise<GroupRanking | null> {
  const snapshot = await getDoc(doc(firestore, "rankings", `grupo-${groupId}`));
  if (!snapshot.exists()) return null;
  return groupRankingSchema.parse(snapshot.data());
}

/** Linha do usuário no ranking geral + total de participantes (Tela 02). */
export interface UserRankingResult {
  entry: RankingEntry;
  total: number;
}

export async function getUserRanking(
  uid: string,
): Promise<UserRankingResult | null> {
  const general = await getGeneralRanking();
  if (!general) return null;
  const entry = general.entries.find((e) => e.uid === uid);
  if (!entry) return null;
  return { entry, total: general.entries.length };
}

/** Estatísticas agregadas de um participante (Tela 05). Doc `statistics/{uid}`. */
export async function getParticipantProfile(
  uid: string,
): Promise<Statistics | null> {
  const snapshot = await getDoc(doc(firestore, "statistics", uid));
  if (!snapshot.exists()) return null;
  return statisticsSchema.parse(snapshot.data());
}

/** Estatísticas gerais do bolão (Tela 06). Doc `pool_stats/current`. */
export async function getPoolStats(): Promise<PoolStats | null> {
  const snapshot = await getDoc(doc(firestore, "pool_stats", "current"));
  if (!snapshot.exists()) return null;
  return poolStatsSchema.parse(snapshot.data());
}
