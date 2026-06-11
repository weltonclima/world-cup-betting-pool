"use client";

import { useMemo, useState, type JSX } from "react";
import { AlertCircle, Check, LoaderCircle, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AVATAR_CLASSES,
  getAvatarVariant,
  getInitials,
} from "@/features/admin/components/userAvatar";
import { useGroupUsers, useModerateGroupUser } from "@/features/groupAdmin/hooks";
import type { GroupUser } from "@/services/group";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { GroupSearchInput } from "./GroupSearchInput";
import { formatDatePtBr } from "./statusBadge";

/**
 * Usuários Pendentes (PRD10-02). Busca + filtro, cards com avatar/nome/email/data,
 * dois botões inline ✓ Aprovar (verde) / ✗ Rejeitar (vermelho), contador no rodapé.
 * Rejeitar ≡ blocked (A1). Confirmação inline (ação de baixo risco — sem dialog).
 */
export function GroupPendingUsers(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupUsers("pending");
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
      <GroupAdminSubHeader title="Usuários Pendentes" />
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
        <EmptyState message="Nenhum usuário pendente." />
      ) : (
        <>
          <ul className="flex flex-col rounded-xl border border-border">
            {filtered.map((g) => (
              <PendingRow key={g.user.uid} groupUser={g} />
            ))}
          </ul>
          <p className="text-center text-sm text-muted-foreground">
            {data.length} {data.length === 1 ? "pendente" : "pendentes"}
          </p>
        </>
      )}
    </div>
  );
}

function PendingRow({ groupUser }: { groupUser: GroupUser }): JSX.Element {
  const { user } = groupUser;
  const moderate = useModerateGroupUser();
  const variant = getAvatarVariant(user.uid);

  function act(action: "approve" | "reject"): void {
    moderate.mutate({
      action,
      uid: user.uid,
      from: "pending",
      to: action === "approve" ? "approved" : "blocked",
    });
  }

  const pending = moderate.isPending;

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
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
        <p className="text-xs text-muted-foreground">
          {formatDatePtBr(user.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Aprovar ${user.name}`}
          disabled={pending}
          onClick={() => act("approve")}
          className="size-11 border-emerald-600/40 text-emerald-600 hover:bg-emerald-600/10 hover:text-emerald-600"
        >
          {pending ? (
            <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Check size={18} aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Rejeitar ${user.name}`}
          disabled={pending}
          onClick={() => act("reject")}
          className="size-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center"
    >
      <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Erro ao carregar informações.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px]"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function ListSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col rounded-xl border border-border">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="size-10 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-3/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
