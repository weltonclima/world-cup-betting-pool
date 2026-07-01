"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listMatches } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { MatchWithId } from "@/types";

import { matchesKeys } from "./matchesKeys";

/**
 * Hook TanStack Query para a listagem completa de partidas (integracao-api-football,
 * TASK-06). Reutilizável pela futura tela de Jogos.
 *
 * Consome `listMatches` (TASK-05), que bate em `GET /api/matches` (proxy + cache +
 * validação no servidor; o browser nunca fala com a API-Football).
 *
 * `staleTime` = `STALE_TIME.jogoDia` (30min). A escolha do tier de cache é, a
 * rigor, por partida e por status (ver `revalidateForMatch` em
 * `src/server/cache/tiers.ts`): jogos ao vivo (1min) e encerrados na janela quente
 * (5min) são mais voláteis que jogos futuros (6h). Como esta query é uma LISTA
 * heterogênea (mistura status), aplicamos um tier único como simplificação aceita
 * (A5 do plano): `jogoDia` (30min) é o ponto médio sensato — frequente o bastante
 * para refletir mudanças de placar/status sem revalidar a lista inteira a cada
 * minuto. Granularidade fina por status fica a cargo do `revalidate` server-side
 * de cada endpoint, não do `staleTime` desta lista agregada.
 */
export function useMatches(): UseQueryResult<MatchWithId[]> {
  return useQuery({
    queryKey: matchesKeys.list(),
    queryFn: listMatches,
    staleTime: STALE_TIME.jogoDia,
    // Voltar à tela de jogos (remount) revalida sempre, ignorando staleTime.
    refetchOnMount: "always",
  });
}
