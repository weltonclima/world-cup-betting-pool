"use client";

import { useQuery, type Query, type UseQueryResult } from "@tanstack/react-query";

import { useActiveChampionship } from "@/features/championships";
import { STALE_TIME } from "@/server/cache/tiers";
import { getLeagueStandings } from "@/services/worldcup";
import type { LeagueStandingsResponse } from "@/types/leagues";

import { worldcupKeys } from "./worldcupKeys";

/**
 * Hook TanStack Query para a tabela de classificação da liga ATIVA (TASK-20).
 *
 * Consome `getLeagueStandings(activeChampionshipId)` → `GET /api/leagues/standings`.
 * Escopado ao campeonato ativo (`useActiveChampionship`) — a query key inclui o
 * id para isolar tabelas de ligas distintas na cache.
 *
 * `staleTime` = `STALE_TIME.grupos` (24h) — tabela é estável fora de partidas ao
 * vivo; revalidação server-side garante frescor. `refetchInterval`: 60s quando
 * há partida ao vivo (`hasLiveMatch`), espelhando `useGroups`.
 */
export function useLeagueStandings(): UseQueryResult<LeagueStandingsResponse> {
  const { activeChampionshipId } = useActiveChampionship();

  return useQuery({
    queryKey: worldcupKeys.standings(activeChampionshipId),
    queryFn: () => getLeagueStandings(activeChampionshipId),
    staleTime: STALE_TIME.grupos,
    refetchInterval: (query: Query<LeagueStandingsResponse>) =>
      (query.state.data as LeagueStandingsResponse | undefined)?.hasLiveMatch
        ? 60_000
        : false,
  });
}
