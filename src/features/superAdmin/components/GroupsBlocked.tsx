"use client";

import { useMemo, useState, type JSX } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { KebabMenu } from "@/features/groupAdmin/components/KebabMenu";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import {
  useAdminGroups,
  useUpdateGroupStatus,
  useDeleteGroup,
} from "@/features/superAdmin/hooks";
import type { AdminPoolRow } from "@/services/superAdmin";

import {
  SuperAdminSubHeader,
  SearchInput,
  ListState,
  GroupAvatar,
  formatDatePtBr,
} from "./shared";

/**
 * Grupos Bloqueados (PRD11-04). Lista com badge "Bloqueado". KebabMenu por linha:
 * Reativar (status→active) e Excluir (soft-delete, B2 — dialog de confirmação
 * destrutivo). A exclusão é irreversível pela UI (deletedAt).
 */
export function GroupsBlocked(): JSX.Element {
  const { data, isLoading, isError, refetch } = useAdminGroups("blocked");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (g) =>
        g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <SuperAdminSubHeader title="Grupos Bloqueados" />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou slug"
      />
      <ListState
        isLoading={isLoading}
        isError={isError}
        data={filtered}
        onRetry={() => void refetch()}
        emptyMessage="Nenhum grupo bloqueado."
      >
        {(rows) => (
          <ul className="flex flex-col rounded-xl border border-border">
            {rows.map((pool) => (
              <BlockedRow key={pool.id} pool={pool} />
            ))}
          </ul>
        )}
      </ListState>
    </div>
  );
}

function BlockedRow({ pool }: { pool: AdminPoolRow }): JSX.Element {
  const update = useUpdateGroupStatus();
  const remove = useDeleteGroup();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const busy = update.isPending || remove.isPending;

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GroupAvatar name={pool.name} photoBase64={pool.photoBase64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{pool.name}</p>
          <Badge variant="destructive" className="shrink-0">
            Bloqueado
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{pool.slug}</p>
        <p className="text-xs text-muted-foreground">{formatDatePtBr(pool.createdAt)}</p>
      </div>

      <KebabMenu
        label={`Ações para ${pool.name}`}
        actions={[
          {
            label: "Reativar",
            disabled: busy,
            icon: <RotateCcw size={16} aria-hidden="true" />,
            onSelect: () => update.mutate({ id: pool.id, status: "active" }),
          },
          {
            label: "Excluir",
            destructive: true,
            disabled: busy,
            icon: <Trash2 size={16} aria-hidden="true" />,
            onSelect: () => setDeleteOpen(true),
          },
        ]}
      />

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir grupo"
        description={`O grupo ${pool.name} será excluído permanentemente. Esta ação não pode ser desfeita. Deseja continuar?`}
        confirmLabel="Excluir"
        confirmVariant="destructive"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(pool.id, { onSuccess: () => setDeleteOpen(false) })
        }
      />
    </li>
  );
}
