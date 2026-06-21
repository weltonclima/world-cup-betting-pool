"use client";

import type { JSX } from "react";

import { cn } from "@/lib/utils";
import type { NotificationType } from "@/schemas/notifications";

/** Valor do filtro: "all" (Todas) ou uma categoria. */
export type NotificationFilter = "all" | NotificationType;

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "system", label: "Sistema" },
  { value: "games", label: "Jogos" },
  { value: "ranking", label: "Ranking" },
];

/** Filtros por categoria (PRD08-01) — pílulas roláveis horizontalmente. */
export function NotificationFilters({
  value,
  onChange,
}: {
  value: NotificationFilter;
  onChange: (next: NotificationFilter) => void;
}): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Filtrar notificações"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {FILTERS.map((filter) => {
        const active = value === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.value)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
