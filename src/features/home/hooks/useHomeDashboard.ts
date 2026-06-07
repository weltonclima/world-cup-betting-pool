"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";

import {
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
import { useGeneralRanking } from "./useGeneralRanking";
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
  NextMatchSummary,
  PerformanceSummary,
  PredictionStatus,
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
  // 1. uid do usuário autenticado
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso (sem cache override — herdam global 30min/24h)
  const rankingQuery     = useGeneralRanking();
  const statisticsQuery  = useStatistics(uid);
  const nextMatchQuery   = useNextMatch();
  const recentQuery      = useRecentResults();
  const teamsQuery       = useTeams();
  const predictionsQuery = usePredictions(uid);
  const settingsQuery    = useSystemSettings();

  // 3. Estado agregado — todas as queries participam de isError
  const queries = [
    rankingQuery,
    statisticsQuery,
    nextMatchQuery,
    recentQuery,
    teamsQuery,
    predictionsQuery,
    settingsQuery,
  ];
  // Quando uid é null, queries dependentes de uid ficam disabled e não carregam.
  const isLoading = uid === null
    ? (teamsQuery.isLoading || nextMatchQuery.isLoading || recentQuery.isLoading || settingsQuery.isLoading)
    : queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refetch = useCallback(() => {
    queries.forEach((q) => void q.refetch());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Guard: sem uid → retornar estado neutro (usuário não autenticado)
  if (uid === null) {
    return {
      ranking: null,
      performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
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
    };
  }

  // 10. Últimos resultados com join de teams + isCorrect
  const recentResults: RecentResult[] = recent.map((match) => {
    const pred = predictions.find((p) => p.matchId === match.id) ?? null;
    return {
      matchId: match.id,
      kickoffAt: match.kickoffAt,
      homeTeam: resolveTeam(match.homeTeamId, teamMap),
      awayTeam: resolveTeam(match.awayTeamId, teamMap),
      // match.homeScore/awayScore são non-null garantidamente para jogos finished (refinement do schema).
      matchHomeScore: match.homeScore as number,
      matchAwayScore: match.awayScore as number,
      userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
      isCorrect: computeIsCorrect(match, pred),
    };
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
