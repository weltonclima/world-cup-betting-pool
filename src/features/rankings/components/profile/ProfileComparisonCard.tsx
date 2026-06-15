"use client";

import type { JSX } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RankingEntry } from "@/types";
import type { ProfileComparison } from "@/features/rankings/lib";

interface ProfileComparisonCardProps {
  myEntry: RankingEntry;
  otherEntry: RankingEntry;
  comparison: ProfileComparison;
  displayName: string;
  /** Palpites próprios ainda carregando — exibe skeleton da linha de comparação. */
  isLoading?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function pointsDiffLabel(diff: number): string {
  if (diff === 0) return "Empatados em pontos";
  if (diff < 0) return `Você está ${Math.abs(diff)} pts à frente`;
  return `Você está ${diff} pts atrás`;
}

export function ProfileComparisonCard({
  myEntry,
  otherEntry,
  comparison,
  displayName,
  isLoading = false,
}: ProfileComparisonCardProps): JSX.Element {
  const myDisplayName = myEntry.name ?? myEntry.nickname;

  return (
    <section
      aria-labelledby="comparison-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <h3
        id="comparison-heading"
        className="mb-3 text-base font-semibold text-foreground"
      >
        Você × {displayName}
      </h3>

      <div className="flex items-center gap-2">
        {/* My side */}
        <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-muted/40 p-3 text-center">
          <Avatar
            className="h-10 w-10"
            role="img"
            aria-label={myDisplayName}
          >
            <AvatarImage src={myEntry.avatarUrl} alt="" />
            <AvatarFallback className="text-sm font-semibold">
              {initials(myDisplayName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground">Você</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            #{myEntry.position} · {myEntry.points} pts
          </span>
        </div>

        <span
          className="shrink-0 text-sm font-bold text-muted-foreground"
          aria-hidden="true"
        >
          vs
        </span>

        {/* Other side */}
        <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-muted/40 p-3 text-center">
          <Avatar
            className="h-10 w-10"
            role="img"
            aria-label={displayName}
          >
            <AvatarImage src={otherEntry.avatarUrl} alt="" />
            <AvatarFallback className="text-sm font-semibold">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground">
            {displayName}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            #{otherEntry.position} · {otherEntry.points} pts
          </span>
        </div>
      </div>

      {isLoading ? (
        <div
          aria-hidden="true"
          className="mt-3 h-4 w-2/3 animate-pulse rounded bg-muted"
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {pointsDiffLabel(comparison.pointsDiff)}
          </span>
          {comparison.otherCorrectMyWrong > 0 && (
            <span>
              · {displayName} acertou {comparison.otherCorrectMyWrong} que você errou
            </span>
          )}
        </div>
      )}
    </section>
  );
}
