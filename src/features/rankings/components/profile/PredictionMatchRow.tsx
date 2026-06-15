"use client";

import type { JSX } from "react";
import Link from "next/link";

import {
  PREDICTION_DISPLAY_STATUS_COLOR,
  PREDICTION_DISPLAY_STATUS_LABEL,
} from "@/features/predictions/lib";
import type { ProfilePredictionItem } from "@/features/rankings/lib";

interface PredictionMatchRowProps {
  item: ProfilePredictionItem;
  isSelf: boolean;
}

function TeamFlag({
  team,
}: {
  team: { name: string; flagUrl: string | null };
}): JSX.Element {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt=""
        aria-hidden="true"
        className="h-5 w-7 shrink-0 rounded-sm object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-bold text-muted-foreground"
    >
      {team.name.slice(0, 3).toUpperCase()}
    </div>
  );
}

function TeamLabel({
  team,
}: {
  team: { name: string; flagUrl: string | null };
}): JSX.Element {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <TeamFlag team={team} />
      <span className="min-w-0 truncate text-xs font-medium text-foreground">
        {team.name}
      </span>
    </span>
  );
}

export function PredictionMatchRow({
  item,
  isSelf,
}: PredictionMatchRowProps): JSX.Element {
  const {
    homeTeam,
    awayTeam,
    matchStatus,
    actualScore,
    prediction,
    displayStatus,
    kickoffAt,
    matchId,
  } = item;

  const kickoffFormatted = new Date(kickoffAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-2 last:border-0">
      <TeamLabel team={homeTeam} />

      {/* Score or kickoff time */}
      <div className="shrink-0 px-1 text-center">
        {matchStatus === "finished" && actualScore ? (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {actualScore.homeScore}–{actualScore.awayScore}
          </span>
        ) : matchStatus === "live" && actualScore ? (
          <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {actualScore.homeScore}–{actualScore.awayScore}
          </span>
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">
            {kickoffFormatted}
          </span>
        )}
      </div>

      <TeamLabel team={awayTeam} />

      {/* Prediction + status badge */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {matchStatus === "finished" ? (
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              {prediction.homeScore}:{prediction.awayScore}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${PREDICTION_DISPLAY_STATUS_COLOR[displayStatus]}`}
              aria-label={PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]}
            >
              {PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]}
            </span>
          </>
        ) : matchStatus === "live" && isSelf ? (
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              {prediction.homeScore}:{prediction.awayScore}
            </span>
            <span
              className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              aria-label="Em jogo"
            >
              Em jogo
            </span>
          </>
        ) : matchStatus === "scheduled" && isSelf ? (
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              {prediction.homeScore}:{prediction.awayScore}
            </span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Pendente
            </span>
          </>
        ) : isSelf ? (
          <Link
            href={`/matches/${matchId}`}
            aria-label={`Palpitar em ${homeTeam.name} × ${awayTeam.name}`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Palpitar →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
