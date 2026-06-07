import type { ReactNode } from "react";

import type { User } from "@/types";

import { UserListItem } from "./UserListItem";

export interface UserListProps {
  users: User[];
  /** Render-prop opcional p/ ações por usuário (TASK-07). Ausente → read-only. */
  renderActions?: (user: User) => ReactNode;
}

/** Lista pura de usuários (`<ul>`). */
export function UserList({ users, renderActions }: UserListProps) {
  return (
    <ul className="flex flex-col">
      {users.map((user) => (
        <UserListItem
          key={user.uid}
          user={user}
          actions={renderActions?.(user)}
        />
      ))}
    </ul>
  );
}
