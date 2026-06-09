"use client";

import { useMemo } from "react";

import type { Stage } from "@/types";

import { useMatches } from "./useMatches";
import type { FilteredMatchesResult } from "./useGroupMatches";

/**
 * Filtra partidas do cache `useMatches()` pela fase (stage) informada.
 * Sem nova query de rede — deriva do cache existente via useMemo (OQ-5 do spec).
 * Ordena por kickoffAt ASC.
 *
 * @param stage - Fase da Copa (Stage enum: "grupos" | "oitavas" | "quartas" | etc.)
 */
export function usePhaseMatches(stage: Stage): FilteredMatchesResult {
  const matchesQuery = useMatches();

  const filteredData = useMemo(() => {
    if (!matchesQuery.data) return undefined;
    return matchesQuery.data
      .filter((m) => m.stage === stage)
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [matchesQuery.data, stage]);

  // Retorna apenas o subset que os consumidores usam — sem cast inseguro.
  // refetch é a referência estável do TanStack (não recriar — preserva identidade).
  return {
    data: filteredData,
    isLoading: matchesQuery.isLoading,
    isError: matchesQuery.isError,
    refetch: matchesQuery.refetch,
  };
}
