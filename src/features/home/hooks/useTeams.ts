"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listAllTeams } from "@/services";
import type { TeamWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para o cache de seleções (TASK-05).
 * Coleção pequena (≤ 48 docs), buscada uma vez e reutilizada como cache de join
 * client-side (resolução de nome/bandeira por teamId). Sem N+1.
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useTeams(): UseQueryResult<TeamWithId[]> {
  return useQuery({
    queryKey: homeKeys.teams,
    queryFn: listAllTeams,
  });
}
