"use client";

/**
 * LastResultsCard — card "Últimos Resultados" da Home Dashboard (TASK-08).
 * Componente presentacional puro: recebe props, sem efeitos colaterais.
 * Contrato visual: ai/screen/home-dashboard-task-06.md §3.6
 */

import { CheckCircle2 } from "lucide-react";

import type { RecentResult } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface LastResultsCardProps {
  /** Até 5 resultados recentes. Array vazio → estado empty. */
  results: RecentResult[];
  /** true → exibe skeleton de loading. */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Subcomponente: ResultBadge (§3.6)
// ---------------------------------------------------------------------------

/**
 * Badge de pontos do palpite do usuário (regra ponderada — 10/5/0).
 * Usa <span> com classes diretas — Badge Shadcn não tem variante win/loss (§3.6).
 * Cores alinhadas à Lista de Palpites (PREDICTION_DISPLAY_STATUS_COLOR):
 *
 * - userPredicted=false → "Sem palpite" (bg-muted text-muted-foreground)
 * - 10 pts (placar exato)    → "+10 pts" (bg-win-bg text-win)
 * - 5 pts (acertou vencedor) → "+5 pts"  (lime — "quase vitória")
 * - 0 pts (errou)            → "0 pts"   (bg-loss-bg text-loss)
 */
function ResultBadge({
  points,
  userPredicted,
}: {
  points: 0 | 5 | 10;
  userPredicted: boolean;
}) {
  if (!userPredicted) {
    return (
      <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-sm shrink-0">
        Sem palpite
      </span>
    );
  }

  const color =
    points === 10
      ? "bg-win-bg text-win"
      : points === 5
        ? "bg-lime-500/20 text-lime-700 dark:text-lime-400"
        : "bg-loss-bg text-loss";
  const label = points > 0 ? `+${points} pts` : "0 pts";

  return (
    <span
      className={`${color} text-xs font-medium px-2 py-0.5 rounded-sm shrink-0 tabular-nums`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton de loading (§5.1)
// ---------------------------------------------------------------------------

/** Skeleton para LastResultsCard enquanto os dados carregam. */
export function LastResultsCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Últimos Resultados"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div
        aria-hidden="true"
        className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-b-0"
        >
          <div className="h-3 flex-1 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-5 w-14 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card "Últimos Resultados" — lista até 5 jogos finalizados com:
 * - placar "Brasil 2 x 1 França",
 * - badge de pontos do palpite ("+10 pts" / "+5 pts" / "0 pts") ou "Sem palpite".
 *
 * Estado empty: quando results.length === 0.
 * Estado loading: quando isLoading é true.
 */
export function LastResultsCard({ results, isLoading = false }: LastResultsCardProps) {
  if (isLoading) {
    return <LastResultsCardSkeleton />;
  }

  // Limita a 5 resultados conforme o contrato (A4)
  const displayResults = results.slice(0, 5);

  return (
    <article
      aria-label="Últimos Resultados"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">
        Últimos Resultados
      </h2>

      {displayResults.length === 0 ? (
        // Estado empty
        <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
          <CheckCircle2 size={24} aria-hidden="true" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhum resultado disponível
          </p>
        </div>
      ) : (
        <ul aria-label="Lista de resultados recentes">
          {displayResults.map((result) => {
            const userPredicted = result.userPrediction !== null;

            return (
              <li
                key={result.matchId}
                className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-b-0"
              >
                {/* Seleções + placar */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {result.homeTeam.name}
                  </span>
                  <span className="text-sm font-bold text-foreground shrink-0">
                    {result.matchHomeScore} – {result.matchAwayScore}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {result.awayTeam.name}
                  </span>
                </div>

                {/* Badge de pontos do palpite */}
                <ResultBadge
                  points={result.points}
                  userPredicted={userPredicted}
                />
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
