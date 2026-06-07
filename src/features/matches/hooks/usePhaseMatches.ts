"use client";

import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import type { MatchWithId, Stage } from "@/types";

import { useMatches } from "./useMatches";

/**
 * Filtra partidas do cache `useMatches()` pela fase (stage) informada.
 * Sem nova query de rede — deriva do cache existente via useMemo (OQ-5 do spec).
 * Ordena por kickoffAt ASC.
 *
 * @param stage - Fase da Copa (Stage enum: "grupos" | "oitavas" | "quartas" | etc.)
 */
export function usePhaseMatches(stage: Stage): UseQueryResult<MatchWithId[]> {
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

  // Retorna o formato UseQueryResult com os dados filtrados,
  // preservando todos os outros campos de estado da query base.
  return {
    ...matchesQuery,
    data: filteredData,
  } as UseQueryResult<MatchWithId[]>;
}
