"use client";

import { Trophy } from "lucide-react";

import type { RankingSummary } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Placeholder animado para o Card Ranking Geral — exibir durante isLoading.
 * Padrão de skeleton: animate-pulse motion-reduce:animate-none bg-muted.
 */
export function RankingCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Ranking Geral"
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

export interface RankingCardProps {
  /** Dados derivados de deriveRankingSummary. null → estado empty (sem ranking). */
  summary: RankingSummary | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card compacto (1/3 da grade) para Ranking Geral.
 * Mostra posição "#N", denominador "de N participantes" e pontuação.
 * Puramente apresentacional — sem hooks, sem fetch.
 */
export function RankingCard({ summary }: RankingCardProps) {
  return (
    <article
      aria-label="Ranking Geral"
      className="rounded-lg border border-border bg-card p-3 shadow-sm flex flex-col gap-1"
    >
      <Trophy
        size={20}
        aria-hidden="true"
        className="text-primary mb-1 shrink-0"
      />

      <span className="text-2xl font-bold text-foreground">
        {summary ? `#${summary.position}` : "--"}
      </span>

      <span className="text-xs text-muted-foreground">
        {summary
          ? `de ${summary.totalParticipants} participantes`
          : "de -- participantes"}
      </span>

      {summary && (
        <span className="text-xs text-muted-foreground">
          {summary.points} pontos
        </span>
      )}

      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto">
        Ranking
      </span>
    </article>
  );
}
