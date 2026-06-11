"use client";

import {
  useQuery,
  type Query,
  type UseQueryResult,
} from "@tanstack/react-query";

import { getGroups } from "@/services/worldcup";
import { STALE_TIME } from "@/server/cache/tiers";
import type { GroupTable, GroupsResponse } from "@/types";

import { worldcupKeys } from "./worldcupKeys";

/**
 * Config base compartilhada por `useGroups` e `useGroupStandings` (review WR-01).
 *
 * Os dois hooks observam a MESMA cache entry (`worldcupKeys.groups()`); por isso
 * `queryKey`/`queryFn`/`staleTime`/`refetchInterval` PRECISAM ser idênticos —
 * observers do mesmo entry brigam pelas opções registradas se divergirem.
 * Centralizar aqui impede drift: `useGroupStandings` só acrescenta `select`.
 *
 * `staleTime` = `STALE_TIME.grupos` (24h), alinhado ao TTL da rota (TASK-04).
 * Quando o payload traz `hasLiveGroupMatch: true` (jogo de grupo ao vivo), o
 * `refetchInterval` cai para 60s — espelha o TTL dinâmico do servidor. Caso
 * contrário, sem polling (`false`).
 */
function groupsQueryOptions() {
  return {
    queryKey: worldcupKeys.groups(),
    queryFn: getGroups,
    staleTime: STALE_TIME.grupos,
    refetchInterval: (query: Query<GroupsResponse>) =>
      query.state.data?.hasLiveGroupMatch ? 60_000 : false,
  } as const;
}

/**
 * Hook TanStack Query para a classificação completa da fase de grupos
 * (grupos-eliminatorias, TASK-05).
 *
 * Consome `getGroups` (TASK-05) → `GET /api/worldcup/groups` (proxy + cache
 * Firestore + validação no servidor).
 */
export function useGroups(): UseQueryResult<GroupsResponse> {
  return useQuery(groupsQueryOptions());
}

/**
 * Hook derivado: classificação de UM grupo, fatiada da mesma query `["groups"]`
 * via `select` (sem fetch extra — reusa a cache de `useGroups`).
 *
 * Decisão travada (plano §TASK-05): o `select` NÃO cria a cache entry
 * `["group", groupId]` do PRD — não há endpoint por grupo. Mantém uma única
 * fonte de verdade (`["groups"]`) e evita N requisições.
 *
 * @param groupId - Identificador do grupo (ex.: "A").
 * @returns `GroupTable` do grupo, ou `undefined` se o grupo não existir.
 */
export function useGroupStandings(
  groupId: string,
): UseQueryResult<GroupTable | undefined> {
  return useQuery({
    ...groupsQueryOptions(),
    select: (data) => data.groups.find((g) => g.groupId === groupId),
  });
}
