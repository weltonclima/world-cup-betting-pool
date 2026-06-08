"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getGroupRanking } from "@/services";
import type { GroupRanking } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking de um grupo individual (A–L) (TASK-05).
 * Desabilitado enquanto `groupId` ausente; `groupId!` no queryFn é seguro sob `enabled`.
 */
export function useGroupRanking(
  groupId: string | undefined,
): UseQueryResult<GroupRanking | null> {
  return useQuery({
    queryKey: rankingKeys.group(groupId ?? "__none__"),
    queryFn: () => getGroupRanking(groupId!),
    enabled: Boolean(groupId),
  });
}
