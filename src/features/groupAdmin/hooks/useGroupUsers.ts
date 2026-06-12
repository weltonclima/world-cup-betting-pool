"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listGroupUsers, type GroupUser } from "@/services/group";
import type { UserStatus } from "@/types";

import { groupKeys } from "./groupKeys";

/** Lista usuários do pool por status (PRD-10, TASK-05). */
export function useGroupUsers(
  status: UserStatus,
): UseQueryResult<GroupUser[], Error> {
  return useQuery<GroupUser[], Error>({
    queryKey: groupKeys.usersByStatus(status),
    queryFn: () => listGroupUsers(status),
  });
}
