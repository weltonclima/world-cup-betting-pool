"use client";

  import { useQuery, type UseQueryResult } from "@tanstack/react-query";

  import { getBracket } from "@/services/worldcup";
  import { STALE_TIME } from "@/server/cache/tiers";
  import type { BracketResponse } from "@/types/worldcup";

  import { worldcupKeys } from "./worldcupKeys";

  /**
   * Hook TanStack Query para o chaveamento do mata-mata (TASK-05).
   *
   * Consome `getBracket` → `GET /api/worldcup/bracket` (proxy + cache Next).
   *
   * `staleTime` = `STALE_TIME.grupos` (24h) — chaveamento é ainda mais estático
   * que a fase de grupos; fases avançam devagar (a cada 2-3 dias).
   *
   * Sem `refetchInterval` dinâmico: o body do bracket não carrega
   * `hasLiveGroupMatch` (spec §6.6); revalidação server-side é suficiente.
   */
  export function useBracket(): UseQueryResult<BracketResponse> {
    return useQuery({
      queryKey: worldcupKeys.bracket(),
      queryFn: getBracket,
      staleTime: STALE_TIME.grupos,
    });
  }