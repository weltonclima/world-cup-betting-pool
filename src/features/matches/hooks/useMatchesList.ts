"use client";

import { useCallback, useMemo } from "react";

import { useActiveChampionship } from "@/features/championships";
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
  /** Campeonato dono da partida (TASK-05). Mantém MatchListItem superset de MatchWithId. */
  championshipId: string;
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
  // Placar do tempo normal (90min) em jogos de mata-mata com prorrogação
  // (ignorar-gols-prorrogacao TASK-04). Ausente na maioria dos jogos; usado só
  // quando o pool tem `ignoreOvertimeGoals` ligado (scoring client-side coerente).
  homeScoreRegulation?: number;
  awayScoreRegulation?: number;
  /** Id do time mandante — exposto para filtro por seleção (TASK-05). */
  homeTeamId: string;
  /** Id do time visitante — exposto para filtro por seleção (TASK-05). */
  awayTeamId: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  predictionStatus: MatchPredictionStatus;
  /** Placar apostado pelo usuário nesta partida, ou null se não houver palpite. */
  userPrediction: { homeScore: number; awayScore: number } | null;
}

/** Seção de dia com matches já enriquecidos. */
export interface MatchListItemDaySection {
  /** "Hoje" | "Amanhã" | "22 de junho de 2026" */
  label: string;
  /** "yyyy-MM-dd" local — chave estável para React key */
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

  // Campeonato ativo (multi-championship TASK-09). Fora do Provider (ex.: testes),
  // o default legado (só Copa) mantém o comportamento anterior inalterado.
  const { activeChampionshipId } = useActiveChampionship();

  // 2. Queries por recurso, escopadas ao campeonato ativo (cache isolado por id).
  const matchesQuery     = useMatches(activeChampionshipId);
  const teamsQuery       = useTeams(activeChampionshipId);
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

  // 5. View-model memoizado (TASK-04 perf-hardening).
  // Recomputa SÓ quando os dados mudam (identidade de referência do React Query
  // é estável entre renders sem refetch). Evita refazer joins + groupMatchesByDay
  // (sort + date-fns format por item) a cada tecla/render do MatchList/Home.
  // Deps nas `.data` cruas (não em `?? []`, que criaria novo array por render).
  const { groups, flatList } = useMemo(() => {
    // Guard: uid null → estado neutro.
    if (uid === null) {
      return { groups: [] as MatchListItemDaySection[], flatList: [] as MatchListItem[] };
    }

    // Dados brutos (podem ser undefined enquanto carregam).
    const matches     = matchesQuery.data ?? [];
    const teams       = teamsQuery.data ?? [];
    const predictions = predictionsQuery.data ?? [];

    // Caches O(1): teams por id, palpite por matchId, e Set de matchIds palpitados
    // (este último para deriveMatchPredictionStatus O(1) — evita o antigo O(n²)).
    const teamMap = buildTeamMap(teams);
    const predMap = new Map(predictions.map((p) => [p.matchId, p]));
    const predictedIds = new Set(predictions.map((p) => p.matchId));

    // now capturado uma vez por recompute do view-model (não por render).
    const now = new Date();

    // flatList — join + derivação por partida.
    const flat: MatchListItem[] = matches.map((match) => {
      const pred = predMap.get(match.id);
      return {
        id: match.id,
        championshipId: match.championshipId,
        kickoffAt: match.kickoffAt,
        stage: match.stage,
        round: match.round,
        groupId: match.groupId,
        venue: match.venue,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        ...(match.homeScoreRegulation !== undefined
          ? { homeScoreRegulation: match.homeScoreRegulation }
          : {}),
        ...(match.awayScoreRegulation !== undefined
          ? { awayScoreRegulation: match.awayScoreRegulation }
          : {}),
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeam: resolveTeam(match.homeTeamId, teamMap),
        awayTeam: resolveTeam(match.awayTeamId, teamMap),
        predictionStatus: deriveMatchPredictionStatus(match, predictedIds, now),
        userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
      };
    });

    // groups — agrupar por dia. groupMatchesByDay opera sobre MatchWithId[];
    // reutilizamos as matches brutas para agrupar e mapeamos cada seção para
    // MatchListItem (via id lookup no flatList).
    const flatById = new Map(flat.map((item) => [item.id, item]));
    const rawSections = groupMatchesByDay(matches, now);
    const grouped: MatchListItemDaySection[] = rawSections.map((section) => ({
      label: section.label,
      date: section.date,
      matches: section.matches.flatMap((m) => {
        const item = flatById.get(m.id);
        return item ? [item] : [];
      }),
    }));

    return { groups: grouped, flatList: flat };
  }, [uid, matchesQuery.data, teamsQuery.data, predictionsQuery.data]);

  return { groups, flatList, isLoading, isError, refetch };
}
