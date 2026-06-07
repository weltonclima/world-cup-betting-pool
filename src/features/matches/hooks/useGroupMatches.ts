"use client";

import { useMemo } from "react";

import type { MatchWithId } from "@/types";

import { useMatches } from "./useMatches";

/** Resultado derivado de partidas filtradas (subset estável de UseQueryResult). */
export interface FilteredMatchesResult {
  data: MatchWithId[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** refetch estável do TanStack Query (identidade preservada entre renders). */
  refetch: () => unknown;
}

/**
 * Filtra partidas do cache `useMatches()` pelo groupId informado.
 * Sem nova query de rede — deriva do cache existente via useMemo (OQ-5 do spec).
 * Ordena por kickoffAt ASC.
 *
 * @param groupId - ID do grupo ("A"–"L"), conforme match.groupId populado pelo mapper openfootball.
 */
export function useGroupMatches(groupId: string): FilteredMatchesResult {
  const matchesQuery = useMatches();

  const filteredData = useMemo(() => {
    if (!matchesQuery.data) return undefined;
    return matchesQuery.data
      .filter((m) => m.groupId === groupId)
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [matchesQuery.data, groupId]);

  // Retorna apenas o subset que os consumidores usam — sem cast inseguro.
  // refetch é a referência estável do TanStack (não recriar — preserva identidade).
  return {
    data: filteredData,
    isLoading: matchesQuery.isLoading,
    isError: matchesQuery.isError,
    refetch: matchesQuery.refetch,
  };
}
