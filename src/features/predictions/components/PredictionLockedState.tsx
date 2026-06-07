"use client";

/**
 * PredictionLockedState — estado bloqueado da tela de palpite (TASK-07).
 *
 * Exibido quando isPredictionLocked(match, now) === true.
 * Mostra cadeado + mensagem + header do jogo + palpite registrado (se houver).
 *
 * Ref visual: PRD04-05-Palpite-Bloqueado.png
 * Contrato visual: ai/screen/palpites-task-07.md
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";
import type { Prediction } from "@/types";

import { MatchHeader } from "./_MatchHeader";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PredictionLockedStateProps {
  match: MatchDetailItem;
  /** undefined se o usuário não palpitou antes do lock. */
  prediction?: Prediction;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PredictionLockedState({
  match,
  prediction,
}: PredictionLockedStateProps) {
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm");

  return (
    <div className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4">

      {/* Botão voltar */}
      <Link
        href={`/matches/${match.id}`}
        aria-label="Voltar para detalhes do jogo"
        className="inline-flex items-center gap-1 min-h-[44px] py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Voltar</span>
      </Link>

      {/* Ícone + título + mensagem */}
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="rounded-full bg-muted p-4">
          <Lock size={32} aria-hidden="true" className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Palpite bloqueado</h1>
        <p className="text-sm text-muted-foreground">
          O prazo para este jogo foi encerrado.
          {!prediction && " Não foi possível criar ou alterar seu palpite."}
        </p>
      </div>

      {/* Header do jogo */}
      <MatchHeader match={match} />

      {/* Palpite registrado (se houver) */}
      {prediction && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Seu palpite
          </span>
          <div className="flex items-center justify-around gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {match.homeTeam.name}
              </span>
              <span className="text-4xl font-bold text-foreground">
                {prediction.homeScore}
              </span>
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
              <span className="text-4xl font-bold text-foreground">
                {prediction.awayScore}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Jogo: {dateStr} às {timeStr}
          </p>
        </div>
      )}

      {/* CTA — voltar para jogos */}
      <Link
        href="/matches"
        className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para Jogos
      </Link>

    </div>
  );
}
