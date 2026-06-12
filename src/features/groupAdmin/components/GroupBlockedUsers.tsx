"use client";

import { useMemo, useState, type JSX } from "react";
import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import {
  AVATAR_CLASSES,
  getAvatarVariant,
  getInitials,
} from "@/features/admin/components/userAvatar";
import { useGroupUsers, useModerateGroupUser } from "@/features/groupAdmin/hooks";
import type { GroupUser } from "@/services/group";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { GroupSearchInput } from "./GroupSearchInput";
import { KebabMenu } from "./KebabMenu";
import { ErrorState, EmptyState, ListSkeleton } from "./GroupPendingUsers";

/**
 * Usuários Bloqueados (PRD10-04). Mostra o "Motivo:" do bloqueio, botão inline
 * Desbloquear (volta a aprovado) e, no kebab, Excluir do grupo (soft-delete D4 —
 * confirmação obrigatória). Busca + contador no rodapé.
 */
export function GroupBlockedUsers(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupUsers("blocked");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (g) =>
        g.user.name.toLowerCase().includes(q) ||
        g.user.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <GroupAdminSubHeader title="Usuários Bloqueados" />
      <GroupSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou e-mail"
      />

      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState message="Nenhum usuário bloqueado." />
      ) : (
        <>
          <ul className="flex flex-col rounded-xl border border-border">
            {filtered.map((g) => (
              <BlockedRow key={g.user.uid} groupUser={g} />
            ))}
          </ul>
          <p className="text-center text-sm text-muted-foreground">
            {data.length} {data.length === 1 ? "bloqueado" : "bloqueados"}
          </p>
        </>
      )}
    </div>
  );
}

function BlockedRow({ groupUser }: { groupUser: GroupUser }): JSX.Element {
  const { user } = groupUser;
  const moderate = useModerateGroupUser();
  const [removeOpen, setRemoveOpen] = useState(false);

  const variant = getAvatarVariant(user.uid);
  const busy = moderate.isPending;

  function onUnblock(): void {
    moderate.mutate({
      action: "unblock",
      uid: user.uid,
      from: "blocked",
      to: "approved",
    });
  }

  function onRemove(): void {
    // Soft-delete (D4): sai da lista de bloqueados; não notifica (vide hook).
    moderate.mutate(
      { action: "remove", uid: user.uid, from: "blocked", to: "blocked" },
      { onSuccess: () => setRemoveOpen(false) },
    );
  }

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <Avatar>
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback
          className={cn("text-sm font-medium", AVATAR_CLASSES[variant])}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Motivo:</span>{" "}
          {user.blockReason && user.blockReason.trim() ? user.blockReason : "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Desbloquear ${user.name}`}
          disabled={busy}
          onClick={onUnblock}
          className="h-11 gap-1.5"
        >
          {busy ? (
            <LoaderCircle
              size={16}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <RotateCcw size={16} aria-hidden="true" />
          )}
          Desbloquear
        </Button>
        <KebabMenu
          label={`Mais ações para ${user.name}`}
          actions={[
            {
              label: "Excluir do grupo",
              destructive: true,
              disabled: busy,
              icon: <Trash2 size={16} aria-hidden="true" />,
              onSelect: () => setRemoveOpen(true),
            },
          ]}
        />
      </div>

      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Excluir do grupo"
        description={`${user.name} será removido do grupo e perderá o acesso. Esta ação não pode ser desfeita. Deseja continuar?`}
        confirmLabel="Excluir"
        confirmVariant="destructive"
        pending={moderate.isPending}
        onConfirm={onRemove}
      />
    </li>
  );
}
