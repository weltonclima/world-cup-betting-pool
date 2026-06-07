"use client";

import { useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/features/matches/hooks/useTeams";
import { useGroupMatches } from "@/features/matches/hooks/useGroupMatches";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib/matchesHelpers";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import { isPredictionLocked } from "@/features/predictions/lib/predictionsHelpers";

import { usePredictions } from "./usePredictions";
import { usePredictionDraft } from "./usePredictionDraft";

/** Item de linha na tela de palpite em massa do grupo. */
export interface GroupPredictionItem {
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  /** Palpite atualmente ativo: draft tem prioridade sobre saved. */
  currentScores: { homeScore: number; awayScore: number } | undefined;
  /** Palpite salvo no servidor (se existir). */
  savedPrediction: { homeScore: number; awayScore: number } | undefined;
  /** Rascunho local não salvo (se existir). */
  draftPrediction: { homeScore: number; awayScore: number } | undefined;
  /** Partida bloqueada para novos palpites. */
  isLocked: boolean;
  /** true se o rascunho local difere do palpite salvo (indica pendência de save). */
  isDirty: boolean;
}

export interface GroupPredictionsData {
  items: GroupPredictionItem[];
  isLoading: boolean;
  isError: boolean;
  /** Quantidade de partidas com palpite preenchido (draft ou salvo). */
  filledCount: number;
  /** Total de partidas do grupo. */
  totalCount: number;
  refetch: () => void;
}

/**
 * Compositor de view-model para a tela de palpite em massa de um grupo (TASK-09).
 *
 * Orquestra useGroupMatches + useTeams + usePredictions + usePredictionDraft.
 * Regra de prioridade para currentScores:
 *   1. draftPrediction (rascunho local — alteração mais recente do usuário)
 *   2. savedPrediction (persistido no servidor)
 *   3. undefined (sem palpite)
 *
 * @param groupId - ID do grupo ("A"–"L").
 */
export function useGroupPredictions(groupId: string): GroupPredictionsData {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const matchesQuery = useGroupMatches(groupId);
  const teamsQuery = useTeams();
  const predictionsQuery = usePredictions(uid);
  // uid vazio garante chave isolada sem colisão com outros usuários
  const draft = usePredictionDraft(uid ?? "");

  const isLoading =
    matchesQuery.isLoading || teamsQuery.isLoading || predictionsQuery.isLoading;
  const isError =
    matchesQuery.isError || teamsQuery.isError || predictionsQuery.isError;

  const refetch = () => {
    void matchesQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  };

  const items = useMemo<GroupPredictionItem[]>(() => {
    if (uid === null) return [];

    const matches = matchesQuery.data ?? [];
    const teams = teamsQuery.data ?? [];
    const predictions = predictionsQuery.data ?? [];

    const teamMap = buildTeamMap(teams);
    const now = new Date();
    const predByMatchId = new Map(
      predictions.map((p) => [p.matchId, p]),
    );

    return matches
      .map((match) => {
        const savedPred = predByMatchId.get(match.id);
        const saved = savedPred
          ? { homeScore: savedPred.homeScore, awayScore: savedPred.awayScore }
          : undefined;

        const draftVal = draft.getDraft(match.id);
        const isLocked = isPredictionLocked(match, now);

        // Draft tem prioridade sobre saved.
        const currentScores = draftVal ?? saved;

        // isDirty: existe rascunho E (não existe salvo OU rascunho difere do salvo).
        const isDirty =
          draftVal !== undefined &&
          (saved === undefined ||
            draftVal.homeScore !== saved.homeScore ||
            draftVal.awayScore !== saved.awayScore);

        return {
          matchId: match.id,
          kickoffAt: match.kickoffAt,
          homeTeam: resolveTeam(match.homeTeamId, teamMap),
          awayTeam: resolveTeam(match.awayTeamId, teamMap),
          currentScores,
          savedPrediction: saved,
          draftPrediction: draftVal,
          isLocked,
          isDirty,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [uid, matchesQuery.data, teamsQuery.data, predictionsQuery.data, draft]);

  const filledCount = useMemo(
    () => items.filter((i) => i.currentScores !== undefined).length,
    [items],
  );

  if (uid === null) {
    return {
      items: [],
      isLoading,
      isError,
      filledCount: 0,
      totalCount: 0,
      refetch,
    };
  }

  return {
    items,
    isLoading,
    isError,
    filledCount,
    totalCount: items.length,
    refetch,
  };
}
