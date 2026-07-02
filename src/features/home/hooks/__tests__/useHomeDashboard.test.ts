// @vitest-environment jsdom
/**
 * Testes do compositor useHomeDashboard.
 * Mockam os hooks por recurso e @/hooks/useAuth para testar a orquestração em
 * isolamento, sem QueryClient real.
 *
 * TASK-01 (perf-hardening): `nextMatch` e `recentResults` agora derivam do
 * `flatList` de useMatchesList (não mais de useNextMatch/useRecentResults, que
 * foram removidos). Os fixtures de próximo jogo/últimos resultados são injetados
 * via `matchesListFlat`. Jogos agendados usam kickoff no futuro (relativo ao
 * relógio real, que o compositor usa via `new Date()`).
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseQueryResult } from "@tanstack/react-query";
import type { PoolStats, Prediction, Ranking, Statistics, SystemSettings, TeamWithId } from "@/types";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth");
vi.mock("@/features/rankings/hooks/usePoolRanking");
vi.mock("@/features/rankings/hooks/usePoolStats");
vi.mock("@/features/matches/hooks/useMatchesList");
vi.mock("../useStatistics");
vi.mock("../useTeams");
vi.mock("../usePredictions");
vi.mock("../useSystemSettings");
vi.mock("@/features/rankings/hooks/usePoolRankingByScope");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking } from "@/features/rankings/hooks/usePoolRanking";
import { usePoolStats } from "@/features/rankings/hooks/usePoolStats";
import { useMatchesList } from "@/features/matches/hooks/useMatchesList";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";
import { useStatistics } from "../useStatistics";
import { useTeams } from "../useTeams";
import { usePredictions } from "../usePredictions";
import { useSystemSettings } from "../useSystemSettings";
import { usePoolRankingByScope } from "@/features/rankings/hooks/usePoolRankingByScope";

import { useHomeDashboard } from "../useHomeDashboard";

// ── helpers de tipagem para os mocks ─────────────────────────────────────────

const mockUseAuth      = vi.mocked(useAuth);
const mockRanking      = vi.mocked(usePoolRanking);
const mockPoolStats    = vi.mocked(usePoolStats);
const mockStatistics   = vi.mocked(useStatistics);
const mockTeams        = vi.mocked(useTeams);
const mockPredictions  = vi.mocked(usePredictions);
const mockSettings     = vi.mocked(useSystemSettings);
const mockMatchesList        = vi.mocked(useMatchesList);
const mockPoolRankingByScope = vi.mocked(usePoolRankingByScope);

/** ISO no futuro relativo ao relógio real (deriveNextMatch exige kickoff futuro). */
function futureIso(days = 30): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** Item base do flatList (MatchListItem). */
function makeItem(id: string, overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id,
    kickoffAt: futureIso(30),
    stage: "grupos",
    round: 2,
    groupId: "group-a",
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Argentina", flagUrl: undefined },
    predictionStatus: "pendente",
    userPrediction: null,
    ...overrides,
  };
}

/** Jogo agendado futuro para servir de "próximo jogo". */
function makeScheduledItem(id: string, overrides: Partial<MatchListItem> = {}): MatchListItem {
  return makeItem(id, { status: "scheduled", kickoffAt: futureIso(15), ...overrides });
}

/** Jogo finalizado com placar para servir de "resultado recente". */
function makeFinishedItem(
  id: string,
  homeScore: number,
  awayScore: number,
  overrides: Partial<MatchListItem> = {},
): MatchListItem {
  return makeItem(id, {
    status: "finished",
    kickoffAt: "2026-06-15T18:00:00.000Z",
    homeScore,
    awayScore,
    predictionStatus: "bloqueado",
    ...overrides,
  });
}

// ── factory de UseQueryResult falso ──────────────────────────────────────────

function fakeQuery<T>(overrides: {
  data?: T;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => Promise<unknown>;
}): UseQueryResult<T> {
  return {
    data: overrides.data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: overrides.refetch ?? vi.fn().mockResolvedValue({}),
    status: "success" as const,
    isSuccess: true,
    isPending: false,
    isFetching: false,
    isStale: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPaused: false,
    isPlaceholderData: false,
    failureCount: 0,
    failureReason: null,
    error: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    fetchStatus: "idle" as const,
    errorUpdateCount: 0,
  } as unknown as UseQueryResult<T>;
}

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeTeam(id: string): TeamWithId {
  return { id, name: `Seleção ${id}`, code: "BRA", flagUrl: `https://flags/${id}.png` };
}

function makePrediction(matchId: string, home: number, away: number): Prediction {
  return { uid: "user-01", matchId, homeScore: home, awayScore: away };
}

function makeRanking(uid: string, position: number, points: number): Ranking {
  return {
    scope: "geral",
    updatedAt: "2026-06-15T00:00:00.000Z",
    entries: [
      { uid, nickname: "nick", position, points },
      { uid: "user-99", nickname: "outro", position: position + 1, points: 0 },
    ],
  };
}

function makeStatistics(totalCorrect: number, accuracy: number): Statistics {
  return {
    uid: "user-01",
    totalCorrect,
    accuracy,
    longestStreak: 1,
    correctByStage: { grupos: totalCorrect },
    positionHistory: [],
  };
}

function makeSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    registrationOpen: true,
    predictionsLocked: false,
    currentStage: "grupos",
    ...overrides,
  };
}

function makePoolStats(): PoolStats {
  return {
    updatedAt: "2026-06-15T00:00:00.000Z",
    totalParticipants: 24,
    highestPoints: 210,
    lowestPoints: 12,
    averagePoints: 96,
    totalCorrect: 300,
    distribution: [],
  };
}

// ── helper para configurar todos os mocks de uma vez ─────────────────────────

function setupMocks({
  uid = "user-01",
  rankingData = makeRanking("user-01", 1, 10),
  statisticsData = makeStatistics(5, 50),
  poolStatsData = makePoolStats() as PoolStats | null,
  teamsData = [makeTeam("team-bra"), makeTeam("team-arg")] as TeamWithId[],
  predictionsData = [] as Prediction[],
  settingsData = makeSettings(),
  rankingLoading = false,
  poolStatsLoading = false,
  statisticsLoading = false,
  teamsLoading = false,
  predictionsLoading = false,
  settingsLoading = false,
  rankingError = false,
  poolStatsError = false,
  statisticsError = false,
  teamsError = false,
  predictionsError = false,
  settingsError = false,
  rankingRefetch = vi.fn() as () => Promise<unknown>,
  poolStatsRefetch = vi.fn() as () => Promise<unknown>,
  statisticsRefetch = vi.fn() as () => Promise<unknown>,
  teamsRefetch = vi.fn() as () => Promise<unknown>,
  predictionsRefetch = vi.fn() as () => Promise<unknown>,
  settingsRefetch = vi.fn() as () => Promise<unknown>,
  matchesListFlat = [] as MatchListItem[],
  matchesListLoading = false,
  matchesListError = false,
  matchesListRefetch = vi.fn() as () => void,
  rankingGruposData = null as Ranking | null,
  rankingEliminatoriasData = null as Ranking | null,
}: {
  uid?: string | null;
  rankingData?: Ranking | null;
  poolStatsData?: PoolStats | null;
  statisticsData?: Statistics | null;
  teamsData?: TeamWithId[];
  predictionsData?: Prediction[];
  settingsData?: SystemSettings | null;
  rankingLoading?: boolean;
  poolStatsLoading?: boolean;
  statisticsLoading?: boolean;
  teamsLoading?: boolean;
  predictionsLoading?: boolean;
  settingsLoading?: boolean;
  rankingError?: boolean;
  poolStatsError?: boolean;
  statisticsError?: boolean;
  teamsError?: boolean;
  predictionsError?: boolean;
  settingsError?: boolean;
  rankingRefetch?: () => Promise<unknown>;
  poolStatsRefetch?: () => Promise<unknown>;
  statisticsRefetch?: () => Promise<unknown>;
  teamsRefetch?: () => Promise<unknown>;
  predictionsRefetch?: () => Promise<unknown>;
  settingsRefetch?: () => Promise<unknown>;
  matchesListFlat?: MatchListItem[];
  matchesListLoading?: boolean;
  matchesListError?: boolean;
  matchesListRefetch?: () => void;
  rankingGruposData?: Ranking | null;
  rankingEliminatoriasData?: Ranking | null;
} = {}) {
  mockUseAuth.mockReturnValue({
    firebaseUser: uid ? ({ uid } as import("firebase/auth").User) : null,
    profile: null,
    status: null,
    role: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  });

  mockRanking.mockReturnValue(fakeQuery({ data: rankingData, isLoading: rankingLoading, isError: rankingError, refetch: rankingRefetch }));
  mockPoolStats.mockReturnValue(fakeQuery({ data: poolStatsData, isLoading: poolStatsLoading, isError: poolStatsError, refetch: poolStatsRefetch }));
  mockStatistics.mockReturnValue(fakeQuery({ data: statisticsData, isLoading: statisticsLoading, isError: statisticsError, refetch: statisticsRefetch }));
  mockTeams.mockReturnValue(fakeQuery({ data: teamsData, isLoading: teamsLoading, isError: teamsError, refetch: teamsRefetch }));
  mockPredictions.mockReturnValue(fakeQuery({ data: predictionsData, isLoading: predictionsLoading, isError: predictionsError, refetch: predictionsRefetch }));
  mockSettings.mockReturnValue(fakeQuery({ data: settingsData, isLoading: settingsLoading, isError: settingsError, refetch: settingsRefetch }));
  mockMatchesList.mockReturnValue({
    groups: [],
    flatList: matchesListFlat,
    isLoading: matchesListLoading,
    isError: matchesListError,
    refetch: matchesListRefetch,
  });

  mockPoolRankingByScope.mockImplementation((scope) => {
    const data = scope === "grupos" ? rankingGruposData : rankingEliminatoriasData;
    return fakeQuery({ data });
  });
}

// ── testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useHomeDashboard — estado neutro (uid=null)", () => {
  it("retorna estado neutro quando uid é null", () => {
    setupMocks({ uid: null });

    const { result } = renderHook(() => useHomeDashboard());

    expect(result.current.nextMatch).toBeNull();
    expect(result.current.recentResults).toEqual([]);
    expect(result.current.notices).toEqual([]);
    expect(result.current.openMatches).toEqual({ items: [], totalOpen: 0 });
    expect(result.current.predictionBreakdown).toEqual({
      correct: 0,
      partial: 0,
      wrong: 0,
      total: 0,
      isEmpty: true,
    });
  });

  it("isLoading false quando uid=null e nenhuma query carrega", () => {
    setupMocks({ uid: null });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(false);
  });

  it("isError false quando uid=null e nenhuma query falhou", () => {
    setupMocks({ uid: null });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(false);
  });
});

describe("useHomeDashboard — isLoading", () => {
  it("isLoading true quando rankingQuery está carregando", () => {
    setupMocks({ rankingLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando teamsQuery está carregando", () => {
    setupMocks({ teamsLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando useMatchesList está carregando", () => {
    setupMocks({ matchesListLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading false quando nenhuma query carrega", () => {
    setupMocks();
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useHomeDashboard — loading granular (TASK-10 render progressivo)", () => {
  it("rankingLoading → heroLoading true, matchesLoading false", () => {
    setupMocks({ rankingLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroLoading).toBe(true);
    expect(result.current.matchesLoading).toBe(false);
  });

  it("statisticsLoading → heroLoading true", () => {
    setupMocks({ statisticsLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroLoading).toBe(true);
  });

  it("matchesListLoading → matchesLoading true, heroLoading false", () => {
    setupMocks({ matchesListLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.matchesLoading).toBe(true);
    expect(result.current.heroLoading).toBe(false);
  });

  it("settingsLoading → matchesLoading true", () => {
    setupMocks({ settingsLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.matchesLoading).toBe(true);
  });

  it("nada carregando → ambas as flags false", () => {
    setupMocks();
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroLoading).toBe(false);
    expect(result.current.matchesLoading).toBe(false);
  });
});

describe("useHomeDashboard — isError", () => {
  it("isError true quando rankingQuery falha", () => {
    setupMocks({ rankingError: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando settingsQuery falha", () => {
    setupMocks({ settingsError: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando useMatchesList falha", () => {
    setupMocks({ matchesListError: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(true);
  });

  it("isError false quando nenhuma query falhou", () => {
    setupMocks();
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(false);
  });
});

describe("useHomeDashboard — refetch", () => {
  it("chama refetch de todos os hooks por recurso", () => {
    const rfRanking     = vi.fn() as () => Promise<unknown>;
    const rfStatistics  = vi.fn() as () => Promise<unknown>;
    const rfTeams       = vi.fn() as () => Promise<unknown>;
    const rfPredictions = vi.fn() as () => Promise<unknown>;
    const rfSettings    = vi.fn() as () => Promise<unknown>;

    setupMocks({
      rankingRefetch:     rfRanking,
      statisticsRefetch:  rfStatistics,
      teamsRefetch:       rfTeams,
      predictionsRefetch: rfPredictions,
      settingsRefetch:    rfSettings,
    });

    const { result } = renderHook(() => useHomeDashboard());
    result.current.refetch();

    expect(rfRanking).toHaveBeenCalledOnce();
    expect(rfStatistics).toHaveBeenCalledOnce();
    expect(rfTeams).toHaveBeenCalledOnce();
    expect(rfPredictions).toHaveBeenCalledOnce();
    expect(rfSettings).toHaveBeenCalledOnce();
  });

  it("refetch chama useMatchesList.refetch (fonte única de matches)", () => {
    const rfMatchesList = vi.fn() as () => void;
    setupMocks({ matchesListRefetch: rfMatchesList });

    const { result } = renderHook(() => useHomeDashboard());
    result.current.refetch();

    expect(rfMatchesList).toHaveBeenCalledOnce();
  });
});

describe("useHomeDashboard — openMatches", () => {
  it("deriva apenas jogos pendentes do flatList, ordenados por kickoff", () => {
    setupMocks({
      matchesListFlat: [
        makeItem("m-enviado", { predictionStatus: "enviado" }),
        makeItem("m-tarde", { kickoffAt: "2026-06-21T18:00:00.000Z" }),
        makeItem("m-cedo", { kickoffAt: "2026-06-20T18:00:00.000Z" }),
      ],
    });

    const { result } = renderHook(() => useHomeDashboard());

    expect(result.current.openMatches.totalOpen).toBe(2);
    expect(result.current.openMatches.items.map((i) => i.matchId)).toEqual([
      "m-cedo",
      "m-tarde",
    ]);
    expect(result.current.openMatches.items[0]?.predictHref).toBe(
      "/matches/m-cedo/predict",
    );
  });

  it("openMatches vazio quando nenhum jogo está pendente", () => {
    setupMocks({
      matchesListFlat: [makeItem("m-1", { predictionStatus: "bloqueado" })],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.openMatches).toEqual({ items: [], totalOpen: 0 });
  });
});

describe("useHomeDashboard — nextMatch (derivado do flatList)", () => {
  it("nextMatch homeTeam vem do MatchListItem já resolvido", () => {
    setupMocks({
      matchesListFlat: [
        makeScheduledItem("match-next", {
          homeTeam: { name: "Brasil", flagUrl: undefined },
        }),
      ],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.matchId).toBe("match-next");
    expect(result.current.nextMatch?.homeTeam.name).toBe("Brasil");
  });

  it("nextMatch null quando não há agendado futuro no flatList", () => {
    setupMocks({
      matchesListFlat: [makeFinishedItem("f-1", 1, 0)],
    });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch).toBeNull();
  });
});

describe("useHomeDashboard — predictionStatus (próximo jogo)", () => {
  it("pendente quando sem palpite e não bloqueado", () => {
    setupMocks({
      matchesListFlat: [makeScheduledItem("match-next")],
      predictionsData: [],
      settingsData: makeSettings({ predictionsLocked: false }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("pendente");
  });

  it("enviado quando palpite existe para o match", () => {
    setupMocks({
      matchesListFlat: [makeScheduledItem("match-next")],
      predictionsData: [makePrediction("match-next", 1, 0)],
      settingsData: makeSettings({ predictionsLocked: false }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("enviado");
  });

  it("bloqueado quando predictionsLocked=true (independe de palpite)", () => {
    setupMocks({
      matchesListFlat: [makeScheduledItem("match-next")],
      predictionsData: [makePrediction("match-next", 1, 0)],
      settingsData: makeSettings({ predictionsLocked: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("bloqueado");
  });

  it("bloqueado quando predictionsLocked=true sem palpite", () => {
    setupMocks({
      matchesListFlat: [makeScheduledItem("match-next")],
      predictionsData: [],
      settingsData: makeSettings({ predictionsLocked: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("bloqueado");
  });
});

describe("useHomeDashboard — points em recentResults", () => {
  it("10 pts para palpite com placar exato", () => {
    setupMocks({
      matchesListFlat: [makeFinishedItem("match-01", 2, 1)],
      predictionsData: [makePrediction("match-01", 2, 1)],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults).toHaveLength(1);
    expect(result.current.recentResults[0]?.points).toBe(10);
  });

  it("5 pts para palpite que acertou o vencedor", () => {
    setupMocks({
      matchesListFlat: [makeFinishedItem("match-01", 2, 1)],
      predictionsData: [makePrediction("match-01", 3, 0)],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.points).toBe(5);
  });

  it("0 pts para palpite que errou o vencedor", () => {
    setupMocks({
      matchesListFlat: [makeFinishedItem("match-01", 2, 1)],
      predictionsData: [makePrediction("match-01", 0, 3)],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.points).toBe(0);
  });

  it("0 pts quando sem palpite para o jogo", () => {
    setupMocks({
      matchesListFlat: [makeFinishedItem("match-01", 2, 1)],
      predictionsData: [],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.points).toBe(0);
    expect(result.current.recentResults[0]?.userPrediction).toBeNull();
  });

  it("matchHomeScore e matchAwayScore corretos no resultado", () => {
    setupMocks({ matchesListFlat: [makeFinishedItem("match-01", 3, 2)] });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.matchHomeScore).toBe(3);
    expect(result.current.recentResults[0]?.matchAwayScore).toBe(2);
  });
});

describe("useHomeDashboard — coleções vazias", () => {
  it("recentResults vazio quando não há finished no flatList", () => {
    setupMocks({ matchesListFlat: [makeScheduledItem("s-1")] });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults).toEqual([]);
  });

  it("nextMatch null quando flatList vazio", () => {
    setupMocks({ matchesListFlat: [] });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch).toBeNull();
  });

  it("notices vazio quando settings sem flags e sem próximo jogo", () => {
    setupMocks({
      matchesListFlat: [],
      settingsData: makeSettings({ predictionsLocked: false, registrationOpen: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.notices).toEqual([]);
  });
});

describe("useHomeDashboard — split-phase-ranking (heroSummaryByScope)", () => {
  it("heroSummaryByScope undefined quando splitPhaseRanking ausente (flag OFF)", () => {
    setupMocks({ rankingData: makeRanking("user-01", 1, 10) });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroSummaryByScope).toBeUndefined();
  });

  it("heroSummaryByScope undefined quando splitPhaseRanking=false", () => {
    const rankingOff = { ...makeRanking("user-01", 1, 10), splitPhaseRanking: false };
    setupMocks({ rankingData: rankingOff as unknown as Ranking });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroSummaryByScope).toBeUndefined();
  });

  it("heroSummaryByScope presente quando splitPhaseRanking=true", () => {
    const rankingOn = { ...makeRanking("user-01", 1, 10), splitPhaseRanking: true };
    const rankingGrupos = makeRanking("user-01", 2, 45);
    const rankingEliminatorias = makeRanking("user-01", 1, 30);

    setupMocks({
      rankingData: rankingOn as unknown as Ranking,
      rankingGruposData: rankingGrupos,
      rankingEliminatoriasData: rankingEliminatorias,
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroSummaryByScope).toBeDefined();
    expect(result.current.heroSummaryByScope?.grupos.position).toBe(2);
    expect(result.current.heroSummaryByScope?.eliminatorias?.position).toBe(1);
  });

  it("heroSummaryByScope.eliminatorias null quando doc da fase não existe", () => {
    const rankingOn = { ...makeRanking("user-01", 1, 10), splitPhaseRanking: true };

    setupMocks({
      rankingData: rankingOn as unknown as Ranking,
      rankingGruposData: makeRanking("user-01", 2, 45),
      rankingEliminatoriasData: null,
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroSummaryByScope?.eliminatorias).toBeNull();
    expect(result.current.heroSummaryByScope?.grupos).toBeDefined();
  });

  it("heroSummary (geral) continua presente mesmo com split ON (retrocompat)", () => {
    const rankingOn = { ...makeRanking("user-01", 1, 10), splitPhaseRanking: true };
    setupMocks({ rankingData: rankingOn as unknown as Ranking });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.heroSummary).toBeDefined();
    expect(result.current.heroSummary.position).toBe(1);
  });

  it("W2: usePoolRankingByScope chamado com enabled:false quando flag OFF (sem 2 leituras extras)", () => {
    setupMocks({ rankingData: makeRanking("user-01", 1, 10) });
    renderHook(() => useHomeDashboard());
    expect(mockPoolRankingByScope).toHaveBeenCalledWith("grupos", { enabled: false });
    expect(mockPoolRankingByScope).toHaveBeenCalledWith("eliminatorias", { enabled: false });
  });
});
