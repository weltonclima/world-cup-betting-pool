"use client";

import { useMemo, useState, type JSX } from "react";
import { UserMinus, UserCog } from "lucide-react";

import { KebabMenu } from "@/features/groupAdmin/components/KebabMenu";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import {
  useAdminAdmins,
  useChangeGroupAdmin,
  useRemoveGroupAdmin,
} from "@/features/superAdmin/hooks";
import type { AdminEntry } from "@/services/superAdmin";

import {
  SuperAdminSubHeader,
  SearchInput,
  ListState,
  GroupAvatar,
  formatDatePtBr,
} from "./shared";
import { ChangeAdminDialog } from "./ChangeAdminDialog";

/**
 * Administradores (PRD11-05). Lista de group_admins: avatar, nome, "Grupo: X",
 * "Desde dd/MM/yyyy". KebabMenu por linha: Substituir (seletor de membro do pool
 * → changeGroupAdmin) e Remover (rebaixa a participant, B3 — confirmação). Sem
 * backend novo: reuso de PATCH/DELETE /admin.
 */
export function AdminsList(): JSX.Element {
  const { data, isLoading, isError, refetch } = useAdminAdmins();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.poolName.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <SuperAdminSubHeader title="Administradores" />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou grupo"
      />
      <ListState
        isLoading={isLoading}
        isError={isError}
        data={filtered}
        onRetry={() => void refetch()}
        emptyMessage="Nenhum administrador encontrado."
      >
        {(rows) => (
          <ul className="flex flex-col rounded-xl border border-border">
            {rows.map((entry) => (
              <AdminRow key={`${entry.poolId}:${entry.uid}`} entry={entry} />
            ))}
          </ul>
        )}
      </ListState>
    </div>
  );
}

function AdminRow({ entry }: { entry: AdminEntry }): JSX.Element {
  const changeAdmin = useChangeGroupAdmin();
  const removeAdmin = useRemoveGroupAdmin();
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const busy = changeAdmin.isPending || removeAdmin.isPending;

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GroupAvatar name={entry.name} avatarUrl={entry.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
        <p className="truncate text-sm text-muted-foreground">Grupo: {entry.poolName}</p>
        <p className="text-xs text-muted-foreground">
          Desde {formatDatePtBr(entry.since)}
        </p>
      </div>

      <KebabMenu
        label={`Ações para ${entry.name}`}
        actions={[
          {
            label: "Substituir",
            disabled: busy,
            icon: <UserCog size={16} aria-hidden="true" />,
            onSelect: () => setReplaceOpen(true),
          },
          {
            label: "Remover",
            destructive: true,
            disabled: busy,
            icon: <UserMinus size={16} aria-hidden="true" />,
            onSelect: () => setRemoveOpen(true),
          },
        ]}
      />

      <ChangeAdminDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        poolId={entry.poolId}
        poolName={entry.poolName}
        pending={changeAdmin.isPending}
        title="Substituir Admin"
        onConfirm={(adminId) =>
          changeAdmin.mutate(
            { id: entry.poolId, adminId },
            { onSuccess: () => setReplaceOpen(false) },
          )
        }
      />

      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remover administrador"
        description={`${entry.name} deixará de ser administrador do grupo ${entry.poolName} e voltará a ser participante. Deseja continuar?`}
        confirmLabel="Remover"
        confirmVariant="destructive"
        pending={removeAdmin.isPending}
        onConfirm={() =>
          removeAdmin.mutate(entry.poolId, {
            onSuccess: () => setRemoveOpen(false),
          })
        }
      />
    </li>
  );
}
