"use client";

/**
 * Página de Seleção de Grupo (/predictions/groups) — TASK-08 (PRD03-02).
 *
 * Lista os 12 grupos (A–L) em grid responsivo (3 col mobile → 4 desktop), cada
 * card com progresso/status derivado das partidas de grupo × palpites do
 * usuário. Cada card navega para /predictions/groups/[groupId] (TASK-09).
 *
 * Data-fetching via useMatches + usePredictions; agregação por grupo via
 * buildGroupSummaries (pura). Container com tema `.palpites-theme` (shell verde).
 */

import { useMemo } from "react";

import { BackButton } from "@/components/layout/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useMatches } from "@/features/matches/hooks";
import { usePredictions } from "@/features/predictions/hooks";
import {
  GroupSelectionGrid,
  buildGroupSummaries,
} from "@/features/predictions/components";

export default function GroupSelectionPage() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const matchesQuery = useMatches();
  const predictionsQuery = usePredictions(uid);

  const isLoading =
    uid === null || matchesQuery.isLoading || predictionsQuery.isLoading;
  const isError = matchesQuery.isError || predictionsQuery.isError;

  const summaries = useMemo(
    () =>
      buildGroupSummaries(
        matchesQuery.data ?? [],
        predictionsQuery.data ?? [],
      ),
    [matchesQuery.data, predictionsQuery.data],
  );

  const refetch = () => {
    void matchesQuery.refetch();
    void predictionsQuery.refetch();
  };

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col gap-4 pb-20 md:pb-4">
      <BackButton />
      <GroupSelectionGrid
        summaries={summaries}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
