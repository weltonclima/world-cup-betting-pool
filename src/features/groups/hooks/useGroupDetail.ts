"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPool } from "@/services/pools";
import type { Pool } from "@/types/pools";

import { groupsKeys } from "./groupsKeys";

export interface GroupDetail {
  pool: Pool;
  memberCount: number;
}

/**
 * Detalha um pool por id (TASK-04). Desabilitado enquanto `id` for vazio.
 */
export function useGroupDetail(id: string): UseQueryResult<GroupDetail, Error> {
  return useQuery<GroupDetail, Error>({
    queryKey: groupsKeys.detail(id),
    queryFn: () => getPool(id),
    enabled: id.length > 0,
  });
}
