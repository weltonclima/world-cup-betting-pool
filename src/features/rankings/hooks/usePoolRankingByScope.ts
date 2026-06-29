"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { getPoolRankingByScope } from "@/services";
import type { Ranking, RankingScope } from "@/types";

import { rankingKeys } from "./rankingKeys";

/** Opções do hook de ranking por fase recortado ao pool. */
export interface UsePoolRankingByScopeOptions {
  /**
   * Liga/desliga a query (gating). `false` evita disparar a leitura — usado pelo
   * split-phase-ranking p/ NÃO buscar os escopos quando a flag do pool está OFF.
   * Default `true` (consumidores existentes não mudam de comportamento).
   */
  enabled?: boolean;
}

/**
 * Ranking de uma FASE recortado ao pool do usuário (PRD-09, Tela 03 "Por Fase").
 * O servidor resolve o pool pela sessão (o client nunca o envia); usuário sem pool
 * → `null`. O `groupId` da sessão entra apenas na query-key para separar o cache por
 * pool. Cache herdado do QueryClient global (30min/24h).
 */
export function usePoolRankingByScope(
  scope: RankingScope,
  options?: UsePoolRankingByScopeOptions,
): UseQueryResult<Ranking | null> {
  const groupId = useAuth().profile?.groupId;
  return useQuery({
    queryKey: rankingKeys.poolScope(groupId ?? "none", scope),
    queryFn: () => getPoolRankingByScope(scope),
    enabled: options?.enabled ?? true,
  });
}
