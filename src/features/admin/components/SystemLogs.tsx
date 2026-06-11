"use client";

import { useState, type JSX } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  RankingEmptyState,
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import { cn } from "@/lib/utils";
import type { SystemLog, SystemLogLevel, SystemLogType } from "@/schemas/systemLogs";

import { useSystemLogs } from "../hooks/useSystemLogs";

type Filter = "all" | SystemLogType;

const TYPE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "login_admin", label: "Login Admin" },
  { value: "user_approved", label: "Aprovações" },
  { value: "user_blocked", label: "Bloqueios" },
  { value: "user_unblocked", label: "Reativações" },
  { value: "api_error", label: "Erros API" },
  { value: "ranking_update", label: "Ranking" },
];

const LEVEL_STYLE: Record<SystemLogLevel, { icon: LucideIcon; color: string }> = {
  info: { icon: CheckCircle2, color: "text-win" },
  warning: { icon: AlertTriangle, color: "text-muted-foreground" },
  error: { icon: XCircle, color: "text-destructive" },
};

const SOURCE_LABEL: Record<SystemLogType, string> = {
  login_admin: "Admin",
  user_approved: "Admin",
  user_blocked: "Admin",
  user_unblocked: "Admin",
  api_error: "API-Football",
  ranking_update: "Sistema",
  // PRD-11 — tipos globais do Super Admin (exibidos no mesmo feed legado).
  worldcup_synced: "Sistema",
  match_edited: "Super Admin",
  group_approved: "Super Admin",
  group_rejected: "Super Admin",
  group_blocked: "Super Admin",
  group_reactivated: "Super Admin",
  pool_admin_changed: "Super Admin",
  group_created: "Super Admin",
  group_updated: "Super Admin",
};

/** Tela — Logs do Sistema (PRD07-06). */
export function SystemLogs(): JSX.Element {
  const [filter, setFilter] = useState<Filter>("all");
  const query = useSystemLogs(filter === "all" ? undefined : filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro por tipo */}
      <div
        role="tablist"
        aria-label="Filtrar logs por tipo"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {TYPE_FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <RankingSkeleton rows={6} />
      ) : query.isError ? (
        <RankingErrorState
          message="Erro ao carregar os logs"
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <RankingEmptyState
          message="Nenhum log encontrado"
          subtitle="Eventos do sistema aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(query.data ?? []).map((log) => (
            <li key={log.id}>
              <LogRow log={log} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogRow({ log }: { log: SystemLog }): JSX.Element {
  const { icon: Icon, color } = LEVEL_STYLE[log.level];
  const time = format(new Date(log.createdAt), "HH:mm:ss");
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Icon size={18} aria-hidden="true" className={cn("mt-0.5 shrink-0", color)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">{log.message}</span>
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABEL[log.type]}
        </span>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {time}
      </span>
    </div>
  );
}
