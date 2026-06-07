"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listAllTeams } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { TeamWithId } from "@/types";

import { matchesKeys } from "./matchesKeys";

/**
 * Hook TanStack Query para o cache de seleções (integracao-api-football, TASK-06).
 * Versão compartilhada/reutilizável pela feature matches (futura tela de Jogos),
 * com a MESMA política de cache da Home.
 *
 * Consome `listAllTeams` (TASK-05), que bate em `GET /api/teams`. Coleção pequena
 * (≤ 48 seleções na Copa 2026), buscada de uma vez e usada como cache de join por
 * id (nome/bandeira) — sem N+1.
 *
 * `staleTime` = `STALE_TIME.selecoes` (24h): seleções são dado estático (PRD-07),
 * só mudam antes da Copa / sob demanda, então não faz sentido revalidar a cada
 * 30min do default global.
 *
 * NOTA de coexistência: a Home tem seu próprio `useTeams` (`@/features/home/hooks`)
 * com query key `homeKeys.teams()` e o mesmo `staleTime`. Os caches são separados
 * por query key (`["home","teams"]` vs `["matches","teams"]`) de propósito — cada
 * feature controla a sua invalidação. A futura tela de Jogos deve usar ESTE hook.
 */
export function useTeams(): UseQueryResult<TeamWithId[]> {
  return useQuery({
    queryKey: matchesKeys.teams(),
    queryFn: listAllTeams,
    staleTime: STALE_TIME.selecoes,
  });
}
