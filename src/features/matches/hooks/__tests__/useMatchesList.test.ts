// @vitest-environment jsdom
/**
 * TDD — TASK-02 (jogos)
 * Testes do compositor useMatchesList.
 * Mockam os 3 hooks de baixo nível + useAuth para testar join/derivação/estado agregado
 * em isolamento, sem QueryClient real.
 *
 * Cenários:
 * - uid=null → estado neutro (groups=[], flatList=[], isLoading=false, isError=false)
 * - isLoading true quando qualquer das 3 queries carrega
 * - isError true quando qualquer das 3 queries falha
 * - refetch chama .refetch() das 3 queries
 * - join: flatList com homeTeam/awayTeam resolvidos + predictionStatus derivado
 * - fallback de team quando teams vazio
 * - agrupamento por dia (groups)
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseQueryResult } from "@tanstack/react-query";
import type { MatchWithId, Prediction, TeamWithId } from "@/types";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth");
vi.mock("../useMatches");
vi.mock("../useTeams");
vi.mock("../usePredictions");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { useMatches } from "../useMatches";
import { useTeams } from "../useTeams";
import { usePredictions } from "../usePredictions";

import { useMatchesList } from "../useMatchesList";

// ── helpers de tipagem para os mocks ─────────────────────────────────────────

const mockUseAuth       = vi.mocked(useAuth);
const mockUseMatches    = vi.mocked(useMatches);
const mockUseTeams      = vi.mocked(useTeams);
const mockUsePredictions = vi.mocked(usePredictions);

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

function makeTeam(id: string, name: string = `Seleção ${id}`): TeamWithId {
  return { id, name, code: "BRA", flagUrl: `https://flags/${id}.png` };
}

/** Partida futura (now < kickoffAt) para que predictionStatus não seja "bloqueado" por tempo */
function makeScheduledMatch(id: string, kickoffAt = "2099-12-31T20:00:00.000Z"): MatchWithId {
  return {
    id,
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt,
    stage: "grupos",
    round: 1,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
  };
}

function makePrediction(matchId: string): Prediction {
  return { uid: "user-01", matchId, homeScore: 1, awayScore: 0 };
}

// ── helper para configurar todos os mocks de uma vez ─────────────────────────

function setupMocks({
  uid = "user-01" as string | null,
  matchesData = [] as MatchWithId[],
  teamsData = [makeTeam("team-bra"), makeTeam("team-arg")] as TeamWithId[],
  predictionsData = [] as Prediction[],
  matchesLoading = false,
  teamsLoading = false,
  predictionsLoading = false,
  matchesError = false,
  teamsError = false,
  predictionsError = false,
  matchesRefetch = vi.fn() as () => Promise<unknown>,
  teamsRefetch = vi.fn() as () => Promise<unknown>,
  predictionsRefetch = vi.fn() as () => Promise<unknown>,
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

  mockUseMatches.mockReturnValue(
    fakeQuery({ data: matchesData, isLoading: matchesLoading, isError: matchesError, refetch: matchesRefetch }),
  );
  mockUseTeams.mockReturnValue(
    fakeQuery({ data: teamsData, isLoading: teamsLoading, isError: teamsError, refetch: teamsRefetch }),
  );
  mockUsePredictions.mockReturnValue(
    fakeQuery({ data: predictionsData, isLoading: predictionsLoading, isError: predictionsError, refetch: predictionsRefetch }),
  );
}

// ── testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMatchesList — estado neutro (uid=null)", () => {
  it("retorna groups=[], flatList=[], isLoading=false, isError=false quando uid é null", () => {
    setupMocks({ uid: null });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.groups).toEqual([]);
    expect(result.current.flatList).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe("useMatchesList — isLoading", () => {
  it("isLoading true quando matchesQuery está carregando", () => {
    setupMocks({ matchesLoading: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando teamsQuery está carregando", () => {
    setupMocks({ teamsLoading: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando predictionsQuery está carregando", () => {
    setupMocks({ predictionsLoading: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading false quando nenhuma query carrega", () => {
    setupMocks();
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useMatchesList — isError", () => {
  it("isError true quando matchesQuery falha", () => {
    setupMocks({ matchesError: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando teamsQuery falha", () => {
    setupMocks({ teamsError: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando predictionsQuery falha", () => {
    setupMocks({ predictionsError: true });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isError).toBe(true);
  });

  it("isError false quando nenhuma query falhou", () => {
    setupMocks();
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.isError).toBe(false);
  });
});

describe("useMatchesList — refetch", () => {
  it("chama refetch das 3 queries quando invocado", () => {
    const rfMatches     = vi.fn() as () => Promise<unknown>;
    const rfTeams       = vi.fn() as () => Promise<unknown>;
    const rfPredictions = vi.fn() as () => Promise<unknown>;

    setupMocks({
      matchesRefetch:     rfMatches,
      teamsRefetch:       rfTeams,
      predictionsRefetch: rfPredictions,
    });

    const { result } = renderHook(() => useMatchesList());
    result.current.refetch();

    expect(rfMatches).toHaveBeenCalledOnce();
    expect(rfTeams).toHaveBeenCalledOnce();
    expect(rfPredictions).toHaveBeenCalledOnce();
  });
});

describe("useMatchesList — join + derivação", () => {
  it("flatList[0].homeTeam.name correto quando team existe no mapa", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1")],
      teamsData: [makeTeam("team-bra", "Brasil"), makeTeam("team-arg", "Argentina")],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.flatList[0]?.homeTeam.name).toBe("Brasil");
    expect(result.current.flatList[0]?.awayTeam.name).toBe("Argentina");
  });

  it("flatList[0].homeTeam.name = teamId raw quando teams vazio (fallback)", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1")],
      teamsData: [],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.flatList[0]?.homeTeam.name).toBe("team-bra");
    expect(result.current.flatList[0]?.homeTeam.flagUrl).toBeUndefined();
  });

  it("predictionStatus='enviado' quando há palpite para o match", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1")],
      predictionsData: [makePrediction("m1")],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.flatList[0]?.predictionStatus).toBe("enviado");
  });

  it("predictionStatus='pendente' sem palpite + scheduled + kickoff futuro", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1", "2099-12-31T20:00:00.000Z")],
      predictionsData: [],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.flatList[0]?.predictionStatus).toBe("pendente");
  });

  it("predictionStatus='bloqueado' quando kickoffAt é no passado", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1", "2000-01-01T00:00:00.000Z")],
      predictionsData: [makePrediction("m1")],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.flatList[0]?.predictionStatus).toBe("bloqueado");
  });
});

describe("useMatchesList — agrupamento por dia", () => {
  it("groups=[] quando matches é array vazio", () => {
    setupMocks({ matchesData: [] });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.groups).toEqual([]);
  });

  it("2 matches no mesmo dia → 1 grupo com 2 matches", () => {
    setupMocks({
      matchesData: [
        makeScheduledMatch("m1", "2099-06-15T14:00:00.000Z"),
        makeScheduledMatch("m2", "2099-06-15T18:00:00.000Z"),
      ],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]?.matches).toHaveLength(2);
  });

  it("2 matches em dias diferentes → 2 grupos", () => {
    setupMocks({
      matchesData: [
        makeScheduledMatch("m1", "2099-06-15T14:00:00.000Z"),
        makeScheduledMatch("m2", "2099-06-16T18:00:00.000Z"),
      ],
    });
    const { result } = renderHook(() => useMatchesList());
    expect(result.current.groups).toHaveLength(2);
  });

  it("cada match em flatList carrega homeTeam + awayTeam + predictionStatus", () => {
    setupMocks({
      matchesData: [makeScheduledMatch("m1")],
      teamsData: [makeTeam("team-bra", "Brasil"), makeTeam("team-arg", "Argentina")],
    });
    const { result } = renderHook(() => useMatchesList());
    const item = result.current.flatList[0];
    expect(item).toHaveProperty("homeTeam");
    expect(item).toHaveProperty("awayTeam");
    expect(item).toHaveProperty("predictionStatus");
  });
});
