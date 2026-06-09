"use client";

/**
 * PredictionListCard — card informacional de palpite para a lista de palpites (TASK-08).
 *
 * Exibe: bandeiras + nomes dos times, data/hora, placar palpitado, badge de status.
 * NÃO é link — card informacional puro (sem navegação).
 *
 * Contrato visual: ai/screen/palpites-task-08.md §5
 */

import type { ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Lock, XCircle } from "lucide-react";

import {
  PREDICTION_DISPLAY_STATUS_COLOR,
  PREDICTION_DISPLAY_STATUS_LABEL,
  type PredictionDisplayStatus,
} from "@/features/predictions/lib";
import type { ResolvedTeam } from "@/features/matches/lib";
import { cn } from "@/lib/utils";

import type { PredictionListItem } from "../hooks/usePredictionsList";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface PredictionListCardProps {
  item: PredictionListItem;
}

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag (bandeira + fallback de iniciais)
// Reutiliza o padrão de MatchCard.tsx
// ---------------------------------------------------------------------------

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        width={40}
        height={28}
        loading="lazy"
        decoding="async"
        className="w-10 h-7 rounded-sm object-contain"
      />
    );
  }

  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className="w-10 h-7 flex items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: PredictionStatusBadge (badge com ícone + texto)
// ---------------------------------------------------------------------------

const STATUS_ICONS: Record<PredictionDisplayStatus, ReactNode> = {
  pendente: <Clock size={12} aria-hidden="true" />,
  acertou: <CheckCircle2 size={12} aria-hidden="true" />,
  errou: <XCircle size={12} aria-hidden="true" />,
  bloqueado: <Lock size={12} aria-hidden="true" />,
};

function PredictionStatusBadge({ displayStatus }: { displayStatus: PredictionDisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        PREDICTION_DISPLAY_STATUS_COLOR[displayStatus],
      )}
    >
      {STATUS_ICONS[displayStatus]}
      {PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: PredictionListCard
// ---------------------------------------------------------------------------

/**
 * Card de palpite informacional — exibe times, placar palpitado e status.
 * Não é clicável/navegável (design decision TASK-08).
 */
export function PredictionListCard({ item }: PredictionListCardProps) {
  const ariaLabel = `${item.homeTeam.name} vs ${item.awayTeam.name}`;

  return (
    <article
      className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3"
      aria-label={ariaLabel}
    >
      {/* Bloco de times e placar palpitado */}
      <div className="flex items-center justify-between gap-2">
        {/* Time mandante */}
        <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
          <TeamFlag team={item.homeTeam} />
          <span className="w-full truncate text-center text-xs font-medium text-foreground">
            {item.homeTeam.name}
          </span>
        </div>

        {/* Placar palpitado no centro */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-2xl font-bold text-foreground">
            {item.prediction.homeScore}
          </span>
          <span className="text-lg font-bold text-muted-foreground">×</span>
          <span className="text-2xl font-bold text-foreground">
            {item.prediction.awayScore}
          </span>
        </div>

        {/* Time visitante */}
        <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
          <TeamFlag team={item.awayTeam} />
          <span className="w-full truncate text-center text-xs font-medium text-foreground">
            {item.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Data e hora */}
      <p className="text-xs text-muted-foreground text-center">
        {format(new Date(item.kickoffAt), "dd/MM/yyyy · HH:mm", { locale: ptBR })}
      </p>

      {/* Divider + palpite repetido + badge de status */}
      <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Meu palpite:{" "}
          <span className="font-bold text-foreground">
            {item.prediction.homeScore} × {item.prediction.awayScore}
          </span>
        </p>
        <PredictionStatusBadge displayStatus={item.displayStatus} />
      </div>
    </article>
  );
}
