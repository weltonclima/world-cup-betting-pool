"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getChampionshipsCatalog } from "@/services/championships";
import type { ChampionshipPublic } from "@/types/championships";

import { groupKeys } from "./groupKeys";

/**
 * Lê o catálogo público de campeonatos (`GET /api/championships`, TASK-06) para a
 * seção Campeonatos (TASK-08). Catálogo é estático (servidor cacheia 24h); usa
 * `staleTime` longo para evitar refetch a cada montagem da seção.
 */
export function useChampionshipsCatalog(): UseQueryResult<
  ChampionshipPublic[],
  Error
> {
  return useQuery<ChampionshipPublic[], Error>({
    queryKey: groupKeys.championshipsCatalog(),
    queryFn: () => getChampionshipsCatalog(),
    staleTime: 24 * 60 * 60 * 1000, // 24h — alinha ao cache do servidor
  });
}
