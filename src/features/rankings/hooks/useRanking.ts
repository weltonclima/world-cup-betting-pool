"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getRankingByScope } from "@/services";
import type { Ranking, RankingScope } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking de um escopo ("geral" ou uma das 5 fases) (TASK-05).
 * Cache herdado do QueryClient global (30min/24h) — sem override (decisão A3).
 */
export function useRanking(
  scope: RankingScope,
): UseQueryResult<Ranking | null> {
  return useQuery({
    queryKey: rankingKeys.scope(scope),
    queryFn: () => getRankingByScope(scope),
  });
}
