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
 * pelo recalc (TASK-03): `rankings/{scope}`, `rankings/group-{groupId}`,
 * `statistics/{uid}`, `pool_stats/current`.
 */

/**
 * Ranking de um escopo ("geral" ou uma das 5 fases).
 *
 * Lê via Route Handler `GET /api/rankings/{scope}` (server, admin SDK) em vez do
 * Firestore client direto: o servidor aplica o recalc preguiçoso (TTL +
 * stale-while-revalidate) e mantém o doc fresco sem depender de cron. Doc ausente
 * → resposta `null`. Status não-OK propaga como erro (React Query trata isError).
 */
export async function getRankingByScope(
  scope: RankingScope,
): Promise<Ranking | null> {
  const res = await fetch(`/api/rankings/${scope}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ranking (${res.status}).`);
  }
  const json: unknown = await res.json();
  if (json === null) return null;
  return rankingSchema.parse(json);
}

/** Ranking geral consolidado. Delega a `getRankingByScope("geral")`. */
export async function getGeneralRanking(): Promise<Ranking | null> {
  return getRankingByScope("geral");
}

/**
 * Reprocessa o ranking fechado do pool do group_admin logado
 * (`POST /api/group/rankings/recalc`).
 *
 * Recomputa SÓ o doc `rankings/pool-{groupId}-geral` (Tela 01 / GET /api/rankings/pool),
 * re-rankeando os membros do pool a partir dos palpites + resultados atuais. Corrige
 * defasagem do próprio pool sem o custo do recalc global. A rota resolve o `groupId`
 * pela sessão (o client nunca o envia) e autoriza só group_admin/super_admin; demais
 * papéis recebem 403. Status não-OK → erro (o chamador trata).
 */
export async function triggerGroupRankingRecalc(): Promise<void> {
  const res = await fetch("/api/group/rankings/recalc", {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Falha ao reprocessar o ranking do grupo (${res.status}).`);
  }
}

/**
 * Ranking FECHADO do pool do usuário logado (PRD-09). Lê via
 * `GET /api/rankings/pool` — o servidor resolve o `groupId` pela sessão e serve
 * `rankings/pool-{groupId}-geral`. O client NÃO passa o pool (isolamento). Usuário
 * sem pool → `null`. Status não-OK propaga como erro (React Query trata isError).
 */
export async function getPoolRanking(): Promise<Ranking | null> {
  const res = await fetch("/api/rankings/pool", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ranking do grupo (${res.status}).`);
  }
  const json: unknown = await res.json();
  if (json === null) return null;
  return rankingSchema.parse(json);
}

/** Ranking de um grupo individual (A–L). Doc `rankings/group-{groupId}`. */
export async function getGroupRanking(
  groupId: string,
): Promise<GroupRanking | null> {
  const snapshot = await getDoc(doc(firestore, "rankings", `grupo-${groupId}`));
  if (!snapshot.exists()) return null;
  return groupRankingSchema.parse(snapshot.data());
}

/**
 * Ranking de UMA FASE (uma das 5) recortado ao pool do usuário logado (PRD-09,
 * Tela 03). Lê via `GET /api/rankings/pool/{scope}` — o servidor resolve o pool
 * pela sessão e serve `rankings/pool-{groupId}-{scope}` (re-rankeado só com membros
 * do pool). O client NUNCA passa o pool. Usuário sem pool → `null`. Status não-OK
 * propaga como erro (React Query trata isError).
 */
export async function getPoolRankingByScope(
  scope: RankingScope,
): Promise<Ranking | null> {
  const res = await fetch(`/api/rankings/pool/${scope}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ranking da fase (${res.status}).`);
  }
  const json: unknown = await res.json();
  if (json === null) return null;
  return rankingSchema.parse(json);
}

/**
 * Ranking de UM GRUPO da Copa (A–L) recortado ao pool do usuário logado (PRD-09,
 * Tela 03). Lê via `GET /api/rankings/pool/grupo/{groupId}` — o servidor resolve o
 * pool pela sessão e serve `rankings/pool-{poolId}-grupo-{groupId}`. O client passa
 * só o grupo da Copa, NUNCA o pool. Usuário sem pool → `null`.
 */
export async function getPoolGroupRanking(
  groupId: string,
): Promise<GroupRanking | null> {
  const res = await fetch(`/api/rankings/pool/grupo/${groupId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ranking do grupo (${res.status}).`);
  }
  const json: unknown = await res.json();
  if (json === null) return null;
  return groupRankingSchema.parse(json);
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
