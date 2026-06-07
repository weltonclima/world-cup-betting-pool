"use client";

import { BarChart3 } from "lucide-react";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Placeholder animado para o Card Aproveitamento — exibir durante isLoading.
 */
export function AccuracyCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Aproveitamento"
      className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
    >
      <div
        aria-hidden="true"
        className="size-5 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-7 w-3/4 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-3 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AccuracyCardProps {
  /**
   * Aproveitamento 0–100 (statistics.accuracy, já calculado no backend).
   * null → sem dados ainda.
   * Per A3/D1 do PRD: sem denominador numérico no MVP — exibir só o percentual.
   */
  accuracy: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card compacto (1/3 da grade) para aproveitamento percentual.
 * Sem fração "X de Y" — card compacto não tem espaço (A3 do PRD).
 * Puramente apresentacional — sem hooks, sem fetch.
 */
export function AccuracyCard({ accuracy }: AccuracyCardProps) {
  const display =
    accuracy === null ? "--" : `${Math.round(accuracy)}%`;

  return (
    <article
      aria-label="Aproveitamento"
      className="rounded-lg border border-border bg-card p-3 shadow-sm flex flex-col gap-1"
    >
      <BarChart3
        size={20}
        aria-hidden="true"
        className="text-primary mb-1 shrink-0"
      />

      <span className="text-2xl font-bold text-foreground">{display}</span>

      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto">
        Aproveitamento
      </span>
    </article>
  );
}
