"use client";

import type { PerformanceSummary } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Placeholder animado para o Card Meu Desempenho — exibir durante isLoading.
 */
export function PerformanceCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Meu Desempenho"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div
        aria-hidden="true"
        className="h-4 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3"
      />
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 mt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-8 w-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface SubMetricaProps {
  value: string;
  label: string;
}

function SubMetrica({ value, label }: SubMetricaProps) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PerformanceCardProps {
  /**
   * Dados de desempenho do usuário.
   * Per R1/D1: gamesPredicted e wrong são null no MVP — renderizar como "—".
   */
  summary: PerformanceSummary;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card full-width "Meu Desempenho" com 4 sub-métricas.
 * gamesPredicted e wrong são null no MVP (D1) — exibidos como "—".
 * Puramente apresentacional — sem hooks, sem fetch.
 */
export function PerformanceCard({ summary }: PerformanceCardProps) {
  const { totalCorrect, accuracy, gamesPredicted, wrong } = summary;

  const accuracyDisplay = `${Math.round(accuracy)}%`;

  // gamesPredicted e wrong são null no MVP (D1) — renderizar "—"
  const gamesPredictedDisplay =
    gamesPredicted === null ? "—" : String(gamesPredicted);
  const wrongDisplay = wrong === null ? "—" : String(wrong);

  return (
    <article
      aria-label="Meu Desempenho"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">
        Meu Desempenho
      </h2>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <SubMetrica value={String(totalCorrect)} label="Acertos" />
        <SubMetrica value={accuracyDisplay} label="Aproveitamento" />
        <SubMetrica value={gamesPredictedDisplay} label="Jogos palpitados" />
        <SubMetrica value={wrongDisplay} label="Erros" />
      </div>
    </article>
  );
}
