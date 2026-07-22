"use client";

import { useMemo } from "react";

import { useTeams } from "@/features/matches/hooks/useTeams";
import { buildTeamMap, resolveTeam, groupMatchesByDay } from "@/features/matches/lib";
import { MatchCard } from "@/features/matches/components/MatchCard";
import { MatchListSkeleton } from "@/features/matches/components/MatchListSkeleton";
import { MatchesEmptyState } from "@/features/matches/components/MatchesEmptyState";
import type { MatchWithId } from "@/types";

export interface FrozenMatchListProps {
  championshipId: string;
  matches: MatchWithId[];
}

/**
 * Tab "Jogos" do detalhe do Histórico (TASK-15): partidas CONGELADAS vindas da
 * resposta de `GET /api/history/[id]` (não de `useMatches` — o snapshot já
 * veio na leitura do detalhe). Read-only: `predictionStatus` fixo em
 * "bloqueado" e sem palpite (`userPrediction: null`), reusando o mesmo
 * `MatchCard` da área ativa sem duplicar o layout do card.
 */
export function FrozenMatchList({ championshipId, matches }: FrozenMatchListProps) {
  const teamsQuery = useTeams(championshipId);

  const groups = useMemo(
    () => groupMatchesByDay(matches, new Date()),
    [matches],
  );

  if (teamsQuery.isLoading) return <MatchListSkeleton count={3} />;

  if (matches.length === 0) {
    return <MatchesEmptyState message="Sem jogos registrados" />;
  }

  const teamMap = buildTeamMap(teamsQuery.data ?? []);

  return (
    <div className="flex flex-col gap-6" aria-label="Jogos congelados">
      {teamsQuery.isError && (
        <p
          role="status"
          className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
        >
          Não foi possível carregar os escudos e nomes dos times; os placares
          congelados seguem corretos.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.date} aria-labelledby={`history-day-${group.date}`}>
          <h2
            id={`history-day-${group.date}`}
            className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {group.label}
          </h2>
          <div className="flex flex-col gap-4">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                homeTeam={resolveTeam(match.homeTeamId, teamMap)}
                awayTeam={resolveTeam(match.awayTeamId, teamMap)}
                predictionStatus="bloqueado"
                userPrediction={null}
                detailHref={`/matches/${match.id}`}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
