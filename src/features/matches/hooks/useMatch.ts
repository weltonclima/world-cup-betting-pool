"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getMatchById } from "@/services";
import { STALE_TIME } from "@/server/cache/tiers";
import type { MatchWithId } from "@/types";

import { matchesKeys } from "./matchesKeys";

/**
 * Hook TanStack Query para o detalhe de uma partida por id (integracao-api-football,
 * TASK-06). Reutilizável pela futura tela de detalhe de Jogo.
 *
 * Consome `getMatchById` (TASK-05), que bate em `GET /api/matches/:id`. Retorna
 * `null` quando a partida não existe (404 tratado no serviço).
 *
 * `staleTime` = `STALE_TIME.jogoDia` (30min), mesma simplificação por tier único
 * de `useMatches` (A5): a granularidade fina por status do jogo vive no
 * `revalidate` server-side do endpoint, não no `staleTime` do client. 30min é
 * sensato para um jogo individual cujo status pode mudar ao longo do dia.
 *
 * `enabled`: a query só dispara com `id` não-vazio — evita chamada inútil quando o
 * id ainda não está disponível (ex.: rota carregando).
 *
 * @param id Id da partida (= `String(fixture.id)` da API-Football). Vazio desabilita.
 */
export function useMatch(id: string): UseQueryResult<MatchWithId | null> {
  return useQuery({
    queryKey: matchesKeys.detail(id),
    queryFn: () => getMatchById(id),
    staleTime: STALE_TIME.jogoDia,
    enabled: id.length > 0,
  });
}
