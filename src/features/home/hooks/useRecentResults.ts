"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getRecentFinishedMatches } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { MatchWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para as últimas partidas finalizadas (TASK-05; staleTime por
 * tier em TASK-06). Fonte agora é `/api/matches` (via `getRecentFinishedMatches`,
 * TASK-05), repoint transparente.
 *
 * Retorna MatchWithId[] (id = String(fixture.id)) para cruzar com prediction.matchId.
 *
 * `staleTime` = `STALE_TIME.jogoEncerrado` (5min). Justificativa: "últimos
 * resultados" são jogos recém-finalizados, ou seja, na janela quente onde o placar
 * oficial ainda pode sofrer ajustes (ver `revalidateForMatch` → `jogoEncerrado`
 * para finished < 6h). Alinhar o client a esse tier (5min) evita exibir um placar
 * provisório por mais tempo do que o servidor o mantém em cache. Preferido a
 * `jogoFuturo` (6h), que seria longo demais para resultados quentes.
 */
export function useRecentResults(): UseQueryResult<MatchWithId[]> {
  return useQuery({
    queryKey: homeKeys.recentResults(),
    queryFn: getRecentFinishedMatches,
    staleTime: STALE_TIME.jogoEncerrado,
  });
}
