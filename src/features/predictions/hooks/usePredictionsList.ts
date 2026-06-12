"use client";

/**
 * usePredictionsList — hook compositor para a tela Lista de Palpites (TASK-08).
 *
 * Une usePredictions(uid) × useMatches × useTeams, aplica derivePredictionDisplayStatus,
 * filtra apenas jogos com palpite do usuário, e ordena por kickoffAt ASC.
 *
 * Padrão de referência: useMatchesList (features/matches/hooks/useMatchesList.ts)
 */

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { buildTeamMap, resolveTeam, type ResolvedTeam } from "@/features/matches/lib";
import {
  derivePredictionDisplayStatus,
  type PredictionDisplayStatus,
} from "@/features/predictions/lib";

import { usePredictions } from "./usePredictions";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

/** Item de palpite enriquecido para a lista de exibição. */
export interface PredictionListItem {
  /** Id da partida (usado como React key). */
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  /** Placar palpitado pelo usuário. */
  prediction: { homeScore: number; awayScore: number };
  /** Status derivado para badge (TASK-02). */
  displayStatus: PredictionDisplayStatus;
  /** Origem manual: palpite lançado/sobrescrito pelo admin de grupo (PRD-12 TASK-05). */
  isManual: boolean;
}

/** Dado exposto pelo compositor à UI. */
export interface PredictionsListData {
  items: PredictionListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Compositor
// ---------------------------------------------------------------------------

/**
 * Compositor de view-model para a lista de palpites do usuário.
 *
 * - Orquestra usePredictions + useMatches + useTeams.
 * - Filtra somente partidas com palpite do usuário.
 * - Ordena por kickoffAt ASC (próximos jogos primeiro).
 * - Expõe { items, isLoading, isError, refetch }.
 *
 * Decisões:
 * - uid via useAuth().firebaseUser?.uid ?? null — padrão confirmado em useMatchesList.
 * - uid === null → estado neutro (items: []) sem queries disparadas.
 * - now capturado uma vez por render (padrão useMatchesList linha 121).
 * - refetch estável via useCallback.
 */
export function usePredictionsList(): PredictionsListData {
  // 1. uid do usuário autenticado
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso
  const predictionsQuery = usePredictions(uid);
  const matchesQuery = useMatches();
  const teamsQuery = useTeams();

  // 3. Estado agregado
  const isLoading = [predictionsQuery, matchesQuery, teamsQuery].some((q) => q.isLoading);
  const isError = [predictionsQuery, matchesQuery, teamsQuery].some((q) => q.isError);

  // 4. refetch estável (padrão useMatchesList)
  const refetch = useCallback(() => {
    void predictionsQuery.refetch();
    void matchesQuery.refetch();
    void teamsQuery.refetch();
  }, [predictionsQuery.refetch, matchesQuery.refetch, teamsQuery.refetch]);

  // 5. Guard: uid null → estado neutro
  if (uid === null) {
    return { items: [], isLoading, isError, refetch };
  }

  // 6. Dados brutos (podem ser undefined enquanto carregam)
  const predictions = predictionsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  // 7. Cache de teams + now (capturado uma vez no render)
  const teamMap = buildTeamMap(teams);
  const now = new Date();

  // 8. Índice de palpites por matchId para lookup O(1)
  const predByMatchId = new Map(predictions.map((p) => [p.matchId, p]));

  // 9. Join: somente partidas com palpite + enriquecimento + ordenação ASC
  const items: PredictionListItem[] = matches
    .filter((match) => predByMatchId.has(match.id))
    .map((match) => {
      const prediction = predByMatchId.get(match.id)!;
      return {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: resolveTeam(match.homeTeamId, teamMap),
        awayTeam: resolveTeam(match.awayTeamId, teamMap),
        prediction: { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        displayStatus: derivePredictionDisplayStatus(prediction, match, now),
        isManual: Boolean(prediction.editedBy),
      };
    })
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  return { items, isLoading, isError, refetch };
}
