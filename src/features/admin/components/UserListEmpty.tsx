import { Inbox, ShieldOff, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { UserStatus } from "@/types";

export interface UserListEmptyProps {
  status: UserStatus;
}

const EMPTY_BY_STATUS: Record<UserStatus, { icon: LucideIcon; text: string }> = {
  pending: { icon: Inbox, text: "Nenhum usuário pendente." },
  approved: { icon: UserX, text: "Nenhum usuário aprovado." },
  blocked: { icon: ShieldOff, text: "Nenhum usuário bloqueado." },
};

/** Estado vazio da lista, com texto contextual por status. */
export function UserListEmpty({ status }: UserListEmptyProps) {
  const { icon: Icon, text } = EMPTY_BY_STATUS[status];

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground"
    >
      <Icon size={24} aria-hidden="true" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
