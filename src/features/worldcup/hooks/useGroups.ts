"use client";

  import { useQuery, type UseQueryResult } from "@tanstack/react-query";
  import type { Query } from "@tanstack/react-query";

  import { getGroups } from "@/services/worldcup";
  import { STALE_TIME } from "@/server/cache/tiers";
  import type { GroupsResponse } from "@/types/worldcup";

  import { worldcupKeys } from "./worldcupKeys";

  /**
   * Hook TanStack Query para a classificação completa dos grupos (TASK-05).
   *
   * Consome `getGroups` → `GET /api/worldcup/groups` (proxy + cache Next).
   *
   * `staleTime` = `STALE_TIME.grupos` (24h) — dados de grupo são estáticos
   * durante a fase de grupos; revalidação server-side garante frescor.
   *
   * `refetchInterval`: quando há partida de grupo ao vivo (`hasLiveGroupMatch`),
   * revalida a cada 60s para refletir atualizações de posição em tempo real.
   * O callback recebe o objeto `Query` bruto (pré-select) — `query.state.data`
   * é `GroupsResponse | undefined`, fonte não transformada (spec §14).
   */
  export function useGroups(): UseQueryResult<GroupsResponse> {
    return useQuery({
      queryKey: worldcupKeys.groups(),
      queryFn: getGroups,
      staleTime: STALE_TIME.grupos,
      refetchInterval: (query: Query<GroupsResponse>) =>
        (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch
          ? 60_000
          : false,
    });
  }