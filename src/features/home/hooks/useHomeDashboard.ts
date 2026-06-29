"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";

import { scorePrediction } from "@/features/predictions/lib";

import {
  buildPredictionsHref,
  buildTeamMap,
  deriveCurrentStage,
  deriveHeroSummary,
  deriveNotices,
  deriveOpenMatches,
  derivePredictionBreakdown,
  derivePredictionStatus,
  resolveTeam,
} from "../lib/homeDashboardHelpers";
import type {
  HomeDashboardData,
  NextMatchSummary,
  RecentResult,
} from "../lib/homeDashboardHelpers";
import { useMatchesList } from "@/features/matches/hooks/useMatchesList";
import { usePoolRanking } from "@/features/rankings/hooks/usePoolRanking";
import { usePoolRankingByScope } from "@/features/rankings/hooks/usePoolRankingByScope";
import { usePoolStats } from "@/features/rankings/hooks/usePoolStats";
import { useNextMatch } from "./useNextMatch";
import { usePredictions } from "./usePredictions";
import { useRecentResults } from "./useRecentResults";
import { useStatistics } from "./useStatistics";
import { useSystemSettings } from "./useSystemSettings";
import { useTeams } from "./useTeams";

// Reexportar os tipos para consumo externo (barrel e UI).
export type {
  HeroSummary,
  HeroSummaryByScope,
  HomeDashboardData,
  HomePredictionStatus,
  NextMatchSummary,
  OpenMatchesResult,
  OpenMatchSummary,
  PredictionBreakdown,
  RecentResult,
  ResolvedTeam,
  SystemNotice,
} from "../lib/homeDashboardHelpers";

/**
 * Compositor da Home Dashboard (TASK-05).
 *
 * Orquestra os 9 hooks por recurso, executa joins client-side com o cache de teams,
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
  // nunca o ranking global. Sem pool → query desabilitada (Hero sem posição).
  const rankingQuery = usePoolRanking(profile?.groupId);
  // Split por fase (split-phase-ranking TASK-05): a flag vem embutida no payload
  // do ranking do pool (TASK-02). Gating W2: as 2 leituras de escopo SÓ disparam
  // quando a flag está ON — a Home (tela de TODOS) não paga 2 queries extras no
  // caso comum (flag OFF). Hooks chamados incondicionalmente (regras de hooks);
  // `enabled` controla o fetch.
  const splitOn = rankingQuery.data?.splitPhaseRanking === true;
  const splitEnabled = splitOn && Boolean(profile?.groupId);
  const rankingGruposQuery = usePoolRankingByScope("grupos", { enabled: splitEnabled });
  const rankingEliminatoriasQuery = usePoolRankingByScope("eliminatorias", {
    enabled: splitEnabled,
  });
  const statisticsQuery = useStatistics(uid);
  const poolStatsQuery = usePoolStats();
  const nextMatchQuery = useNextMatch();
  const recentQuery = useRecentResults();
  const teamsQuery = useTeams();
  const predictionsQuery = usePredictions(uid);
  const settingsQuery = useSystemSettings();
  // Lista de jogos enriquecida (TASK-02 home-revamp). Reusa useMatches/useTeams/
  // usePredictions internamente — React Query deduplica com os hooks acima.
  const matchesListData = useMatchesList();

  // 3. Estado agregado — todas as queries participam de isLoading e isError.
  // Queries desabilitadas (uid=null) reportam isLoading: false no TanStack Query v5,
  // portanto queries.some() é seguro em ambos os estados (uid presente ou null).
  const queries = [
    rankingQuery,
    rankingGruposQuery,
    rankingEliminatoriasQuery,
    statisticsQuery,
    poolStatsQuery,
    nextMatchQuery,
    recentQuery,
    teamsQuery,
    predictionsQuery,
    settingsQuery,
    matchesListData,
  ];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // B-02: refetch estável — lista explícita de .refetch individuais no dep array.
  // TanStack Query v5 garante estabilidade de identidade de .refetch entre renders.
  const refetch = useCallback(() => {
    void rankingQuery.refetch();
    void rankingGruposQuery.refetch();
    void rankingEliminatoriasQuery.refetch();
    void statisticsQuery.refetch();
    void poolStatsQuery.refetch();
    void nextMatchQuery.refetch();
    void recentQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
    void settingsQuery.refetch();
    void matchesListData.refetch();
  }, [
    rankingQuery.refetch,
    rankingGruposQuery.refetch,
    rankingEliminatoriasQuery.refetch,
    statisticsQuery.refetch,
    poolStatsQuery.refetch,
    nextMatchQuery.refetch,
    recentQuery.refetch,
    teamsQuery.refetch,
    predictionsQuery.refetch,
    settingsQuery.refetch,
    matchesListData.refetch,
  ]);

  // 4. Guard: sem uid → retornar estado neutro (usuário não autenticado)
  if (uid === null) {
    return {
      heroSummary: deriveHeroSummary(null, null, null, ""),
      predictionBreakdown: { correct: 0, partial: 0, wrong: 0, total: 0, isEmpty: true },
      nextMatch: null,
      recentResults: [],
      openMatches: { items: [], totalOpen: 0 },
      currentStage: null,
      notices: [],
      isLoading,
      isError,
      refetch,
    };
  }

  // 5. Dados brutos (podem ser undefined enquanto carregam)
  const ranking = rankingQuery.data;
  const statistics = statisticsQuery.data;
  const poolStats = poolStatsQuery.data ?? null;
  const nextMatch = nextMatchQuery.data ?? null;
  const recent = recentQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const predictions = predictionsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;

  // 6. Cache de teams (Map para O(1) lookup — sem N+1)
  const teamMap = buildTeamMap(teams);

  // 7. Hero consolidado (TASK-01 home-revamp): ranking + statistics + pool_stats.
  const heroSummary = deriveHeroSummary(ranking, statistics, poolStats, uid);

  // 7b. Hero dividido por fase (split-phase-ranking TASK-05). Só quando a flag ON.
  // Reusa `deriveHeroSummary` por escopo; statistics/poolStats são `null` (não há
  // granularidade por fase) → sparkline/ruler omitidos no ramo ON (decisão de UI).
  // Eliminatórias: query `null` (doc inexistente) → `null` p/ a UI degradar.
  let heroSummaryByScope: HomeDashboardData["heroSummaryByScope"];
  if (splitOn) {
    const rankingGrupos = rankingGruposQuery.data ?? null;
    const rankingEliminatorias = rankingEliminatoriasQuery.data ?? null;
    heroSummaryByScope = {
      grupos: deriveHeroSummary(rankingGrupos, null, null, uid),
      eliminatorias: rankingEliminatorias
        ? deriveHeroSummary(rankingEliminatorias, null, null, uid)
        : null,
    };
  }

  // 8. Raio-X dos palpites (TASK-03 home-revamp): scoring client-side sobre
  // a lista de partidas já carregada (finished × predictions).
  const predictionBreakdown = derivePredictionBreakdown(matchesListData.flatList, predictions);

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

  // 10. Últimos resultados com join de teams + pontos ponderados
  // W-02: placar non-null garantido pelo schema para jogos finished.
  // Pontos vêm de scorePrediction (mesma regra do ranking: 10/5/0); sem
  // palpite → 0 pts e userPrediction null (a UI distingue "sem palpite").
  const recentResults: RecentResult[] = recent.flatMap((match) => {
    // Omite jogo sem placar (não deveria ocorrer para finished, mas protege o tipo)
    if (match.homeScore === null || match.awayScore === null) return [];
    const pred = predictions.find((p) => p.matchId === match.id) ?? null;
    return [
      {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: resolveTeam(match.homeTeamId, teamMap),
        awayTeam: resolveTeam(match.awayTeamId, teamMap),
        matchHomeScore: match.homeScore,
        matchAwayScore: match.awayScore,
        userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
        points: pred ? scorePrediction(pred, match).points : 0,
      },
    ];
  });

  // 11. `now` único para derivações temporais (avisos + jogos abertos).
  const now = new Date();

  // 12. Avisos do sistema
  const notices = deriveNotices(settings, nextMatch, now);

  // 13. Jogos abertos para palpitar (TASK-02 home-revamp).
  const openMatches = deriveOpenMatches(matchesListData.flatList, now, 3);

  // 14. Fase ativa da Copa para o banner (TASK-04 / PRD-16).
  const currentStage = deriveCurrentStage(matchesListData.flatList);

  return {
    heroSummary,
    heroSummaryByScope,
    predictionBreakdown,
    nextMatch: nextMatchSummary,
    recentResults,
    openMatches,
    currentStage,
    notices,
    isLoading,
    isError,
    refetch,
  };
}
