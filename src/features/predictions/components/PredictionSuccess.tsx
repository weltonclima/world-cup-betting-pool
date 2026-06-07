"use client";

/**
 * PredictionSuccess — estado de confirmação após palpite salvo (TASK-07).
 *
 * Exibido após useUpsertPrediction resolver com sucesso.
 * role="status" aria-live="polite" anuncia a transição para screen readers.
 *
 * Ref visual: PRD04-06-Palpite-Registrado.png
 * Contrato visual: ai/screen/palpites-task-07.md
 */

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";

import { MatchHeader } from "./_MatchHeader";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PredictionSuccessProps {
  match: MatchDetailItem;
  homeScore: number;
  awayScore: number;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PredictionSuccess({
  match,
  homeScore,
  awayScore,
}: PredictionSuccessProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Palpite salvo com sucesso"
      className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4"
    >
      {/* Ícone + título + mensagem */}
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <CheckCircle2
            size={48}
            aria-hidden="true"
            className="text-green-600 dark:text-green-400"
          />
        </div>
        <h1 className="text-xl font-bold text-foreground">Palpite registrado!</h1>
        <p className="text-sm text-muted-foreground">
          Seu palpite foi salvo com sucesso.
        </p>
      </div>

      {/* Header do jogo */}
      <MatchHeader match={match} />

      {/* Palpite confirmado */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Seu palpite
        </span>
        <div className="flex items-center justify-around gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {match.homeTeam.name}
            </span>
            <span className="text-4xl font-bold text-foreground">{homeScore}</span>
          </div>
          <span
            className="text-xl font-bold text-muted-foreground"
            aria-label="por"
          >
            ×
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {match.awayTeam.name}
            </span>
            <span className="text-4xl font-bold text-foreground">{awayScore}</span>
          </div>
        </div>
      </div>

      {/* CTA — Voltar para Jogos (botão primário conforme PRD04-06) */}
      <Link
        href="/matches"
        className="inline-flex items-center justify-center w-full min-h-[44px] rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Voltar para Jogos
      </Link>

    </div>
  );
}
