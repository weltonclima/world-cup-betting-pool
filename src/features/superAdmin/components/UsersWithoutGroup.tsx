"use client";

import { useMemo, useState, type JSX } from "react";
import { FolderPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAssignableUsers,
  useAssignUserToGroup,
} from "@/features/superAdmin/hooks";
import type { AdminUserRow, UsersAssignFilter } from "@/services/superAdmin";

import {
  SuperAdminSubHeader,
  SearchInput,
  ListState,
  GroupAvatar,
} from "./shared";
import { AssignGroupDialog } from "./AssignGroupDialog";

const STATUS_BADGE: Record<
  AdminUserRow["status"],
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  approved: { label: "Aprovado", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  blocked: { label: "Bloqueado", variant: "destructive" },
};

/**
 * Usuários sem grupo (super_admin). Sanea usuários órfãos (sem `groupId`, herança
 * da transição PRD-09) adicionando-os a um grupo ativo. O filtro "Todos" expõe
 * todos os usuários (com o grupo atual) para realocação.
 */
export function UsersWithoutGroup(): JSX.Element {
  const [filter, setFilter] = useState<UsersAssignFilter>("without-group");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useAssignableUsers(filter);

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.nickname.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <SuperAdminSubHeader
        title="Usuários sem grupo"
        subtitle="Adicione usuários órfãos a um grupo"
      />

      {/* Segmento: sem grupo (default) ↔ todos (realocação). */}
      <div
        role="tablist"
        aria-label="Filtrar usuários"
        className="flex rounded-lg border border-border p-1"
      >
        {(
          [
            { value: "without-group", label: "Sem grupo" },
            { value: "all", label: "Todos" },
          ] as const
        ).map((tab) => {
          const active = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.value)}
              className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome, apelido ou e-mail"
      />

      <ListState
        isLoading={isLoading}
        isError={isError}
        data={filtered}
        onRetry={() => void refetch()}
        emptyMessage={
          filter === "without-group"
            ? "Nenhum usuário sem grupo. 🎉"
            : "Nenhum usuário encontrado."
        }
      >
        {(rows) => (
          <ul className="flex flex-col rounded-xl border border-border">
            {rows.map((user) => (
              <UserRow key={user.uid} user={user} showGroup={filter === "all"} />
            ))}
          </ul>
        )}
      </ListState>
    </div>
  );
}

function UserRow({
  user,
  showGroup,
}: {
  user: AdminUserRow;
  showGroup: boolean;
}): JSX.Element {
  const assign = useAssignUserToGroup();
  const [open, setOpen] = useState(false);
  const status = STATUS_BADGE[user.status];

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GroupAvatar name={user.name} avatarUrl={user.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>
        </div>
        {user.email ? (
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        ) : null}
        {showGroup ? (
          <p className="truncate text-xs text-muted-foreground">
            {user.groupName ?? user.groupId ?? "Sem grupo"}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={assign.isPending}
        onClick={() => setOpen(true)}
        className="h-11 shrink-0 gap-1"
      >
        <FolderPlus size={16} aria-hidden="true" />
        {user.groupId ? "Mover" : "Adicionar"}
      </Button>

      <AssignGroupDialog
        open={open}
        onOpenChange={setOpen}
        userName={user.name}
        currentGroupId={user.groupId}
        pending={assign.isPending}
        onConfirm={(groupId) =>
          assign.mutate(
            { uid: user.uid, groupId },
            { onSuccess: () => setOpen(false) },
          )
        }
      />
    </li>
  );
}
