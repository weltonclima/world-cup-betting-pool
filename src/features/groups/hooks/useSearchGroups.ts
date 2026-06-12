"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { searchPools } from "@/services/pools";
import type { Pool } from "@/types/pools";

import { groupsKeys } from "./groupsKeys";

/**
 * Busca pools `active` por nome/slug (TASK-04). `q` vazio lista todos os ativos.
 * Habilitado sempre (a busca inicial sem termo é válida — lista de ativos).
 */
export function useSearchGroups(q = ""): UseQueryResult<Pool[], Error> {
  return useQuery<Pool[], Error>({
    queryKey: groupsKeys.search(q),
    queryFn: () => searchPools(q),
  });
}
