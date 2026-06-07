"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listAllTeams } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { TeamWithId } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para o cache de seleções (TASK-05; staleTime por tier em
 * TASK-06). Fonte agora é `/api/teams` (via `listAllTeams`, TASK-05), repoint
 * transparente.
 *
 * Coleção pequena (≤ 48 docs), buscada uma vez e reutilizada como cache de join
 * client-side (resolução de nome/bandeira por teamId). Sem N+1.
 *
 * `staleTime` = `STALE_TIME.selecoes` (24h): seleções são dado estático (PRD-07),
 * mudam só antes da Copa / sob demanda — não faz sentido revalidar a cada 30min do
 * default global.
 *
 * NOTA: a feature matches expõe um `useTeams` equivalente (`@/features/matches`)
 * com mesmo tier, para a futura tela de Jogos; os caches são separados por query
 * key de propósito (ver `useTeams` de matches).
 */
export function useTeams(): UseQueryResult<TeamWithId[]> {
  return useQuery({
    queryKey: homeKeys.teams(),
    queryFn: listAllTeams,
    staleTime: STALE_TIME.selecoes,
  });
}
