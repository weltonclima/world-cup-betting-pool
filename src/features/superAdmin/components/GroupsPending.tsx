"use client";

import { useMemo, useState, type JSX } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useAdminGroups,
  useUpdateGroupStatus,
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
 * Grupos Pendentes (PRD11-02). Busca + cards com avatar/nome/slug/data e dois
 * botões: verde ✓ Aprovar (status→active) e vermelho ✗ Rejeitar (status→blocked,
 * decisão B1). Ações otimizam invalidação via hooks; lista some ao mudar status.
 */
export function GroupsPending(): JSX.Element {
  const { data, isLoading, isError, refetch } = useAdminGroups("pending");
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
      <SuperAdminSubHeader title="Grupos Pendentes" />
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
        emptyMessage="Nenhum grupo pendente."
      >
        {(rows) => (
          <ul className="flex flex-col gap-3">
            {rows.map((pool) => (
              <PendingCard key={pool.id} pool={pool} />
            ))}
          </ul>
        )}
      </ListState>
    </div>
  );
}

function PendingCard({ pool }: { pool: AdminPoolRow }): JSX.Element {
  const update = useUpdateGroupStatus();
  const busy = update.isPending;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <GroupAvatar name={pool.name} photoBase64={pool.photoBase64} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{pool.name}</p>
        <p className="truncate text-sm text-muted-foreground">{pool.slug}</p>
        <p className="text-xs text-muted-foreground">{formatDatePtBr(pool.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Aprovar ${pool.name}`}
          disabled={busy}
          aria-busy={busy}
          onClick={() => update.mutate({ id: pool.id, status: "active" })}
          className="size-11 border-emerald-600/40 text-emerald-600 hover:bg-emerald-600/10"
        >
          {busy ? (
            <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Check size={18} aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Rejeitar ${pool.name}`}
          disabled={busy}
          onClick={() => update.mutate({ id: pool.id, status: "blocked" })}
          className="size-11 border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
