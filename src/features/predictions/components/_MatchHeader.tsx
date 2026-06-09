"use client";

/**
 * _MatchHeader — subcomponente privado compartilhado entre PredictionForm,
 * PredictionLockedState e PredictionSuccess.
 *
 * NÃO exportado pelo barrel index.ts da feature predictions.
 * Importar diretamente: import { MatchHeader } from "./_MatchHeader"
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin } from "lucide-react";

import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag
// ---------------------------------------------------------------------------

export function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        className="w-16 h-11 rounded object-contain"
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
      className="w-16 h-11 flex items-center justify-center rounded bg-muted text-sm font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: MatchHeader
// ---------------------------------------------------------------------------

export function MatchHeader({ match }: { match: MatchDetailItem }) {
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm");

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">
      {/* Times */}
      <div className="flex items-center justify-around gap-4">
        {/* Mandante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.homeTeam} />
          <span className="text-sm font-medium text-foreground text-center">
            {match.homeTeam.name}
          </span>
        </div>

        <span
          className="text-xl font-bold text-muted-foreground"
          aria-label="versus"
        >
          ×
        </span>

        {/* Visitante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.awayTeam} />
          <span className="text-sm font-medium text-foreground text-center">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={12} aria-hidden="true" />
          {dateStr} - {timeStr}
        </span>
        {match.venue && (
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {match.venue.name}, {match.venue.city}
          </span>
        )}
      </div>
    </div>
  );
}
