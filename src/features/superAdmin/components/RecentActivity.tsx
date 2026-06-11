"use client";

import type { JSX } from "react";
import Link from "next/link";

import { useAdminLogs } from "@/features/superAdmin/hooks";
import type { SystemLog } from "@/schemas/systemLogs";

import { formatDateTimePtBr } from "./shared";
import { LogIcon, logMeta } from "./logMeta";

const PREVIEW_COUNT = 4;

/** Feed "Atividade Recente" do dashboard (PRD11-01): últimos N system_logs. */
export function RecentActivity(): JSX.Element {
  const { data, isLoading, isError } = useAdminLogs();
  const logs = (data ?? []).slice(0, PREVIEW_COUNT);

  return (
    <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="recent-activity-heading" className="text-sm font-semibold text-foreground">
          Atividade Recente
        </h2>
        <Link
          href="/admin/logs-globais"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver todos
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Carregando atividade">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a atividade recente.
        </p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li key={log.id}>
              <ActivityRow log={log} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ log }: { log: SystemLog }): JSX.Element {
  const meta = logMeta(log.type);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <LogIcon type={log.type} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{meta.title}</span>
        <span className="truncate text-xs text-muted-foreground">{log.message}</span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDateTimePtBr(log.createdAt)}
      </span>
    </div>
  );
}
