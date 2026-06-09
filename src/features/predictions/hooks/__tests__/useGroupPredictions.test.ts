// @vitest-environment jsdom
/**
 * Testes de useGroupPredictions (TASK-05 — spec §8.3).
 *
 * 8 cenários de integração:
 * T1: Sem predictions salvas, sem draft → currentScores undefined, isDirty false
 * T2: Com prediction salva, sem draft → currentScores === savedPrediction, isDirty false
 * T3: Com draft diferente do salvo → currentScores === draftPrediction, isDirty true
 * T4: Com draft igual ao salvo → isDirty false
 * T5: Com draft, sem prediction salva → currentScores === draftPrediction, isDirty true
 * T6: Match bloqueado → isLocked true
 * T7: filledCount conta draft + salvo sem duplicata
 * T8: isLoading true quando qualquer query carregando
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import type { MatchWithId, Prediction, TeamWithId } from "@/types";

// ── mocks antes dos imports ───────────────────────────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    firebaseUser: { uid: "user-01" },
    profile: null,
    status: null,
    role: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn(),
  })),
}));

vi.mock("@/features/matches/hooks/useGroupMatches");
vi.mock("@/features/matches/hooks/useTeams");
vi.mock("@/features/predictions/hooks/usePredictions");
vi.mock("@/features/predictions/hooks/usePredictionDraft");

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { useGroupMatches } from "@/features/matches/hooks/useGroupMatches";
import { useTeams } from "@/features/matches/hooks/useTeams";
import { usePredictions } from "@/features/predictions/hooks/usePredictions";
import { usePredictionDraft } from "@/features/predictions/hooks/usePredictionDraft";
import { useGroupPredictions } from "../useGroupPredictions";

// ── typed mocks ───────────────────────────────────────────────────────────────

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseGroupMatches = vi.mocked(useGroupMatches);
const mockedUseTeams = vi.mocked(useTeams);
const mockedUsePredictions = vi.mocked(usePredictions);
const mockedUsePredictionDraft = vi.mocked(usePredictionDraft);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryResult<T>(
  data: T | undefined,
  overrides: { isLoading?: boolean; isError?: boolean } = {},
): UseQueryResult<T> {
  return {
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isFetching: false,
    isSuccess: !overrides.isLoading && !overrides.isError && data !== undefined,
    isPending: overrides.isLoading ?? false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    isRefetching: false,
    isPaused: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    errorUpdateCount: 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    status: overrides.isLoading ? "pending" : "success",
    refetch: vi.fn(),
    promise: Promise.resolve(data as T),
  } as unknown as UseQueryResult<T>;
}

function makeMatch(id: string, overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    kickoffAt: "2099-06-14T16:00:00Z", // futuro por padrão → não bloqueado
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    stage: "grupos",
    round: 1,
    groupId: "A",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    venue: { name: "Estádio", city: "Cidade" },
    ...overrides,
  };
}

function makeTeam(id: string, name: string): TeamWithId {
  return { id, name, flagUrl: undefined, country: name, flag: "" } as unknown as TeamWithId;
}

function makePrediction(
  matchId: string,
  homeScore = 2,
  awayScore = 1,
): Prediction {
  return {
    uid: "user-01",
    matchId,
    homeScore,
    awayScore,
  };
}

const teamBra = makeTeam("team-bra", "Brasil");
const teamArg = makeTeam("team-arg", "Argentina");

const matchA = makeMatch("m-01", { groupId: "A" });
const matchB = makeMatch("m-02", { groupId: "A", kickoffAt: "2099-06-15T16:00:00Z" });
const matchLocked = makeMatch("m-03", {
  groupId: "A",
  kickoffAt: "2020-01-01T00:00:00Z", // passado → bloqueado
  status: "finished",
});

// ── draft mock factory ────────────────────────────────────────────────────────

function makeDraftMock(store: Record<string, { homeScore: number; awayScore: number }> = {}) {
  return {
    getDraft: (matchId: string) => store[matchId],
    setDraft: vi.fn(),
    clearDraft: vi.fn(),
    allDrafts: store,
  };
}

// ── setup padrão ──────────────────────────────────────────────────────────────

function setupMocks(overrides: {
  uid?: string | null;
  matches?: MatchWithId[];
  teams?: TeamWithId[];
  predictions?: Prediction[];
  draft?: Record<string, { homeScore: number; awayScore: number }>;
  matchesLoading?: boolean;
  teamsLoading?: boolean;
  predictionsLoading?: boolean;
  matchesError?: boolean;
  teamsError?: boolean;
  predictionsError?: boolean;
} = {}) {
  const uid = overrides.uid !== undefined ? overrides.uid : "user-01";

  mockedUseAuth.mockReturnValue({
    firebaseUser: uid !== null ? ({ uid } as unknown as ReturnType<typeof useAuth>["firebaseUser"]) : null,
    profile: null,
    status: null,
    role: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);

  mockedUseGroupMatches.mockReturnValue(
    makeQueryResult<MatchWithId[]>(overrides.matches ?? [matchA, matchB], {
      isLoading: overrides.matchesLoading,
      isError: overrides.matchesError,
    }),
  );

  mockedUseTeams.mockReturnValue(
    makeQueryResult<TeamWithId[]>(overrides.teams ?? [teamBra, teamArg], {
      isLoading: overrides.teamsLoading,
      isError: overrides.teamsError,
    }),
  );

  mockedUsePredictions.mockReturnValue(
    makeQueryResult<Prediction[]>(overrides.predictions ?? [], {
      isLoading: overrides.predictionsLoading,
      isError: overrides.predictionsError,
    }),
  );

  mockedUsePredictionDraft.mockReturnValue(makeDraftMock(overrides.draft ?? {}));
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

// ── testes ────────────────────────────────────────────────────────────────────

describe("useGroupPredictions — prioridade draft > saved", () => {
  it("T1: sem predictions salvas e sem draft → currentScores undefined, isDirty false", () => {
    setupMocks({ predictions: [], draft: {} });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toBeUndefined();
    expect(item?.isDirty).toBe(false);
  });

  it("T2: com prediction salva, sem draft → currentScores === savedPrediction, isDirty false", () => {
    setupMocks({
      predictions: [makePrediction("m-01", 2, 1)],
      draft: {},
    });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 2, awayScore: 1 });
    expect(item?.savedPrediction).toEqual({ homeScore: 2, awayScore: 1 });
    expect(item?.draftPrediction).toBeUndefined();
    expect(item?.isDirty).toBe(false);
  });

  it("T3: draft diferente do salvo → currentScores === draftPrediction, isDirty true", () => {
    setupMocks({
      predictions: [makePrediction("m-01", 2, 1)],
      draft: { "m-01": { homeScore: 3, awayScore: 0 } },
    });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 3, awayScore: 0 });
    expect(item?.draftPrediction).toEqual({ homeScore: 3, awayScore: 0 });
    expect(item?.isDirty).toBe(true);
  });

  it("T4: draft igual ao salvo → isDirty false", () => {
    setupMocks({
      predictions: [makePrediction("m-01", 2, 1)],
      draft: { "m-01": { homeScore: 2, awayScore: 1 } },
    });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.isDirty).toBe(false);
  });

  it("T5: draft sem prediction salva → currentScores === draftPrediction, isDirty true", () => {
    setupMocks({
      predictions: [],
      draft: { "m-01": { homeScore: 1, awayScore: 1 } },
    });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 1, awayScore: 1 });
    expect(item?.isDirty).toBe(true);
  });
});

describe("useGroupPredictions — isLocked", () => {
  it("T6: match bloqueado (passado/finished) → isLocked true", () => {
    setupMocks({ matches: [matchLocked] });
    const { result } = renderHook(() => useGroupPredictions("A"));

    const item = result.current.items.find((i) => i.matchId === "m-03");
    expect(item?.isLocked).toBe(true);
  });
});

describe("useGroupPredictions — filledCount", () => {
  it("T7: filledCount conta itens com currentScores (draft ou salvo)", () => {
    setupMocks({
      matches: [matchA, matchB],
      predictions: [makePrediction("m-01", 2, 1)],
      draft: { "m-02": { homeScore: 0, awayScore: 0 } },
    });
    const { result } = renderHook(() => useGroupPredictions("A"));

    // m-01 tem saved, m-02 tem draft → filledCount = 2
    expect(result.current.filledCount).toBe(2);
    expect(result.current.totalCount).toBe(2);
  });
});

describe("useGroupPredictions — isLoading composto", () => {
  it("T8: isLoading true quando qualquer query está carregando", () => {
    setupMocks({ matchesLoading: true });
    const { result } = renderHook(() => useGroupPredictions("A"));
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando predictionsQuery está carregando", () => {
    setupMocks({ predictionsLoading: true });
    const { result } = renderHook(() => useGroupPredictions("A"));
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading true quando teamsQuery está carregando", () => {
    setupMocks({ teamsLoading: true });
    const { result } = renderHook(() => useGroupPredictions("A"));
    expect(result.current.isLoading).toBe(true);
  });
});

describe("useGroupPredictions — uid nulo", () => {
  it("uid null → items vazio, filledCount 0", () => {
    setupMocks({ uid: null });
    const { result } = renderHook(() => useGroupPredictions("A"));
    expect(result.current.items).toEqual([]);
    expect(result.current.filledCount).toBe(0);
  });
});

describe("useGroupPredictions — refetch", () => {
  it("refetch é uma função", () => {
    const { result } = renderHook(() => useGroupPredictions("A"));
    expect(typeof result.current.refetch).toBe("function");
  });
});

describe("useGroupPredictions — setScore (edição ao vivo, BUG round-trip)", () => {
  it("setScore com UM lado (parcial) reflete no currentScores do item", () => {
    // Reproduz o bug: digitar só o mandante deve PERSISTIR no input.
    setupMocks({ predictions: [], draft: {} });
    const { result } = renderHook(() => useGroupPredictions("A"));

    act(() => {
      result.current.setScore("m-01", 2, null);
    });

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 2, awayScore: null });
  });

  it("setScore com par completo persiste no draft (localStorage) e reflete", () => {
    const draftMock = makeDraftMock({});
    mockedUsePredictionDraft.mockReturnValue(draftMock);
    const { result } = renderHook(() => useGroupPredictions("A"));

    act(() => {
      result.current.setScore("m-01", 2, 1);
    });

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 2, awayScore: 1 });
    expect(draftMock.setDraft).toHaveBeenCalledWith("m-01", {
      homeScore: 2,
      awayScore: 1,
    });
  });

  it("buffer de edição tem prioridade sobre o salvo", () => {
    setupMocks({ predictions: [makePrediction("m-01", 0, 0)], draft: {} });
    const { result } = renderHook(() => useGroupPredictions("A"));

    act(() => {
      result.current.setScore("m-01", 5, null);
    });

    const item = result.current.items.find((i) => i.matchId === "m-01");
    expect(item?.currentScores).toEqual({ homeScore: 5, awayScore: null });
  });
});

// Avoid open handles
afterEach(() => {
  act(() => {});
});
