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
 * Fonte CANÔNICA de teams (TASK-02 perf-hardening): `@/features/home/hooks/useTeams`
 * re-exporta ESTE hook, então Home, tela de Jogos e `GroupManualPredictions`
 * compartilham a mesma query key (`["matches","teams"]`) → 1 único fetch.
 */
export function useTeams(): UseQueryResult<TeamWithId[]> {
  return useQuery({
    queryKey: matchesKeys.teams(),
    queryFn: listAllTeams,
    staleTime: STALE_TIME.selecoes,
  });
}
