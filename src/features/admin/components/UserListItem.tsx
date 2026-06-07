import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

import {
  AVATAR_CLASSES,
  formatUserCreatedAt,
  getAvatarVariant,
  getInitials,
} from "./userAvatar";

export interface UserListItemProps {
  user: User;
  /** Slot de ações por linha. TASK-07 injeta os botões aqui; vazio na TASK-06. */
  actions?: ReactNode;
}

/** Item puro da lista de usuários: avatar (iniciais) + nome + email + data. */
export function UserListItem({ user, actions }: UserListItemProps) {
  const initials = getInitials(user.name);
  const variant = getAvatarVariant(user.uid);
  const createdAt = formatUserCreatedAt(user.createdAt);

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <Avatar>
        <AvatarFallback
          className={cn("text-sm font-medium", AVATAR_CLASSES[variant])}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {user.name}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        {createdAt ? (
          <p className="text-xs text-muted-foreground">{createdAt}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </li>
  );
}
