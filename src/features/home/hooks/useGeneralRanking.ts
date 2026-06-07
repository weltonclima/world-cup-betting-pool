"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getGeneralRanking } from "@/services";
import type { Ranking } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para o ranking geral (TASK-05).
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useGeneralRanking(): UseQueryResult<Ranking | null> {
  return useQuery({
    queryKey: homeKeys.generalRanking(),
    queryFn: getGeneralRanking,
  });
}
