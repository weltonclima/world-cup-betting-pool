"use client";

import { useMemo, useState, type JSX } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAdminLogs } from "@/features/superAdmin/hooks";
import type { SystemLog, SystemLogType } from "@/schemas/systemLogs";

import {
  SuperAdminSubHeader,
  SearchInput,
  ListState,
  formatDateTimePtBr,
} from "./shared";
import { LogIcon, logMeta } from "./logMeta";

// Tipos de log oferecidos no filtro (PRD-11 + legados PRD-07 mais úteis).
const LOG_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "worldcup_synced", label: "Sincronização da Copa" },
  { value: "match_edited", label: "Resultado editado" },
  { value: "group_approved", label: "Grupo aprovado" },
  { value: "group_rejected", label: "Grupo rejeitado" },
  { value: "group_blocked", label: "Grupo bloqueado" },
  { value: "group_reactivated", label: "Grupo reativado" },
  { value: "pool_admin_changed", label: "Administrador alterado" },
  { value: "group_created", label: "Grupo criado" },
  { value: "group_updated", label: "Grupo editado" },
];

/**
 * Logs Globais (PRD11-09). Filtro por tipo (server-side via listLogs(type), B4) +
 * busca client-side por mensagem. Cada linha abre Detalhes do Log (PRD11-10) com
 * os campos completos. Leitura super_admin via Firestore Rules.
 */
export function GlobalLogs(): JSX.Element {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SystemLog | null>(null);

  const { data, isLoading, isError, refetch } = useAdminLogs(
    type ? (type as SystemLogType) : undefined,
  );

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        logMeta(l.type).title.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <SuperAdminSubHeader title="Logs do Sistema" />

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar logs" />

      <select
        aria-label="Filtrar por tipo"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {LOG_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <ListState
        isLoading={isLoading}
        isError={isError}
        data={filtered}
        onRetry={() => void refetch()}
        emptyMessage="Nenhum log encontrado."
      >
        {(rows) => (
          <ul className="flex flex-col gap-2">
            {rows.map((log) => (
              <li key={log.id}>
                <LogRow log={log} onSelect={() => setSelected(log)} />
              </li>
            ))}
          </ul>
        )}
      </ListState>

      <LogDetailDialog
        log={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

/**
 * Humaniza o ator do log. SystemLog só carrega `actorUid` (sem nome) — ações
 * automáticas usam o sentinel "system"; demais exibem o UID cru (resolução
 * UID→nome ficaria a cargo de um fetch de usuários, fora do escopo deste slice).
 */
function formatActor(actorUid: string): string {
  return actorUid === "system" ? "Sistema" : actorUid;
}

function LogRow({
  log,
  onSelect,
}: {
  log: SystemLog;
  onSelect: () => void;
}): JSX.Element {
  const meta = logMeta(log.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
    >
      <LogIcon type={log.type} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{meta.title}</span>
        <span className="text-xs text-muted-foreground">{log.message}</span>
        <span className="truncate text-xs text-muted-foreground">
          Executado por: {formatActor(log.actorUid)}
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTimePtBr(log.createdAt)}
        </span>
      </div>
    </button>
  );
}

/** Detalhes do Log (PRD11-10): campos completos do evento selecionado. */
function LogDetailDialog({
  log,
  onOpenChange,
}: {
  log: SystemLog | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  if (!log) return null;
  const meta = logMeta(log.type);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIcon type={log.type} />
            {meta.title}
          </DialogTitle>
          <DialogDescription>{log.message}</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2 text-sm">
          <DetailRow label="Tipo" value={meta.title} />
          <DetailRow label="Nível" value={log.level} />
          <DetailRow label="Executado por" value={formatActor(log.actorUid)} />
          {log.targetUid ? <DetailRow label="Alvo" value={log.targetUid} /> : null}
          <DetailRow label="Data" value={formatDateTimePtBr(log.createdAt)} />
        </dl>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11">Fechar</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
