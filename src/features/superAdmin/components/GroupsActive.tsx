"use client";

import { useMemo, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { KebabMenu } from "@/features/groupAdmin/components/KebabMenu";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import {
  useAdminGroups,
  useUpdateGroupStatus,
  useChangeGroupAdmin,
} from "@/features/superAdmin/hooks";
import type { AdminPoolRow } from "@/services/superAdmin";

import {
  SuperAdminSubHeader,
  SearchInput,
  ListState,
  GroupAvatar,
} from "./shared";
import { ChangeAdminDialog } from "./ChangeAdminDialog";

/**
 * Grupos Ativos (PRD11-03). Lista com avatar/nome/slug/contagem de participantes
 * e badge "Ativo". KebabMenu por linha: Visualizar (→ /grupos/[id], read-only),
 * Bloquear (status→blocked, dialog de confirmação) e Alterar Admin (seletor de
 * membro → changeGroupAdmin).
 */
export function GroupsActive(): JSX.Element {
  const { data, isLoading, isError, refetch } = useAdminGroups("active");
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
      <SuperAdminSubHeader title="Grupos Ativos" />
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
        emptyMessage="Nenhum grupo ativo."
      >
        {(rows) => (
          <ul className="flex flex-col rounded-xl border border-border">
            {rows.map((pool) => (
              <ActiveRow key={pool.id} pool={pool} />
            ))}
          </ul>
        )}
      </ListState>
    </div>
  );
}

function ActiveRow({ pool }: { pool: AdminPoolRow }): JSX.Element {
  const router = useRouter();
  const update = useUpdateGroupStatus();
  const changeAdmin = useChangeGroupAdmin();
  const [blockOpen, setBlockOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const busy = update.isPending || changeAdmin.isPending;

  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GroupAvatar name={pool.name} photoBase64={pool.photoBase64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{pool.name}</p>
          <Badge variant="success" className="shrink-0">
            Ativo
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{pool.slug}</p>
        <p className="text-xs text-muted-foreground">
          {pool.participantCount}{" "}
          {pool.participantCount === 1 ? "participante" : "participantes"}
        </p>
      </div>

      <KebabMenu
        label={`Ações para ${pool.name}`}
        actions={[
          {
            label: "Visualizar",
            icon: <Eye size={16} aria-hidden="true" />,
            onSelect: () => router.push(`/grupos/${pool.id}`),
          },
          {
            label: "Alterar Admin",
            disabled: busy,
            icon: <UserCog size={16} aria-hidden="true" />,
            onSelect: () => setAdminOpen(true),
          },
          {
            label: "Bloquear",
            destructive: true,
            disabled: busy,
            icon: <Ban size={16} aria-hidden="true" />,
            onSelect: () => setBlockOpen(true),
          },
        ]}
      />

      <ConfirmActionDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Bloquear grupo"
        description={`O grupo ${pool.name} será bloqueado e seus membros perderão o acesso. Deseja continuar?`}
        confirmLabel="Bloquear"
        confirmVariant="destructive"
        pending={update.isPending}
        onConfirm={() =>
          update.mutate(
            { id: pool.id, status: "blocked" },
            { onSuccess: () => setBlockOpen(false) },
          )
        }
      />

      <ChangeAdminDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
        poolId={pool.id}
        poolName={pool.name}
        pending={changeAdmin.isPending}
        onConfirm={(adminId) =>
          changeAdmin.mutate(
            { id: pool.id, adminId },
            { onSuccess: () => setAdminOpen(false) },
          )
        }
      />
    </li>
  );
}
