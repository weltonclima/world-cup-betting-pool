"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getArchivedChampionships } from "@/services/history";
import type { ArchivedChampionshipSummary } from "@/schemas/history";

import { historyKeys } from "./historyKeys";

/**
 * Lista de campeonatos arquivados do pool do usuário (`GET /api/history`,
 * TASK-15). Congelado por natureza — `staleTime` moderado (5min) evita refetch
 * a cada montagem sem deixar a lista sensivelmente desatualizada quando um
 * novo campeonato é arquivado.
 */
export function useArchivedChampionships(): UseQueryResult<
  ArchivedChampionshipSummary[],
  Error
> {
  return useQuery<ArchivedChampionshipSummary[], Error>({
    queryKey: historyKeys.list(),
    queryFn: () => getArchivedChampionships(),
    staleTime: 5 * 60 * 1000,
  });
}
