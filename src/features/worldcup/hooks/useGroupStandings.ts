"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";

import { getGroups } from "@/services/worldcup";
import { STALE_TIME } from "@/server/cache/tiers";
import type { GroupsResponse, GroupTable } from "@/types/worldcup";

import { worldcupKeys } from "./worldcupKeys";

/**
 * Hook TanStack Query para a tabela de um grupo específico (TASK-05).
 *
 * Decisão de design (spec §6.5, plan-checker confirmado):
 * Usa a mesma query base `["groups"]` / `getGroups` que `useGroups`, com
 * `select` para derivar o slice do grupo — evita uma cache entry separada
 * (e uma requisição duplicada) para cada grupo. `worldcupKeys.group(groupId)`
 * existe na factory por fidelidade ao PRD, mas NÃO é usada como queryKey aqui.
 *
 * `refetchInterval`: callback recebe o objeto `Query` **bruto** (pré-select).
 * `query.state.data` é `GroupsResponse | undefined` — campo `hasLiveGroupMatch`
 * está disponível diretamente, sem transformação pelo `select` (spec §14).
 *
 * @param groupId - Identificador do grupo (ex.: "A", "B", …).
 * @returns `GroupTable` do grupo, ou `null` quando não encontrado.
 */
export function useGroupStandings(groupId: string): UseQueryResult<GroupTable | null> {
  return useQuery({
    queryKey: worldcupKeys.groups(),
    queryFn: getGroups,
    staleTime: STALE_TIME.grupos,
    refetchInterval: (query: Query<GroupsResponse>) =>
      (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch
        ? 60_000
        : false,
    select: (data: GroupsResponse): GroupTable | null =>
      data.groups.find((g) => g.groupId === groupId) ?? null,
  });
}
