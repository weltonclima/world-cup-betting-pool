"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getRecentFinishedMatches } from "@/services";
import type { MatchWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para as últimas partidas finalizadas (TASK-05).
 * Retorna MatchWithId[] (com doc id do Firestore) para cruzar com prediction.matchId.
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useRecentResults(): UseQueryResult<MatchWithId[]> {
  return useQuery({
    queryKey: homeKeys.recentResults,
    queryFn: getRecentFinishedMatches,
  });
}
