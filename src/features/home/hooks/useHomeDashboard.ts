"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";

import {
  buildPredictionsHref,
  buildTeamMap,
  computeIsCorrect,
  deriveCurrentStage,
  deriveNotices,
  derivePerformanceSummary,
  derivePredictionStatus,
  deriveRankingSummary,
  resolveTeam,
} from "../lib/homeDashboardHelpers";
import type {
  HomeDashboardData,
  NextMatchSummary,
  RecentResult,
} from "../lib/homeDashboardHelpers";
import { usePoolRanking } from "@/features/rankings/hooks/usePoolRanking";
import { useNextMatch } from "./useNextMatch";
import { usePredictions } from "./usePredictions";
import { useRecentResults } from "./useRecentResults";
import { useStatistics } from "./useStatistics";
import { useSystemSettings } from "./useSystemSettings";
import { useTeams } from "./useTeams";

// Reexportar os tipos para consumo externo (barrel e UI).
export type {
  CurrentStageSummary,
  HomeDashboardData,
  HomePredictionStatus,
  NextMatchSummary,
  PerformanceSummary,
  RankingSummary,
  RecentResult,
  ResolvedTeam,
  SystemNotice,
} from "../lib/homeDashboardHelpers";

/**
 * Compositor da Home Dashboard (TASK-05).
 *
 * Orquestra os 7 hooks por recurso, executa joins client-side com o cache de teams,
 * calcula isCorrect por comparação de placar, e expõe ao componente uma estrutura
 * derivada pronta para renderização + estado agregado (isLoading / isError / refetch).
 *
 * Decisões:
 * - Sem cache override: todos os hooks herdam staleTime/gcTime do QueryClient global (30min/24h).
 * - uid === null: queries dependentes ficam desabilitadas (enabled: false); retorna estado neutro.
 * - teams: buscado uma vez, reutilizado como Map para O(1) lookup — sem N+1.
 */
export function useHomeDashboard(): HomeDashboardData {
  // 1. uid + pool do usuário autenticado
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso (sem cache override — herdam global 30min/24h)
  // Ranking FECHADO por pool (PRD-09): o card da Home mostra só o pool do usuário,
  // nunca o ranking global. Sem pool → query desabilitada (RankingSummary nulo).
  const rankingQuery     = usePoolRanking(profile?.groupId);
  const statisticsQuery  = useStatistics(uid);
  const nextMatchQuery   = useNextMatch();
  const recentQuery      = useRecentResults();
  const teamsQuery       = useTeams();
  const predictionsQuery = usePredictions(uid);
  const settingsQuery    = useSystemSettings();

  // 3. Estado agregado — todas as queries participam de isLoading e isError.
  // Queries desabilitadas (uid=null) reportam isLoading: false no TanStack Query v5,
  // portanto queries.some() é seguro em ambos os estados (uid presente ou null).
  const queries = [
    rankingQuery,
    statisticsQuery,
    nextMatchQuery,
    recentQuery,
    teamsQuery,
    predictionsQuery,
    settingsQuery,
  ];
  const isLoading = queries.some((q) => q.isLoading);
  const isError   = queries.some((q) => q.isError);

  // B-02: refetch estável — lista explícita de .refetch individuais no dep array.
  // TanStack Query v5 garante estabilidade de identidade de .refetch entre renders.
  const refetch = useCallback(() => {
    void rankingQuery.refetch();
    void statisticsQuery.refetch();
    void nextMatchQuery.refetch();
    void recentQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
    void settingsQuery.refetch();
  }, [
    rankingQuery.refetch,
    statisticsQuery.refetch,
    nextMatchQuery.refetch,
    recentQuery.refetch,
    teamsQuery.refetch,
    predictionsQuery.refetch,
    settingsQuery.refetch,
  ]);

  // 4. Guard: sem uid → retornar estado neutro (usuário não autenticado)
  if (uid === null) {
    return {
      ranking: null,
      performance: { totalCorrect: 0, accuracy: 0, longestStreak: 0, gamesPredicted: 0 },
      nextMatch: null,
      recentResults: [],
      currentStage: { stage: null, roundLabel: null },
      notices: [],
      isLoading,
      isError,
      refetch,
    };
  }

  // 5. Dados brutos (podem ser undefined enquanto carregam)
  const ranking     = rankingQuery.data;
  const statistics  = statisticsQuery.data;
  const nextMatch   = nextMatchQuery.data ?? null;
  const recent      = recentQuery.data ?? [];
  const teams       = teamsQuery.data ?? [];
  const predictions = predictionsQuery.data ?? [];
  const settings    = settingsQuery.data ?? null;

  // 6. Cache de teams (Map para O(1) lookup — sem N+1)
  const teamMap = buildTeamMap(teams);

  // 7. Ranking summary
  const rankingSummary = deriveRankingSummary(ranking, uid);

  // 8. Performance summary
  const performance = derivePerformanceSummary(statistics);

  // 9. Próximo jogo com join de teams + status do palpite
  let nextMatchSummary: NextMatchSummary | null = null;
  if (nextMatch) {
    const predStatus = derivePredictionStatus(
      nextMatch.id,
      predictions,
      settings?.predictionsLocked ?? false,
    );
    const userPred = predictions.find((p) => p.matchId === nextMatch.id) ?? null;
    nextMatchSummary = {
      matchId: nextMatch.id,
      kickoffAt: nextMatch.kickoffAt,
      homeTeam: resolveTeam(nextMatch.homeTeamId, teamMap),
      awayTeam: resolveTeam(nextMatch.awayTeamId, teamMap),
      predictionStatus: predStatus,
      userPrediction: userPred
        ? { homeScore: userPred.homeScore, awayScore: userPred.awayScore }
        : null,
      predictionsHref: buildPredictionsHref(nextMatch.id, predStatus),
    };
  }

  // 10. Últimos resultados com join de teams + isCorrect
  // W-02: placar non-null garantido pelo schema para jogos finished;
  // guard explícito em computeIsCorrect protege contra dados inconsistentes.
  const recentResults: RecentResult[] = recent.flatMap((match) => {
    // Omite jogo sem placar (não deveria ocorrer para finished, mas protege o tipo)
    if (match.homeScore === null || match.awayScore === null) return [];
    const pred = predictions.find((p) => p.matchId === match.id) ?? null;
    return [{
      matchId: match.id,
      kickoffAt: match.kickoffAt,
      homeTeam: resolveTeam(match.homeTeamId, teamMap),
      awayTeam: resolveTeam(match.awayTeamId, teamMap),
      matchHomeScore: match.homeScore,
      matchAwayScore: match.awayScore,
      userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
      isCorrect: computeIsCorrect(match, pred),
    }];
  });

  // 11. Fase atual + rótulo de rodada
  const currentStage = deriveCurrentStage(settings, nextMatch, recent);

  // 12. Avisos do sistema
  const notices = deriveNotices(settings, nextMatch, new Date());

  return {
    ranking: rankingSummary,
    performance,
    nextMatch: nextMatchSummary,
    recentResults,
    currentStage,
    notices,
    isLoading,
    isError,
    refetch,
  };
}
