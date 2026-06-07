"use client";

import { CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Placeholder animado para o Card Acertos — exibir durante isLoading.
 */
export function CorrectScoresCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Acertos"
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

export interface CorrectScoresCardProps {
  /** Total de placares exatos acertados. null → sem dados ainda. */
  totalCorrect: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card compacto (1/3 da grade) para total de acertos (placares exatos).
 * Puramente apresentacional — sem hooks, sem fetch.
 */
export function CorrectScoresCard({ totalCorrect }: CorrectScoresCardProps) {
  const display = totalCorrect === null ? "--" : String(totalCorrect);

  return (
    <article
      aria-label="Acertos"
      className="rounded-lg border border-border bg-card p-3 shadow-sm flex flex-col gap-1"
    >
      <CheckCircle2
        size={20}
        aria-hidden="true"
        className="text-win mb-1 shrink-0"
      />

      <span className="text-2xl font-bold text-foreground">{display}</span>

      {/* Rótulo exibido com uppercase via Tailwind; texto fonte é "Acertos" (contrato §3.2). */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto">
        Acertos
      </span>
    </article>
  );
}
