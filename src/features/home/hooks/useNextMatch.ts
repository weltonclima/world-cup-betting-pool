"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getNextScheduledMatch } from "@/services";
import type { MatchWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para a próxima partida agendada (TASK-05).
 * Retorna MatchWithId (com doc id do Firestore) para cruzar com prediction.matchId.
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useNextMatch(): UseQueryResult<MatchWithId | null> {
  return useQuery({
    queryKey: homeKeys.nextMatch,
    queryFn: getNextScheduledMatch,
  });
}
