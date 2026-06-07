"use client";

import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import type { MatchWithId } from "@/types";

import { useMatches } from "./useMatches";

/**
 * Filtra partidas do cache `useMatches()` pelo groupId informado.
 * Sem nova query de rede — deriva do cache existente via useMemo (OQ-5 do spec).
 * Ordena por kickoffAt ASC.
 *
 * @param groupId - ID do grupo ("A"–"L"), conforme match.groupId populado pelo mapper openfootball.
 */
export function useGroupMatches(groupId: string): UseQueryResult<MatchWithId[]> {
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

  // Retorna o formato UseQueryResult com os dados filtrados,
  // preservando todos os outros campos de estado da query base.
  return {
    ...matchesQuery,
    data: filteredData,
  } as UseQueryResult<MatchWithId[]>;
}
