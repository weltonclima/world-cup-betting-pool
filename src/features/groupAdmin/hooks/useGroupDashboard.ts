"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getGroupDashboard, type GroupDashboard } from "@/services/group";

import { groupKeys } from "./groupKeys";

/** Dashboard do grupo (PRD-10, TASK-04). Contadores + últimos cadastros. */
export function useGroupDashboard(): UseQueryResult<GroupDashboard, Error> {
  return useQuery<GroupDashboard, Error>({
    queryKey: groupKeys.dashboard(),
    queryFn: () => getGroupDashboard(),
  });
}
