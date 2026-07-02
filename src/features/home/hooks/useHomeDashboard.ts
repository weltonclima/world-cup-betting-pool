"use client";

import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";

import { scorePrediction } from "@/features/predictions/lib";

import {
  buildPredictionsHref,
  deriveCurrentStage,
  deriveHeroSummary,
  deriveNextMatch,
  deriveNotices,
  deriveOpenMatches,
  derivePredictionBreakdown,
  derivePredictionStatus,
  deriveRecentResults,
} from "../lib/homeDashboardHelpers";
import type {
  HomeDashboardData,
  NextMatchSummary,
  RecentResult,
} from "../lib/homeDashboardHelpers";
import type { MatchWithId } from "@/types";
import { useMatchesList } from "@/features/matches/hooks/useMatchesList";
import { usePoolRanking } from "@/features/rankings/hooks/usePoolRanking";
import { usePoolRankingByScope } from "@/features/rankings/hooks/usePoolRankingByScope";
import { usePoolStats } from "@/features/rankings/hooks/usePoolStats";
import { usePredictions } from "./usePredictions";
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
    teamsQuery,
    predictionsQuery,
    settingsQuery,
    matchesListData,
  ];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // Loading granular (TASK-10 perf-hardening) — render progressivo por card.
  // Hero: ranking + statistics + pool_stats (+ escopos split quando habilitados).
  const heroLoading =
    rankingQuery.isLoading ||
    statisticsQuery.isLoading ||
    poolStatsQuery.isLoading ||
    (splitEnabled &&
      (rankingGruposQuery.isLoading || rankingEliminatoriasQuery.isLoading));
  // Cards de matches: lista (matches/teams/predictions agregados) + settings.
  const matchesLoading = matchesListData.isLoading || settingsQuery.isLoading;

  // B-02: refetch estável — lista explícita de .refetch individuais no dep array.
  // TanStack Query v5 garante estabilidade de identidade de .refetch entre renders.
  const refetch = useCallback(() => {
    void rankingQuery.refetch();
    void rankingGruposQuery.refetch();
    void rankingEliminatoriasQuery.refetch();
    void statisticsQuery.refetch();
    void poolStatsQuery.refetch();
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
      heroLoading,
      matchesLoading,
      isError,
      refetch,
    };
  }

  // 5. Dados brutos (podem ser undefined enquanto carregam)
  const ranking = rankingQuery.data;
  const statistics = statisticsQuery.data;
  const poolStats = poolStatsQuery.data ?? null;
  const predictions = predictionsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;

  // 6. `now` único para todas as derivações temporais (próximo jogo, avisos, abertos).
  const now = new Date();

  // 6b. Próximo jogo + últimos resultados derivados do flatList já carregado
  // (TASK-01 perf-hardening): elimina os fetches redundantes de /api/matches que
  // `useNextMatch`/`useRecentResults` disparavam (query keys distintas → sem dedup).
  const flatList = matchesListData.flatList;
  const nextMatchItem = deriveNextMatch(flatList, now);
  const recentItems = deriveRecentResults(flatList);

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

  // 9. Próximo jogo: teams já resolvidos no MatchListItem; status do palpite
  // continua via derivePredictionStatus (considera settings.predictionsLocked,
  // que o predictionStatus do item NÃO considera — semântica preservada).
  let nextMatchSummary: NextMatchSummary | null = null;
  if (nextMatchItem) {
    const predStatus = derivePredictionStatus(
      nextMatchItem.id,
      predictions,
      settings?.predictionsLocked ?? false,
    );
    nextMatchSummary = {
      matchId: nextMatchItem.id,
      kickoffAt: nextMatchItem.kickoffAt,
      homeTeam: nextMatchItem.homeTeam,
      awayTeam: nextMatchItem.awayTeam,
      predictionStatus: predStatus,
      userPrediction: nextMatchItem.userPrediction,
      predictionsHref: buildPredictionsHref(nextMatchItem.id, predStatus),
    };
  }

  // 10. Últimos resultados: teams já resolvidos no MatchListItem + pontos ponderados.
  // W-02: placar non-null garantido pelo schema para jogos finished.
  // Pontos vêm de scorePrediction (mesma regra do ranking: 10/5/0); sem
  // palpite → 0 pts e userPrediction null (a UI distingue "sem palpite").
  const recentResults: RecentResult[] = recentItems.flatMap((match) => {
    // Omite jogo sem placar (não deveria ocorrer para finished, mas protege o tipo)
    if (match.homeScore === null || match.awayScore === null) return [];
    const pred = predictions.find((p) => p.matchId === match.id) ?? null;
    return [
      {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        matchHomeScore: match.homeScore,
        matchAwayScore: match.awayScore,
        userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
        // scorePrediction espera MatchWithId; MatchListItem carrega os campos usados
        // (status/homeScore/awayScore). Cast estreito local.
        points: pred ? scorePrediction(pred, match as unknown as MatchWithId).points : 0,
      },
    ];
  });

  // 12. Avisos do sistema (usa o próximo jogo derivado do flatList).
  const notices = deriveNotices(settings, nextMatchItem, now);

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
    heroLoading,
    matchesLoading,
    isError,
    refetch,
  };
}
