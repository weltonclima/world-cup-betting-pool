"use client";

/**
 * Página Resumo dos 12 Grupos (/predictions/groups-summary) — TASK-11 (PRD03-05).
 *
 * Etapa do fluxo de palpites em massa, anterior aos melhores terceiros. Faz o
 * data-fetching (useMatches + usePredictions + useTeams), deriva o resumo dos
 * grupos (buildGroupsSummary) e renderiza o componente apresentacional
 * GroupsSummary dentro do container de tema `.palpites-theme` (shell verde —
 * MASTER §2.4-palpites).
 *
 * VISUAL apenas (decisão A2): nada é persistido aqui; a classificação prevista é
 * derivada client-side via computeGroupStandings (TASK-02).
 */

import { useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams, usePredictions } from "@/features/matches/hooks";
import { GroupsSummary } from "@/features/predictions/components/GroupsSummary";
import { buildGroupsSummary } from "@/features/predictions/components/groupsSummaryData";

/** Destino do CTA: etapa de melhores terceiros (TASK-12). */
const BEST_THIRDS_HREF = "/predictions/best-thirds";

export default function ResumoGruposPage() {
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

  const summary = useMemo(
    () =>
      buildGroupsSummary(
        matchesQuery.data ?? [],
        predictionsQuery.data ?? [],
        teamsQuery.data ?? [],
      ),
    [matchesQuery.data, predictionsQuery.data, teamsQuery.data],
  );

  const refetch = () => {
    void matchesQuery.refetch();
    void predictionsQuery.refetch();
    void teamsQuery.refetch();
  };

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4">
      <GroupsSummary
        groups={summary.groups}
        allComplete={summary.allComplete}
        completeCount={summary.completeCount}
        continueHref={BEST_THIRDS_HREF}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
