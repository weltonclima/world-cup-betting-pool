"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getNextScheduledMatch } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { MatchWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para a próxima partida agendada (TASK-05; staleTime por tier
 * em TASK-06). A fonte agora é `/api/matches` (via `getNextScheduledMatch`, TASK-05)
 * — repoint transparente, mesmo contrato.
 *
 * Retorna MatchWithId (id = String(fixture.id)) para cruzar com prediction.matchId.
 *
 * `staleTime` = `STALE_TIME.jogoDia` (30min): a "próxima partida" é tipicamente um
 * jogo do dia/próximo, cujo horário/status pode mudar ao longo do dia — 30min é o
 * tier sensato (e coincide com o default global, mas agora é explícito e atrelado à
 * fonte única de tiers).
 */
export function useNextMatch(): UseQueryResult<MatchWithId | null> {
  return useQuery({
    queryKey: homeKeys.nextMatch(),
    queryFn: getNextScheduledMatch,
    staleTime: STALE_TIME.jogoDia,
  });
}
