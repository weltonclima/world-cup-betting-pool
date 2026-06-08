"use client";

import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/features/matches/hooks/useTeams";
import { useGroupMatches } from "@/features/matches/hooks/useGroupMatches";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib/matchesHelpers";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import { isPredictionLocked } from "@/features/predictions/lib/predictionsHelpers";

import { usePredictions } from "./usePredictions";
import { usePredictionDraft } from "./usePredictionDraft";

/**
 * Placar em edição: cada lado pode estar vazio (`null`) durante a digitação.
 * O input é controlado por este valor — por isso precisa representar pares
 * PARCIAIS (ex.: mandante preenchido, visitante ainda vazio).
 */
export interface EditableScores {
  homeScore: number | null;
  awayScore: number | null;
}

/** Item de linha na tela de palpite em massa do grupo. */
export interface GroupPredictionItem {
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  /**
   * Placar ativo exibido no input. Prioridade: edição ao vivo (parcial) >
   * rascunho salvo > palpite do servidor. Pode ter lados `null` durante a
   * digitação; `undefined` quando nada foi preenchido.
   */
  currentScores: EditableScores | undefined;
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
  /** Quantidade de partidas com par COMPLETO preenchido (edição/draft/salvo). */
  filledCount: number;
  /** Total de partidas do grupo. */
  totalCount: number;
  refetch: () => void;
  /**
   * Atualiza o placar em edição de uma partida (um lado por vez). Persiste no
   * rascunho (localStorage) somente quando o par fica COMPLETO. Fonte ÚNICA de
   * edição — evita o desync de duas instâncias de draft (bug do round-trip).
   */
  setScore: (matchId: string, home: number | null, away: number | null) => void;
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

  // Buffer de edição ao vivo (matchId → placar parcial). É a fonte que controla
  // o input: precisa guardar um lado só (o outro `null`) enquanto o usuário
  // digita. Pares completos também vão para o `draft` (localStorage) p/ retomar.
  const [edits, setEdits] = useState<Record<string, EditableScores>>({});

  const setScore = useCallback(
    (matchId: string, home: number | null, away: number | null) => {
      setEdits((prev) => ({
        ...prev,
        [matchId]: { homeScore: home, awayScore: away },
      }));
      if (home !== null && away !== null) {
        draft.setDraft(matchId, { homeScore: home, awayScore: away });
      }
    },
    [draft],
  );

  const isLoading =
    matchesQuery.isLoading || teamsQuery.isLoading || predictionsQuery.isLoading;
  const isError =
    matchesQuery.isError || teamsQuery.isError || predictionsQuery.isError;

  const refetch = useCallback(() => {
    void matchesQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  }, [matchesQuery.refetch, teamsQuery.refetch, predictionsQuery.refetch]);

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

        const draftVal = draft.allDrafts[match.id];
        const editVal = edits[match.id];
        const isLocked = isPredictionLocked(match, now);

        // Prioridade: edição ao vivo (parcial) > rascunho > salvo.
        const currentScores: EditableScores | undefined =
          editVal ?? draftVal ?? saved;

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
  }, [uid, matchesQuery.data, teamsQuery.data, predictionsQuery.data, draft.allDrafts, edits]);

  // Conta apenas pares COMPLETOS (ambos os lados preenchidos) — um lado parcial
  // em edição não conta como "preenchido" para progresso/classificação.
  const filledCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.currentScores !== undefined &&
          Number.isFinite(i.currentScores.homeScore) &&
          Number.isFinite(i.currentScores.awayScore),
      ).length,
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
      setScore,
    };
  }

  return {
    items,
    isLoading,
    isError,
    filledCount,
    totalCount: items.length,
    refetch,
    setScore,
  };
}
