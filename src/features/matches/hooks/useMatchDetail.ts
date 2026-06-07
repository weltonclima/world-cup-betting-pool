"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";

import {
  buildTeamMap,
  deriveMatchPredictionStatus,
  resolveTeam,
} from "../lib";
import type { MatchListItem } from "./useMatchesList";
import { useMatch } from "./useMatch";
import { usePredictions } from "./usePredictions";
import { useTeams } from "./useTeams";

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

/** Match enriquecido para a tela de detalhe — herda todos os campos de MatchListItem. */
export type MatchDetailItem = MatchListItem;

/** Dado exposto pelo compositor useMatchDetail à UI. */
export interface MatchDetailData {
  /** null enquanto carrega, em 404 ou quando uid=null. */
  match: MatchDetailItem | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Compositor
// ---------------------------------------------------------------------------

/**
 * Compositor de view-model para o detalhe de um jogo (TASK-02).
 *
 * Orquestra `useMatch(id)` + `useTeams` + `usePredictions` e aplica
 * `resolveTeam` + `deriveMatchPredictionStatus` para gerar um view-model
 * pronto para renderização.
 *
 * Expõe:
 * - `match`    — partida enriquecida com teams resolvidos e predictionStatus; null em 404/loading.
 * - `isLoading`, `isError`, `refetch` — estado agregado das 3 queries.
 *
 * @param id - Id da partida (string). Vazio desabilita `useMatch`.
 */
export function useMatchDetail(id: string): MatchDetailData {
  // 1. uid do usuário autenticado
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso
  const matchQuery       = useMatch(id);
  const teamsQuery       = useTeams();
  const predictionsQuery = usePredictions(uid);

  // 3. Estado agregado
  const queries = [matchQuery, teamsQuery, predictionsQuery];
  const isLoading = queries.some((q) => q.isLoading);
  const isError   = queries.some((q) => q.isError);

  // 4. refetch estável
  const refetch = useCallback(() => {
    void matchQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  }, [matchQuery.refetch, teamsQuery.refetch, predictionsQuery.refetch]);

  // 5. Guard: uid null → estado neutro
  if (uid === null) {
    return { match: null, isLoading, isError, refetch };
  }

  // 6. Dados brutos
  const rawMatch    = matchQuery.data ?? null;
  const teams       = teamsQuery.data ?? [];
  const predictions = predictionsQuery.data ?? [];

  // 7. Sem match (404 ou ainda carregando)
  if (rawMatch === null) {
    return { match: null, isLoading, isError, refetch };
  }

  // 8. Join + derivação
  const teamMap = buildTeamMap(teams);
  const now = new Date();

  const match: MatchDetailItem = {
    id: rawMatch.id,
    kickoffAt: rawMatch.kickoffAt,
    stage: rawMatch.stage,
    round: rawMatch.round,
    groupId: rawMatch.groupId,
    venue: rawMatch.venue,
    status: rawMatch.status,
    homeScore: rawMatch.homeScore,
    awayScore: rawMatch.awayScore,
    homeTeam: resolveTeam(rawMatch.homeTeamId, teamMap),
    awayTeam: resolveTeam(rawMatch.awayTeamId, teamMap),
    predictionStatus: deriveMatchPredictionStatus(rawMatch, predictions, now),
  };

  return { match, isLoading, isError, refetch };
}
