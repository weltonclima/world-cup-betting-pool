"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolRanking } from "@/services";
import type { PoolRanking } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking FECHADO do pool do usuário (PRD-09). Só habilita quando há `groupId`
 * (usuário sem pool não tem ranking). O `groupId` entra apenas na query-key para
 * separar o cache por pool — o servidor resolve o pool real pela sessão (o client
 * nunca envia o pool). Cache herdado do QueryClient global (30min/24h).
 */
export function usePoolRanking(
  groupId: string | undefined,
): UseQueryResult<PoolRanking | null> {
  return useQuery({
    queryKey: rankingKeys.pool(groupId ?? "none"),
    queryFn: getPoolRanking,
    enabled: Boolean(groupId),
    // Voltar à tela de ranking (remount) revalida sempre, ignorando staleTime.
    refetchOnMount: "always",
  });
}
