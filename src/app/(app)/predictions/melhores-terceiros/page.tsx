"use client";

/**
 * Página Ranking dos Melhores Terceiros (/predictions/melhores-terceiros) —
 * TASK-12 (PRD03-06).
 *
 * Exibe os 8 melhores terceiros colocados (critério FIFA via rankBestThirds —
 * TASK-02) e o CTA "Gerar 16 Avos", habilitado apenas quando os 12 grupos estão
 * completos (A6). VISUAL e NÃO pontuada (A2): nada é persistido aqui.
 *
 * Data-fetching via useMatches + usePredictions + useTeams; derivação por
 * buildThirdsRanking (pura). O CTA navega para a fase de chave (TASK-13/14).
 *
 * Importa o componente DIRETAMENTE pelo caminho (não pelo barrel index.ts) para
 * manter o merge sem conflito — o barrel é atualizado pelo orquestrador.
 *
 * Container com tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 */

import { useCallback, useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { usePredictions } from "@/features/predictions/hooks";
import {
  buildTeamMap,
  resolveTeam,
} from "@/features/matches/lib/matchesHelpers";
import {
  BestThirdsRanking,
  buildThirdsRanking,
} from "@/features/predictions/components/BestThirdsRanking";

const BRACKET_HREF = "/predictions/chave/dezesseis-avos";

export default function BestThirdsPage() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const matchesQuery = useMatches();
  const predictionsQuery = usePredictions(uid);
  const teamsQuery = useTeams();

  const isLoading =
    uid === null ||
    matchesQuery.isLoading ||
    predictionsQuery.isLoading ||
    teamsQuery.isLoading;
  const isError =
    matchesQuery.isError || predictionsQuery.isError || teamsQuery.isError;

  const ranking = useMemo(
    () =>
      buildThirdsRanking(
        matchesQuery.data ?? [],
        predictionsQuery.data ?? [],
      ),
    [matchesQuery.data, predictionsQuery.data],
  );

  const teamMap = useMemo(
    () => buildTeamMap(teamsQuery.data ?? []),
    [teamsQuery.data],
  );

  const resolveTeamName = useCallback(
    (teamId: string) => resolveTeam(teamId, teamMap),
    [teamMap],
  );

  const refetch = useCallback(() => {
    void matchesQuery.refetch();
    void predictionsQuery.refetch();
    void teamsQuery.refetch();
  }, [matchesQuery, predictionsQuery, teamsQuery]);

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col gap-6 pb-20 md:pb-4">
      <BestThirdsRanking
        thirds={ranking.thirds}
        resolveTeamName={resolveTeamName}
        allGroupsComplete={ranking.allGroupsComplete}
        completedGroupsCount={ranking.completedGroupsCount}
        totalGroupsCount={ranking.totalGroupsCount}
        bracketHref={BRACKET_HREF}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
