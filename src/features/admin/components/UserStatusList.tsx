"use client";

import { useUsersByStatus } from "../hooks/useUsers";
import type { UserStatus } from "@/types";

import { UserActions } from "./UserActions";
import { UserList } from "./UserList";
import { UserListEmpty } from "./UserListEmpty";
import { UserListError } from "./UserListError";
import { UserListSkeleton } from "./UserListSkeleton";

export interface UserStatusListProps {
  status: UserStatus;
}

/**
 * Borda de dados de UMA tab: consome `useUsersByStatus(status)` (TASK-03) e
 * resolve, nesta ordem, loading → erro → vazio → lista. Injeta as ações de
 * moderação (TASK-07) por usuário via `renderActions`.
 */
export function UserStatusList({ status }: UserStatusListProps) {
  const { data, isPending, isError, refetch } = useUsersByStatus(status);

  if (isPending) return <UserListSkeleton />;
  if (isError) return <UserListError onRetry={() => void refetch()} />;
  if (data.length === 0) return <UserListEmpty status={status} />;
  return (
    <UserList
      users={data}
      renderActions={(user) => <UserActions user={user} status={status} />}
    />
  );
}
