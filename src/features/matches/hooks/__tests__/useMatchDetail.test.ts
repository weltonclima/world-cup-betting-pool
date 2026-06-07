// @vitest-environment jsdom
/**
 * TDD — TASK-02 (jogos)
 * Testes do compositor useMatchDetail.
 * Mockam os 3 hooks de baixo nível + useAuth para testar join/derivação/estado agregado.
 *
 * Cenários:
 * - uid=null → match=null, isLoading=false, isError=false
 * - isLoading true quando qualquer das 3 queries carrega
 * - isError true quando qualquer das 3 queries falha
 * - refetch chama .refetch() das 3 queries
 * - match=null quando matchQuery.data=null (404)
 * - match com team resolvido + predictionStatus derivado
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
vi.mock("../useMatch");
vi.mock("../useTeams");
vi.mock("../usePredictions");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { useMatch } from "../useMatch";
import { useTeams } from "../useTeams";
import { usePredictions } from "../usePredictions";

import { useMatchDetail } from "../useMatchDetail";

// ── helpers de tipagem ────────────────────────────────────────────────────────

const mockUseAuth        = vi.mocked(useAuth);
const mockUseMatch       = vi.mocked(useMatch);
const mockUseTeams       = vi.mocked(useTeams);
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
  return { uid: "user-01", matchId, homeScore: 2, awayScore: 1 };
}

// ── helper de setup ───────────────────────────────────────────────────────────

function setupMocks({
  uid = "user-01" as string | null,
  matchData = makeScheduledMatch("match-01") as MatchWithId | null,
  teamsData = [makeTeam("team-bra"), makeTeam("team-arg")] as TeamWithId[],
  predictionsData = [] as Prediction[],
  matchLoading = false,
  teamsLoading = false,
  predictionsLoading = false,
  matchError = false,
  teamsError = false,
  predictionsError = false,
  matchRefetch = vi.fn() as () => Promise<unknown>,
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

  mockUseMatch.mockReturnValue(
    fakeQuery({ data: matchData, isLoading: matchLoading, isError: matchError, refetch: matchRefetch }),
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

describe("useMatchDetail — estado neutro (uid=null)", () => {
  it("retorna match=null, isLoading=false, isError=false quando uid é null", () => {
    setupMocks({ uid: null });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe("useMatchDetail — isLoading", () => {
  it("isLoading true quando matchQuery está carregando", () => {
    setupMocks({ matchLoading: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando teamsQuery está carregando", () => {
    setupMocks({ teamsLoading: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando predictionsQuery está carregando", () => {
    setupMocks({ predictionsLoading: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading false quando nenhuma query carrega", () => {
    setupMocks();
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useMatchDetail — isError", () => {
  it("isError true quando matchQuery falha", () => {
    setupMocks({ matchError: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando teamsQuery falha", () => {
    setupMocks({ teamsError: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isError).toBe(true);
  });

  it("isError true quando predictionsQuery falha", () => {
    setupMocks({ predictionsError: true });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isError).toBe(true);
  });

  it("isError false quando nenhuma query falhou", () => {
    setupMocks();
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.isError).toBe(false);
  });
});

describe("useMatchDetail — refetch", () => {
  it("chama refetch das 3 queries quando invocado", () => {
    const rfMatch       = vi.fn() as () => Promise<unknown>;
    const rfTeams       = vi.fn() as () => Promise<unknown>;
    const rfPredictions = vi.fn() as () => Promise<unknown>;

    setupMocks({
      matchRefetch:       rfMatch,
      teamsRefetch:       rfTeams,
      predictionsRefetch: rfPredictions,
    });

    const { result } = renderHook(() => useMatchDetail("match-01"));
    result.current.refetch();

    expect(rfMatch).toHaveBeenCalledOnce();
    expect(rfTeams).toHaveBeenCalledOnce();
    expect(rfPredictions).toHaveBeenCalledOnce();
  });
});

describe("useMatchDetail — match null (404 / loading)", () => {
  it("match=null quando matchQuery.data=null (404)", () => {
    setupMocks({ matchData: null });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match).toBeNull();
  });

  it("match=null quando matchQuery está carregando (data ainda undefined)", () => {
    // Quando isLoading=true, TanStack Query não disponibiliza data ainda.
    // Simular passando data=undefined explicitamente via fakeQuery direto.
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: "user-01" } as import("firebase/auth").User,
      profile: null,
      status: null,
      role: null,
      loading: false,
      error: null,
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    });
    mockUseMatch.mockReturnValue(
      fakeQuery<MatchWithId | null>({ data: undefined, isLoading: true }),
    );
    mockUseTeams.mockReturnValue(
      fakeQuery({ data: [makeTeam("team-bra"), makeTeam("team-arg")] }),
    );
    mockUsePredictions.mockReturnValue(
      fakeQuery({ data: [] }),
    );
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match).toBeNull();
  });
});

describe("useMatchDetail — join + derivação", () => {
  it("match.homeTeam.name correto quando team existe", () => {
    setupMocks({
      matchData: makeScheduledMatch("match-01"),
      teamsData: [makeTeam("team-bra", "Brasil"), makeTeam("team-arg", "Argentina")],
    });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.homeTeam.name).toBe("Brasil");
    expect(result.current.match?.awayTeam.name).toBe("Argentina");
  });

  it("match.homeTeam.name = teamId raw quando teams vazio (fallback)", () => {
    setupMocks({
      matchData: makeScheduledMatch("match-01"),
      teamsData: [],
    });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.homeTeam.name).toBe("team-bra");
    expect(result.current.match?.homeTeam.flagUrl).toBeUndefined();
  });

  it("predictionStatus='enviado' quando há palpite para o match", () => {
    setupMocks({
      matchData: makeScheduledMatch("match-01"),
      predictionsData: [makePrediction("match-01")],
    });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.predictionStatus).toBe("enviado");
  });

  it("predictionStatus='pendente' sem palpite + scheduled + kickoff futuro", () => {
    setupMocks({
      matchData: makeScheduledMatch("match-01", "2099-12-31T20:00:00.000Z"),
      predictionsData: [],
    });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.predictionStatus).toBe("pendente");
  });

  it("predictionStatus='bloqueado' quando kickoffAt é no passado", () => {
    setupMocks({
      matchData: makeScheduledMatch("match-01", "2000-01-01T00:00:00.000Z"),
      predictionsData: [],
    });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.predictionStatus).toBe("bloqueado");
  });

  it("match carrega todos os campos originais da partida", () => {
    const rawMatch = makeScheduledMatch("match-01");
    setupMocks({ matchData: rawMatch });
    const { result } = renderHook(() => useMatchDetail("match-01"));
    expect(result.current.match?.id).toBe("match-01");
    expect(result.current.match?.stage).toBe("grupos");
    expect(result.current.match?.status).toBe("scheduled");
    expect(result.current.match?.groupId).toBe("group-a");
  });
});
