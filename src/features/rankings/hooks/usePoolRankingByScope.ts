"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolRankingByScope } from "@/services";
import type { Ranking, RankingScope } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking de uma FASE recortado ao pool do usuário (PRD-09, Tela 03 "Por Fase").
 * O servidor resolve o pool pela sessão (o client nunca o envia); usuário sem pool
 * → `null`. Cache herdado do QueryClient global (30min/24h).
 */
export function usePoolRankingByScope(
  scope: RankingScope,
): UseQueryResult<Ranking | null> {
  return useQuery({
    queryKey: rankingKeys.poolScope(scope),
    queryFn: () => getPoolRankingByScope(scope),
  });
}
