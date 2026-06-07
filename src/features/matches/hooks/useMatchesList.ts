"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import type { MatchStatus, MatchWithId, Stage } from "@/types";

import {
  buildTeamMap,
  deriveMatchPredictionStatus,
  groupMatchesByDay,
  resolveTeam,
  type MatchPredictionStatus,
  type ResolvedTeam,
} from "../lib";
import { useMatches } from "./useMatches";
import { usePredictions } from "./usePredictions";
import { useTeams } from "./useTeams";

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso na UI)
// ---------------------------------------------------------------------------

/** Match enriquecido com seleções resolvidas e status de palpite derivado. */
export interface MatchListItem {
  id: string;
  kickoffAt: string;
  stage: Stage;
  // round/groupId espelham o matchSchema (`nullable().optional()`): `null` = sem grupo/rodada
  // (mata-mata), `undefined` = ausente no doc. A UI deve tratar ambos como "não exibir".
  round: number | null | undefined;
  groupId: string | null | undefined;
  venue: MatchWithId["venue"];
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  predictionStatus: MatchPredictionStatus;
}

/** Seção de dia com matches já enriquecidos. */
export interface MatchListItemDaySection {
  /** "Hoje" | "Amanhã" | "22 de junho de 2026" */
  label: string;
  /** "yyyy-MM-dd" UTC — chave estável para React key */
  date: string;
  matches: MatchListItem[];
}

/** Dado exposto pelo compositor useMatchesList à UI. */
export interface MatchesListData {
  groups: MatchListItemDaySection[];
  flatList: MatchListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Compositor
// ---------------------------------------------------------------------------

/**
 * Compositor de view-model para a lista de jogos (TASK-02).
 *
 * Orquestra `useMatches` + `useTeams` + `usePredictions` e aplica as funções
 * puras de TASK-01 (buildTeamMap, resolveTeam, deriveMatchPredictionStatus,
 * groupMatchesByDay) para gerar um view-model pronto para renderização.
 *
 * Expõe:
 * - `groups`   — jogos agrupados por dia (label pt-BR + date key + MatchListItem[]).
 * - `flatList` — todos os jogos em ordem cronológica (para filtros/busca na UI).
 * - `isLoading`, `isError`, `refetch` — estado agregado das 3 queries.
 *
 * Decisões:
 * - uid via `useAuth().firebaseUser?.uid ?? null` — mesma fonte que useHomeDashboard.
 * - Global lock omitido — regra per-match (kickoffAt + status) é suficiente (plan §1).
 * - `refetch` estável via useCallback (padrão B-02 do home).
 */
export function useMatchesList(): MatchesListData {
  // 1. uid do usuário autenticado
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso
  const matchesQuery     = useMatches();
  const teamsQuery       = useTeams();
  const predictionsQuery = usePredictions(uid);

  // 3. Estado agregado
  const queries = [matchesQuery, teamsQuery, predictionsQuery];
  const isLoading = queries.some((q) => q.isLoading);
  const isError   = queries.some((q) => q.isError);

  // 4. refetch estável
  const refetch = useCallback(() => {
    void matchesQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  }, [matchesQuery.refetch, teamsQuery.refetch, predictionsQuery.refetch]);

  // 5. Guard: uid null → estado neutro
  if (uid === null) {
    return { groups: [], flatList: [], isLoading, isError, refetch };
  }

  // 6. Dados brutos (podem ser undefined enquanto carregam)
  const matches     = matchesQuery.data ?? [];
  const teams       = teamsQuery.data ?? [];
  const predictions = predictionsQuery.data ?? [];

  // 7. Cache de teams
  const teamMap = buildTeamMap(teams);

  // 8. now — capturado uma vez no render
  const now = new Date();

  // 9. flatList — join + derivação por partida
  const flatList: MatchListItem[] = matches.map((match) => ({
    id: match.id,
    kickoffAt: match.kickoffAt,
    stage: match.stage,
    round: match.round,
    groupId: match.groupId,
    venue: match.venue,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeTeam: resolveTeam(match.homeTeamId, teamMap),
    awayTeam: resolveTeam(match.awayTeamId, teamMap),
    predictionStatus: deriveMatchPredictionStatus(match, predictions, now),
  }));

  // 10. groups — agrupar os MatchListItem por dia
  // groupMatchesByDay opera sobre MatchWithId[]; reutilizamos as matches brutas para agrupar
  // e depois mapeamos cada seção para MatchListItem (via id lookup no flatList).
  const flatListById = new Map(flatList.map((item) => [item.id, item]));
  const rawSections = groupMatchesByDay(matches, now);
  const groups: MatchListItemDaySection[] = rawSections.map((section) => ({
    label: section.label,
    date: section.date,
    matches: section.matches.flatMap((m) => {
      const item = flatListById.get(m.id);
      return item ? [item] : [];
    }),
  }));

  return { groups, flatList, isLoading, isError, refetch };
}
