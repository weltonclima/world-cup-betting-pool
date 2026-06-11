"use client";

import { useMemo, useState, type JSX } from "react";
import { Ban, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import {
  AVATAR_CLASSES,
  getAvatarVariant,
  getInitials,
} from "@/features/admin/components/userAvatar";
import {
  isGroupAdminRole,
  isSuperAdminRole,
} from "@/schemas/shared";
import {
  useGroupUsers,
  useModerateGroupUser,
  usePromoteGroupAdmin,
} from "@/features/groupAdmin/hooks";
import type { GroupUser } from "@/services/group";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { GroupSearchInput } from "./GroupSearchInput";
import { KebabMenu } from "./KebabMenu";
import { BlockReasonDialog } from "./BlockReasonDialog";
import { ErrorState, EmptyState, ListSkeleton } from "./GroupPendingUsers";

type FilterTab = "todos" | "participantes" | "admins";

/** Verdadeiro p/ admin do grupo (group_admin OU legado admin/super_admin). */
function isAdminUser(role: GroupUser["user"]["role"]): boolean {
  return isGroupAdminRole(role) || isSuperAdminRole(role);
}

/**
 * Usuários Aprovados (PRD10-03). Abas Todos/Participantes/Admins, lista ranqueada
 * (posição · pts · lugar), KebabMenu por linha com Bloquear (dialog de motivo, A5)
 * e Promover para Admin (D3: troca). super_admin não recebe ações (protegido).
 */
export function GroupApprovedUsers(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupUsers("approved");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("todos");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((g) => {
      const matchesTab =
        tab === "todos"
          ? true
          : tab === "admins"
            ? isAdminUser(g.user.role)
            : !isAdminUser(g.user.role);
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        g.user.name.toLowerCase().includes(q) ||
        g.user.email.toLowerCase().includes(q)
      );
    });
  }, [data, search, tab]);

  return (
    <div className="flex flex-col gap-4">
      <GroupAdminSubHeader title="Usuários Aprovados" />
      <GroupSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou e-mail"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as FilterTab)}
      >
        <TabsList className="w-full">
          <TabsTab value="todos">Todos</TabsTab>
          <TabsTab value="participantes">Participantes</TabsTab>
          <TabsTab value="admins">Admins</TabsTab>
        </TabsList>

        <TabsPanel value={tab}>
          {isError && !isLoading ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading || !data ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum participante encontrado." />
          ) : (
            <>
              <ul className="flex flex-col rounded-xl border border-border">
                {filtered.map((g, index) => (
                  <ApprovedRow
                    key={g.user.uid}
                    groupUser={g}
                    fallbackPosition={index + 1}
                  />
                ))}
              </ul>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {filtered.length}{" "}
                {filtered.length === 1 ? "participante" : "participantes"}
              </p>
            </>
          )}
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function ApprovedRow({
  groupUser,
  fallbackPosition,
}: {
  groupUser: GroupUser;
  fallbackPosition: number;
}): JSX.Element {
  const { user, rankingPoints, rankingPosition } = groupUser;
  const moderate = useModerateGroupUser();
  const promote = usePromoteGroupAdmin();
  const [blockOpen, setBlockOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const variant = getAvatarVariant(user.uid);
  const admin = isAdminUser(user.role);
  // super_admin é protegido — sem ações de moderação/promoção.
  const isProtected = isSuperAdminRole(user.role);
  const position = rankingPosition ?? fallbackPosition;
  const busy = moderate.isPending || promote.isPending;

  function onBlock(reason: string): void {
    moderate.mutate(
      {
        action: "block",
        uid: user.uid,
        from: "approved",
        to: "blocked",
        ...(reason ? { reason } : {}),
      },
      { onSuccess: () => setBlockOpen(false) },
    );
  }

  function onPromote(): void {
    promote.mutate(user.uid, { onSuccess: () => setPromoteOpen(false) });
  }

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums"
      >
        {position}
      </span>
      <Avatar>
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback
          className={cn("text-sm font-medium", AVATAR_CLASSES[variant])}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name}
          </p>
          {admin ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <ShieldCheck size={12} aria-hidden="true" />
              Admin
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {rankingPoints !== undefined ? `${rankingPoints} pts` : "—"}
          {" · "}
          {rankingPosition !== undefined ? `${rankingPosition}º lugar` : "—"}
        </p>
      </div>

      {isProtected ? null : (
        <KebabMenu
          label={`Ações para ${user.name}`}
          actions={[
            {
              label: "Bloquear",
              destructive: true,
              disabled: busy,
              icon: <Ban size={16} aria-hidden="true" />,
              onSelect: () => setBlockOpen(true),
            },
            ...(admin
              ? []
              : [
                  {
                    label: "Promover para Admin",
                    disabled: busy,
                    icon: <ShieldCheck size={16} aria-hidden="true" />,
                    onSelect: () => setPromoteOpen(true),
                  },
                ]),
          ]}
        />
      )}

      <BlockReasonDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        userName={user.name}
        pending={moderate.isPending}
        onConfirm={onBlock}
      />
      <ConfirmActionDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        title="Promover para Admin"
        description={`${user.name} se tornará administrador do grupo e você deixará de ser admin. Deseja continuar?`}
        confirmLabel="Promover"
        confirmVariant="default"
        pending={promote.isPending}
        onConfirm={onPromote}
      />
    </li>
  );
}
