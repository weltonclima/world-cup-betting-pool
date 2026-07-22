"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getChampionshipHistory, type ChampionshipHistory } from "@/services/history";

import { historyKeys } from "./historyKeys";

/**
 * Detalhe congelado de um campeonato arquivado (`GET /api/history/[id]`,
 * TASK-15): ranking final + estatísticas do pool (quando houver) + jogos.
 * `null` = campeonato não encontrado no histórico (404 — id desconhecido ou
 * não-arquivado). `staleTime` moderado (5min): dado congelado, não muda entre
 * navegações da mesma sessão.
 */
export function useChampionshipHistory(
  championshipId: string,
): UseQueryResult<ChampionshipHistory | null, Error> {
  return useQuery<ChampionshipHistory | null, Error>({
    queryKey: historyKeys.detail(championshipId),
    queryFn: () => getChampionshipHistory(championshipId),
    enabled: championshipId.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
