"use client";

/**
 * GameStatusBadge — badge de status do jogo (TASK-03).
 * Componente presentacional: recebe MatchStatus, exibe rótulo pt-BR com cor semântica.
 * Usa GAME_STATUS_LABEL e GAME_STATUS_COLOR de matchLabels.ts (WARNING-1 fix: derivado
 * de deriveGameStatusLabel — sem duplicação).
 */

import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/types";
import {
  GAME_STATUS_COLOR,
  GAME_STATUS_LABEL,
} from "@/features/matches/lib/matchLabels";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface GameStatusBadgeProps {
  status: MatchStatus;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Badge de status do jogo em pt-BR.
 * - scheduled → azul "Agendado"
 * - live      → verde "Ao Vivo"
 * - finished  → cinza "Encerrado"
 * - postponed → cinza "Adiado"
 * - canceled  → cinza "Cancelado"
 */
export function GameStatusBadge({ status, className }: GameStatusBadgeProps) {
  const label = GAME_STATUS_LABEL[status];
  const colorClass = GAME_STATUS_COLOR[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
