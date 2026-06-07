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
 * Badge de resultado do palpite do usuário.
 * Usa <span> com classes diretas — Badge Shadcn não tem variante win/loss (§3.6).
 *
 * - isCorrect=true → "Acertou" (bg-win-bg text-win)
 * - isCorrect=false + userPredicted=true → "Errou" (bg-loss-bg text-loss)
 * - userPredicted=false → "Sem palpite" (bg-muted text-muted-foreground)
 */
function ResultBadge({
  isCorrect,
  userPredicted,
}: {
  isCorrect: boolean;
  userPredicted: boolean;
}) {
  if (isCorrect) {
    return (
      <span className="bg-win-bg text-win text-xs font-medium px-2 py-0.5 rounded-sm shrink-0">
        Acertou
      </span>
    );
  }

  if (userPredicted) {
    return (
      <span className="bg-loss-bg text-loss text-xs font-medium px-2 py-0.5 rounded-sm shrink-0">
        Errou
      </span>
    );
  }

  return (
    <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-sm shrink-0">
      Sem palpite
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
 * - badge "Acertou" / "Errou" / "Sem palpite" usando tokens win/loss.
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

                {/* Badge de resultado */}
                <ResultBadge
                  isCorrect={result.isCorrect}
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
