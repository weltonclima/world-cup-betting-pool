"use client";

/**
 * MatchDetailActions — CTAs contextuais da tela de detalhe do jogo (TASK-09).
 *
 * Três estados funcionais:
 *   - "Enviar Palpite"   → sem palpite + não-travado → Link /matches/[id]/predict
 *   - "Editar Palpite"   → com palpite + não-travado → Link /matches/[id]/predict
 *   - "Palpite bloqueado" → travado (match não-scheduled ou predictionStatus bloqueado)
 *                          → botão disabled com ícone Lock
 *
 * Contrato visual: ai/screen/palpites-task-09.md §3
 */

import { Lock, Pencil, Send } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus, Prediction } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MatchDetailActionsProps {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchStatus;
  /** Id da partida — usado para montar o href de navegação. */
  matchId: string;
  /** Palpite existente do usuário; undefined quando não há palpite. */
  prediction: Prediction | undefined;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * CTAs contextuais para a tela de detalhe do jogo.
 *
 * Estado travado: botão outline disabled com ícone Lock + texto descritivo.
 * Estado habilitado: Button asChild com Link → navegação para /matches/[id]/predict.
 */
export function MatchDetailActions({
  predictionStatus,
  matchStatus,
  matchId,
}: MatchDetailActionsProps) {
  const isLocked =
    matchStatus !== "scheduled" || predictionStatus === "bloqueado";

  const predictHref = `/matches/${matchId}/predict`;

  // Estado bloqueado — botão desabilitado (comunica via ícone + texto + aria)
  if (isLocked) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          disabled
          aria-disabled="true"
          aria-label="Palpite bloqueado — prazo encerrado"
          className="w-full min-h-[44px] justify-start gap-2"
        >
          <Lock size={16} aria-hidden="true" />
          Palpite bloqueado
        </Button>
      </div>
    );
  }

  // Com palpite — Editar Palpite (Link habilitado estilizado como Button)
  if (predictionStatus === "enviado") {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={predictHref}
          aria-label="Editar palpite para este jogo"
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-full min-h-[44px] justify-start gap-2",
          )}
        >
          <Pencil size={16} aria-hidden="true" />
          Editar Palpite
        </Link>
      </div>
    );
  }

  // Sem palpite — Enviar Palpite (Link habilitado estilizado como Button)
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={predictHref}
        aria-label="Enviar palpite para este jogo"
        className={cn(
          buttonVariants({ variant: "default" }),
          "w-full min-h-[44px] justify-start gap-2",
        )}
      >
        <Send size={16} aria-hidden="true" />
        Enviar Palpite
      </Link>
    </div>
  );
}
