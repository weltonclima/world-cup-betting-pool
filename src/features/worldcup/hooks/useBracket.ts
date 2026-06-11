"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getBracket } from "@/services/worldcup";
import { STALE_TIME } from "@/server/cache/tiers";
import type { BracketResponse } from "@/types";

import { worldcupKeys } from "./worldcupKeys";

/**
 * Hook TanStack Query para o chaveamento eliminatório (grupos-eliminatorias,
 * TASK-05).
 *
 * Consome `getBracket` (TASK-05) → `GET /api/worldcup/bracket` (proxy + cache
 * Firestore + validação no servidor).
 *
 * `staleTime` = `STALE_TIME.grupos` (24h), alinhado ao TTL da rota (TASK-04).
 *
 * Sem `refetchInterval`: o body de `/worldcup/bracket` é `BracketResponse` puro
 * (decisão TASK-04 — `hasLiveGroupMatch` só no payload de groups). Sem flag no
 * payload do bracket, não há gatilho de refetch ao vivo no client; revalidação
 * fica a cargo do `staleTime` + invalidação manual.
 */
export function useBracket(): UseQueryResult<BracketResponse> {
  return useQuery({
    queryKey: worldcupKeys.bracket(),
    queryFn: getBracket,
    staleTime: STALE_TIME.grupos,
  });
}
