"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolStats } from "@/services";
import type { PoolStats } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Estatísticas gerais do bolão (Tela 06) (TASK-05).
 */
export function usePoolStats(): UseQueryResult<PoolStats | null> {
  return useQuery({
    queryKey: rankingKeys.poolStats(),
    queryFn: getPoolStats,
  });
}
