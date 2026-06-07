"use client";

/**
 * MatchStatusBadge — badge de status do palpite do usuário (TASK-03).
 * Componente presentacional: recebe status, exibe rótulo + ícone com cor semântica.
 * Usa PREDICTION_STATUS_LABEL e PREDICTION_STATUS_COLOR de matchLabels.ts.
 */

import { CheckCircle2, Clock, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import {
  PREDICTION_STATUS_COLOR,
  PREDICTION_STATUS_LABEL,
} from "@/features/matches/lib/matchLabels";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchStatusBadgeProps {
  status: MatchPredictionStatus;
  className?: string;
}

// ---------------------------------------------------------------------------
// Mapa de ícones por status
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<MatchPredictionStatus, React.ReactNode> = {
  enviado: <CheckCircle2 size={12} aria-hidden="true" />,
  pendente: <Clock size={12} aria-hidden="true" />,
  bloqueado: <Lock size={12} aria-hidden="true" />,
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Badge de status do palpite do usuário.
 * - enviado → verde + check
 * - pendente → âmbar + clock
 * - bloqueado → cinza + cadeado
 */
export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const label = PREDICTION_STATUS_LABEL[status];
  const colorClass = PREDICTION_STATUS_COLOR[status];
  const icon = STATUS_ICON[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
        colorClass,
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
