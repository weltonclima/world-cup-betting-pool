"use client";

import type { ReactNode } from "react";

import { useUsersByStatus } from "../hooks/useUsers";
import type { User, UserStatus } from "@/types";

import { UserList } from "./UserList";
import { UserListEmpty } from "./UserListEmpty";
import { UserListError } from "./UserListError";
import { UserListSkeleton } from "./UserListSkeleton";

export interface UserStatusListProps {
  status: UserStatus;
  /** Render-prop de ações por usuário (TASK-07). Ausente → read-only. */
  renderActions?: (user: User) => ReactNode;
}

/**
 * Borda de dados de UMA tab: consome `useUsersByStatus(status)` (TASK-03) e
 * resolve, nesta ordem, loading → erro → vazio → lista.
 */
export function UserStatusList({ status, renderActions }: UserStatusListProps) {
  const { data, isPending, isError, refetch } = useUsersByStatus(status);

  if (isPending) return <UserListSkeleton />;
  if (isError) return <UserListError onRetry={() => void refetch()} />;
  if (data.length === 0) return <UserListEmpty status={status} />;
  return <UserList users={data} renderActions={renderActions} />;
}
