// @vitest-environment jsdom
/**
 * Testes do compositor useHomeDashboard (TASK-05 — review B-01).
 * Mockam os 7 hooks por recurso e @/hooks/useAuth para testar a lógica
 * de orquestração em isolamento, sem QueryClient real.
 *
 * Cenários (§11.2 da spec):
 * - uid=null → estado neutro
 * - isLoading true quando qualquer query carrega
 * - isError true quando qualquer query falha
 * - refetch chama refetch de todos os hooks
 * - ranking summary derivado corretamente
 * - teams vazio → fallback de nome com teamId raw
 * - predictionStatus: enviado/pendente/bloqueado
 * - isCorrect em recentResults
 * - coleções vazias
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseQueryResult } from "@tanstack/react-query";
import type { MatchWithId, Prediction, Ranking, Statistics, SystemSettings, TeamWithId } from "@/types";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

// Firebase client SDK exige variáveis de ambiente; mockar para isolar os testes.
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth");
vi.mock("../useGeneralRanking");
vi.mock("../useStatistics");
vi.mock("../useNextMatch");
vi.mock("../useRecentResults");
vi.mock("../useTeams");
vi.mock("../usePredictions");
vi.mock("../useSystemSettings");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { useGeneralRanking } from "../useGeneralRanking";
import { useStatistics } from "../useStatistics";
import { useNextMatch } from "../useNextMatch";
import { useRecentResults } from "../useRecentResults";
import { useTeams } from "../useTeams";
import { usePredictions } from "../usePredictions";
import { useSystemSettings } from "../useSystemSettings";

import { useHomeDashboard } from "../useHomeDashboard";

// ── helpers de tipagem para os mocks ─────────────────────────────────────────

const mockUseAuth      = vi.mocked(useAuth);
const mockRanking      = vi.mocked(useGeneralRanking);
const mockStatistics   = vi.mocked(useStatistics);
const mockNextMatch    = vi.mocked(useNextMatch);
const mockRecentResults = vi.mocked(useRecentResults);
const mockTeams        = vi.mocked(useTeams);
const mockPredictions  = vi.mocked(usePredictions);
const mockSettings     = vi.mocked(useSystemSettings);

// ── factory de UseQueryResult falso ──────────────────────────────────────────

/**
 * Retorna um objeto mínimo que satisfaz a interface UseQueryResult<T>.
 * Apenas os campos que useHomeDashboard realmente lê são fornecidos.
 * Cast via `unknown` para evitar `any` (W-05).
 */
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
    // Campos exigidos pelo tipo UseQueryResult mas não lidos pelo compositor
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

function makeFinishedMatch(id: string, homeScore: number, awayScore: number): MatchWithId {
  return {
    id,
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-15T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "finished",
    homeScore,
    awayScore,
    groupId: "group-a",
    venue: null,
  };
}

function makeScheduledMatch(id: string): MatchWithId {
  return {
    id,
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 2,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
  };
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

// ── helper para configurar todos os mocks de uma vez ─────────────────────────

function setupMocks({
  uid = "user-01",
  rankingData = makeRanking("user-01", 1, 10),
  statisticsData = makeStatistics(5, 50),
  nextMatchData = makeScheduledMatch("match-next"),
  recentData = [] as MatchWithId[],
  teamsData = [makeTeam("team-bra"), makeTeam("team-arg")] as TeamWithId[],
  predictionsData = [] as Prediction[],
  settingsData = makeSettings(),
  rankingLoading = false,
  statisticsLoading = false,
  nextMatchLoading = false,
  recentLoading = false,
  teamsLoading = false,
  predictionsLoading = false,
  settingsLoading = false,
  rankingError = false,
  statisticsError = false,
  nextMatchError = false,
  recentError = false,
  teamsError = false,
  predictionsError = false,
  settingsError = false,
  rankingRefetch = vi.fn() as () => Promise<unknown>,
  statisticsRefetch = vi.fn() as () => Promise<unknown>,
  nextMatchRefetch = vi.fn() as () => Promise<unknown>,
  recentRefetch = vi.fn() as () => Promise<unknown>,
  teamsRefetch = vi.fn() as () => Promise<unknown>,
  predictionsRefetch = vi.fn() as () => Promise<unknown>,
  settingsRefetch = vi.fn() as () => Promise<unknown>,
}: {
  uid?: string | null;
  rankingData?: Ranking | null;
  statisticsData?: Statistics | null;
  nextMatchData?: MatchWithId | null;
  recentData?: MatchWithId[];
  teamsData?: TeamWithId[];
  predictionsData?: Prediction[];
  settingsData?: SystemSettings | null;
  rankingLoading?: boolean;
  statisticsLoading?: boolean;
  nextMatchLoading?: boolean;
  recentLoading?: boolean;
  teamsLoading?: boolean;
  predictionsLoading?: boolean;
  settingsLoading?: boolean;
  rankingError?: boolean;
  statisticsError?: boolean;
  nextMatchError?: boolean;
  recentError?: boolean;
  teamsError?: boolean;
  predictionsError?: boolean;
  settingsError?: boolean;
  rankingRefetch?: () => Promise<unknown>;
  statisticsRefetch?: () => Promise<unknown>;
  nextMatchRefetch?: () => Promise<unknown>;
  recentRefetch?: () => Promise<unknown>;
  teamsRefetch?: () => Promise<unknown>;
  predictionsRefetch?: () => Promise<unknown>;
  settingsRefetch?: () => Promise<unknown>;
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
  mockStatistics.mockReturnValue(fakeQuery({ data: statisticsData, isLoading: statisticsLoading, isError: statisticsError, refetch: statisticsRefetch }));
  mockNextMatch.mockReturnValue(fakeQuery({ data: nextMatchData, isLoading: nextMatchLoading, isError: nextMatchError, refetch: nextMatchRefetch }));
  mockRecentResults.mockReturnValue(fakeQuery({ data: recentData, isLoading: recentLoading, isError: recentError, refetch: recentRefetch }));
  mockTeams.mockReturnValue(fakeQuery({ data: teamsData, isLoading: teamsLoading, isError: teamsError, refetch: teamsRefetch }));
  mockPredictions.mockReturnValue(fakeQuery({ data: predictionsData, isLoading: predictionsLoading, isError: predictionsError, refetch: predictionsRefetch }));
  mockSettings.mockReturnValue(fakeQuery({ data: settingsData, isLoading: settingsLoading, isError: settingsError, refetch: settingsRefetch }));
}

// ── testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useHomeDashboard — estado neutro (uid=null)", () => {
  it("retorna estado neutro quando uid é null", () => {
    setupMocks({ uid: null });

    const { result } = renderHook(() => useHomeDashboard());

    expect(result.current.ranking).toBeNull();
    expect(result.current.nextMatch).toBeNull();
    expect(result.current.recentResults).toEqual([]);
    expect(result.current.notices).toEqual([]);
    expect(result.current.currentStage).toEqual({ stage: null, roundLabel: null });
    expect(result.current.performance).toEqual({
      totalCorrect: 0,
      accuracy: 0,
      longestStreak: 0,
      gamesPredicted: 0,
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
  it("isLoading true quando nextMatchQuery está carregando", () => {
    setupMocks({ nextMatchLoading: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(true);
  });

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

  it("isLoading false quando nenhuma query carrega", () => {
    setupMocks();
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useHomeDashboard — isError", () => {
  it("isError true quando rankingQuery falha", () => {
    setupMocks({ rankingError: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando nextMatchQuery falha", () => {
    setupMocks({ nextMatchError: true });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando settingsQuery falha", () => {
    setupMocks({ settingsError: true });
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
  it("chama refetch de todos os 7 hooks", () => {
    const rfRanking     = vi.fn() as () => Promise<unknown>;
    const rfStatistics  = vi.fn() as () => Promise<unknown>;
    const rfNextMatch   = vi.fn() as () => Promise<unknown>;
    const rfRecent      = vi.fn() as () => Promise<unknown>;
    const rfTeams       = vi.fn() as () => Promise<unknown>;
    const rfPredictions = vi.fn() as () => Promise<unknown>;
    const rfSettings    = vi.fn() as () => Promise<unknown>;

    setupMocks({
      rankingRefetch:     rfRanking,
      statisticsRefetch:  rfStatistics,
      nextMatchRefetch:   rfNextMatch,
      recentRefetch:      rfRecent,
      teamsRefetch:       rfTeams,
      predictionsRefetch: rfPredictions,
      settingsRefetch:    rfSettings,
    });

    const { result } = renderHook(() => useHomeDashboard());
    result.current.refetch();

    expect(rfRanking).toHaveBeenCalledOnce();
    expect(rfStatistics).toHaveBeenCalledOnce();
    expect(rfNextMatch).toHaveBeenCalledOnce();
    expect(rfRecent).toHaveBeenCalledOnce();
    expect(rfTeams).toHaveBeenCalledOnce();
    expect(rfPredictions).toHaveBeenCalledOnce();
    expect(rfSettings).toHaveBeenCalledOnce();
  });
});

describe("useHomeDashboard — ranking summary", () => {
  it("rankingSummary preenchido quando uid está nas entries", () => {
    setupMocks({
      rankingData: makeRanking("user-01", 2, 8),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.ranking).toEqual({
      position: 2,
      totalParticipants: 2,
      points: 8,
    });
  });

  it("rankingSummary null quando ranking é null", () => {
    setupMocks({ rankingData: null });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.ranking).toBeNull();
  });
});

describe("useHomeDashboard — team fallback", () => {
  it("teams vazio → nextMatch.homeTeam.name usa teamId raw como fallback", () => {
    setupMocks({
      teamsData: [],
      nextMatchData: makeScheduledMatch("match-next"),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.homeTeam.name).toBe("team-bra");
    expect(result.current.nextMatch?.homeTeam.flagUrl).toBeUndefined();
  });

  it("teams preenchido → nextMatch.homeTeam.name correto", () => {
    setupMocks({
      teamsData: [makeTeam("team-bra"), makeTeam("team-arg")],
      nextMatchData: makeScheduledMatch("match-next"),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.homeTeam.name).toBe("Seleção team-bra");
  });
});

describe("useHomeDashboard — predictionStatus", () => {
  it("pendente quando sem palpite e não bloqueado", () => {
    setupMocks({
      nextMatchData: makeScheduledMatch("match-next"),
      predictionsData: [],
      settingsData: makeSettings({ predictionsLocked: false }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("pendente");
  });

  it("enviado quando palpite existe para o match", () => {
    setupMocks({
      nextMatchData: makeScheduledMatch("match-next"),
      predictionsData: [makePrediction("match-next", 1, 0)],
      settingsData: makeSettings({ predictionsLocked: false }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("enviado");
  });

  it("bloqueado quando predictionsLocked=true (independe de palpite)", () => {
    setupMocks({
      nextMatchData: makeScheduledMatch("match-next"),
      predictionsData: [makePrediction("match-next", 1, 0)],
      settingsData: makeSettings({ predictionsLocked: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("bloqueado");
  });

  it("bloqueado quando predictionsLocked=true sem palpite", () => {
    setupMocks({
      nextMatchData: makeScheduledMatch("match-next"),
      predictionsData: [],
      settingsData: makeSettings({ predictionsLocked: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch?.predictionStatus).toBe("bloqueado");
  });
});

describe("useHomeDashboard — isCorrect em recentResults", () => {
  it("isCorrect true para palpite com placar exato", () => {
    const match = makeFinishedMatch("match-01", 2, 1);
    setupMocks({
      recentData: [match],
      predictionsData: [makePrediction("match-01", 2, 1)],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults).toHaveLength(1);
    expect(result.current.recentResults[0]?.isCorrect).toBe(true);
  });

  it("isCorrect false para palpite errado", () => {
    const match = makeFinishedMatch("match-01", 2, 1);
    setupMocks({
      recentData: [match],
      predictionsData: [makePrediction("match-01", 3, 0)],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.isCorrect).toBe(false);
  });

  it("isCorrect false quando sem palpite para o jogo", () => {
    const match = makeFinishedMatch("match-01", 2, 1);
    setupMocks({
      recentData: [match],
      predictionsData: [],
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.isCorrect).toBe(false);
    expect(result.current.recentResults[0]?.userPrediction).toBeNull();
  });

  it("matchHomeScore e matchAwayScore corretos no resultado", () => {
    const match = makeFinishedMatch("match-01", 3, 2);
    setupMocks({ recentData: [match] });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults[0]?.matchHomeScore).toBe(3);
    expect(result.current.recentResults[0]?.matchAwayScore).toBe(2);
  });
});

describe("useHomeDashboard — coleções vazias", () => {
  it("recentResults vazio quando recentData é []", () => {
    setupMocks({ recentData: [] });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.recentResults).toEqual([]);
  });

  it("nextMatch null quando nextMatchData é null", () => {
    setupMocks({ nextMatchData: null });
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextMatch).toBeNull();
  });

  it("notices vazio quando settings sem flags e sem nextMatch", () => {
    setupMocks({
      nextMatchData: null,
      settingsData: makeSettings({ predictionsLocked: false, registrationOpen: true }),
    });

    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.notices).toEqual([]);
  });
});
