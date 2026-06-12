"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPoolMembers, type PoolMember } from "@/services/superAdmin";

/** Membros approved de um pool (seletor de novo admin). `enabled` p/ lazy-load. */
export function usePoolMembers(
  poolId: string | null,
  enabled: boolean,
): UseQueryResult<PoolMember[], Error> {
  return useQuery<PoolMember[], Error>({
    queryKey: ["admin-pool-members", poolId],
    queryFn: () => listPoolMembers(poolId ?? ""),
    enabled: enabled && poolId !== null,
  });
}
