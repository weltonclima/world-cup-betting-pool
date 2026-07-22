"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolRanking } from "@/services";
import type { PoolRanking } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking FECHADO do pool do usuário (PRD-09; multi-championship TASK-12). Só
 * habilita quando há `groupId` (usuário sem pool não tem ranking). O `groupId` entra
 * apenas na query-key para separar o cache por pool — o servidor resolve o pool real
 * pela sessão (o client nunca envia o pool). `championship` opcional seleciona um
 * campeonato específico (modo `por-campeonato`); ausente = agregado/geral do pool.
 * Entra na query-key (cache separado) e no fetch. Cache herdado do QueryClient
 * global (30min/24h).
 */
export function usePoolRanking(
  groupId: string | undefined,
  championship?: string,
): UseQueryResult<PoolRanking | null> {
  return useQuery({
    queryKey: rankingKeys.pool(groupId ?? "none", championship ?? "all"),
    queryFn: () => getPoolRanking(championship),
    enabled: Boolean(groupId),
    // Voltar à tela de ranking (remount) revalida sempre, ignorando staleTime.
    refetchOnMount: "always",
  });
}
