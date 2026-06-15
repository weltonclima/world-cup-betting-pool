// @vitest-environment jsdom
/**
 * Testes de integração do hook compositor useProfilePredictions (PRD-14 / TASK-03).
 *
 * Cenários:
 * T-01  isSelf=true  → listPredictionsByUid chamado, getOtherUserPredictions NÃO
 * T-02  isSelf=false → getOtherUserPredictions chamado, listPredictionsByUid NÃO
 * T-03  join produz ProfilePredictionItem com todos os campos corretos
 * T-04  prediction com matchId órfão (sem match) é descartada
 * T-05  actualScore=null para jogo não-finished
 * T-06  actualScore preenchido para jogo finished
 * T-07  uid=undefined → items=[], query desabilitada (sem chamada de serviço)
 * T-08  isSelf=false, serviço rejeita → isError=true
 * T-09  displayStatus="acertou" para placar exato
 * T-10  groupId=null preservado para jogo de eliminatória
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import type { MatchWithId, Prediction, TeamWithId } from "@/types";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/firebase", () => ({ firebaseAuth: {}, firestore: {} }));

vi.mock("@/services", () => ({
  listPredictionsByUid: vi.fn(),
  getOtherUserPredictions: vi.fn(),
}));

vi.mock("@/features/matches/hooks", () => ({
  useMatches: vi.fn(),
  useTeams: vi.fn(),
}));

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { listPredictionsByUid, getOtherUserPredictions } from "@/services";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { useProfilePredictions } from "../useProfilePredictions";

// ── helpers tipados ──────────────────────────────────────────────────────────

const mockListPredictionsByUid    = vi.mocked(listPredictionsByUid);
const mockGetOtherUserPredictions = vi.mocked(getOtherUserPredictions);
const mockUseMatches              = vi.mocked(useMatches);
const mockUseTeams                = vi.mocked(useTeams);

function fakeQuery<T>(overrides: {
  data?: T;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => Promise<unknown>;
}): UseQueryResult<T> {
  return {
    data: overrides.data,
    isLoading: overrides.isLoading ?? false,
    isError:   overrides.isError   ?? false,
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

function makeTeam(id: string, name = `Seleção ${id}`): TeamWithId {
  return { id, name, code: id.toUpperCase().slice(0, 3), flagUrl: `https://flags/${id}.png` };
}

function makeMatch(id: string, overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
    ...overrides,
  };
}

function makePrediction(matchId: string, overrides: Partial<Prediction> = {}): Prediction {
  return { uid: "user-01", matchId, homeScore: 1, awayScore: 0, ...overrides };
}

// ── wrapper com QueryClient fresco por teste ─────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── setup de mocks de hooks globais ─────────────────────────────────────────

function setupGlobalMocks({
  matchesData = [] as MatchWithId[],
  teamsData   = [makeTeam("t-home"), makeTeam("t-away")] as TeamWithId[],
  matchesLoading = false,
  teamsLoading   = false,
  matchesError   = false,
  teamsError     = false,
} = {}) {
  mockUseMatches.mockReturnValue(
    fakeQuery({ data: matchesData, isLoading: matchesLoading, isError: matchesError }),
  );
  mockUseTeams.mockReturnValue(
    fakeQuery({ data: teamsData, isLoading: teamsLoading, isError: teamsError }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── T-01/T-02 — bifurcação de fonte por contexto ────────────────────────────

describe("useProfilePredictions — bifurcação de fonte (T-01, T-02)", () => {
  it("T-01: isSelf=true chama listPredictionsByUid, NÃO getOtherUserPredictions", async () => {
    mockListPredictionsByUid.mockResolvedValue([]);
    setupGlobalMocks();
    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListPredictionsByUid).toHaveBeenCalledWith("user-01");
    expect(mockGetOtherUserPredictions).not.toHaveBeenCalled();
  });

  it("T-02: isSelf=false chama getOtherUserPredictions, NÃO listPredictionsByUid", async () => {
    mockGetOtherUserPredictions.mockResolvedValue([]);
    setupGlobalMocks();
    const { result } = renderHook(
      () => useProfilePredictions("user-02", false),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetOtherUserPredictions).toHaveBeenCalledWith("user-02");
    expect(mockListPredictionsByUid).not.toHaveBeenCalled();
  });
});

// ── T-03 — join correto com todos os campos ──────────────────────────────────

describe("useProfilePredictions — join e campos (T-03)", () => {
  it("T-03: join produz ProfilePredictionItem com todos os campos corretos", async () => {
    const match = makeMatch("m1", {
      homeTeamId: "t-home",
      awayTeamId: "t-away",
      stage: "grupos",
      groupId: "group-b",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      kickoffAt: "2026-06-20T18:00:00.000Z",
    });
    const prediction = makePrediction("m1", { homeScore: 1, awayScore: 0 });
    mockListPredictionsByUid.mockResolvedValue([prediction]);
    setupGlobalMocks({
      matchesData: [match],
      teamsData: [makeTeam("t-home", "Brasil"), makeTeam("t-away", "Argentina")],
    });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    const item = result.current.items[0]!;
    expect(item.matchId).toBe("m1");
    expect(item.kickoffAt).toBe("2026-06-20T18:00:00.000Z");
    expect(item.stage).toBe("grupos");
    expect(item.groupId).toBe("group-b");
    expect(item.homeTeam).toEqual({ id: "t-home", name: "Brasil", flagUrl: "https://flags/t-home.png" });
    expect(item.awayTeam).toEqual({ id: "t-away", name: "Argentina", flagUrl: "https://flags/t-away.png" });
    expect(item.prediction).toEqual({ homeScore: 1, awayScore: 0 });
    expect(item.actualScore).toEqual({ homeScore: 2, awayScore: 1 });
    expect(item.matchStatus).toBe("finished");
    // displayStatus derivado: palpite 1-0, placar real 2-1 → acertou vencedor
    expect(item.displayStatus).toBe("acertou_vencedor");
  });
});

// ── T-04 — prediction órfã descartada ───────────────────────────────────────

describe("useProfilePredictions — match órfão (T-04)", () => {
  it("T-04: prediction com matchId sem match correspondente é descartada", async () => {
    const match = makeMatch("m1");
    const p1 = makePrediction("m1");
    const pOrfao = makePrediction("m-nao-existe");
    mockListPredictionsByUid.mockResolvedValue([p1, pOrfao]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.matchId).toBe("m1");
  });
});

// ── T-05/T-06 — actualScore ──────────────────────────────────────────────────

describe("useProfilePredictions — actualScore (T-05, T-06)", () => {
  it("T-05: actualScore=null para jogo com status 'scheduled'", async () => {
    const match = makeMatch("m1", { status: "scheduled", homeScore: null, awayScore: null });
    mockListPredictionsByUid.mockResolvedValue([makePrediction("m1")]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.actualScore).toBeNull();
  });

  it("T-05b: actualScore=null para jogo com status 'live'", async () => {
    const match = makeMatch("m1", { status: "live", homeScore: 1, awayScore: 0 });
    mockListPredictionsByUid.mockResolvedValue([makePrediction("m1")]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.actualScore).toBeNull();
  });

  it("T-06: actualScore preenchido para jogo 'finished'", async () => {
    const match = makeMatch("m1", { status: "finished", homeScore: 3, awayScore: 0 });
    mockListPredictionsByUid.mockResolvedValue([makePrediction("m1")]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.actualScore).toEqual({ homeScore: 3, awayScore: 0 });
  });
});

// ── T-07 — uid=undefined → query desabilitada ────────────────────────────────

describe("useProfilePredictions — uid ausente (T-07)", () => {
  it("T-07: uid=undefined → items=[], isLoading=false, nenhum serviço chamado", () => {
    setupGlobalMocks();

    const { result } = renderHook(
      () => useProfilePredictions(undefined, true),
      { wrapper: createWrapper() },
    );

    // Query desabilitada: sem fetch, resultado síncrono
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockListPredictionsByUid).not.toHaveBeenCalled();
    expect(mockGetOtherUserPredictions).not.toHaveBeenCalled();
  });
});

// ── T-08 — erro de serviço → isError=true ────────────────────────────────────

describe("useProfilePredictions — erro HTTP (T-08)", () => {
  it("T-08: isSelf=false, getOtherUserPredictions rejeita → isError=true", async () => {
    mockGetOtherUserPredictions.mockRejectedValue(new Error("401 Não autenticado"));
    setupGlobalMocks();

    const { result } = renderHook(
      () => useProfilePredictions("user-02", false),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.items).toEqual([]);
  });
});

// ── T-09 — displayStatus correto ─────────────────────────────────────────────

describe("useProfilePredictions — displayStatus (T-09)", () => {
  it("T-09: placar exato → displayStatus='acertou'", async () => {
    const match = makeMatch("m1", { status: "finished", homeScore: 2, awayScore: 1 });
    // Palpite exato: 2-1 = 2-1
    const prediction = makePrediction("m1", { homeScore: 2, awayScore: 1 });
    mockListPredictionsByUid.mockResolvedValue([prediction]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.displayStatus).toBe("acertou");
  });

  it("T-09b: palpite errado → displayStatus='errou'", async () => {
    const match = makeMatch("m1", { status: "finished", homeScore: 2, awayScore: 0 });
    // Palpite: 0-1 (errou vencedor e placar)
    const prediction = makePrediction("m1", { homeScore: 0, awayScore: 1 });
    mockListPredictionsByUid.mockResolvedValue([prediction]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.displayStatus).toBe("errou");
  });
});

// ── T-10 — groupId=null para eliminatória ────────────────────────────────────

describe("useProfilePredictions — groupId null (T-10)", () => {
  it("T-10: match de eliminatória com groupId=null → item.groupId=null", async () => {
    const match = makeMatch("m1", { stage: "oitavas", groupId: null });
    mockListPredictionsByUid.mockResolvedValue([makePrediction("m1")]);
    setupGlobalMocks({ matchesData: [match] });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]!.groupId).toBeNull();
    expect(result.current.items[0]!.stage).toBe("oitavas");
  });
});

// ── estado agregado de loading/error ─────────────────────────────────────────

describe("useProfilePredictions — estado agregado", () => {
  it("isLoading=true quando useMatches está carregando", async () => {
    mockListPredictionsByUid.mockResolvedValue([]);
    setupGlobalMocks({ matchesLoading: true });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading=true quando useTeams está carregando", async () => {
    mockListPredictionsByUid.mockResolvedValue([]);
    setupGlobalMocks({ teamsLoading: true });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("isError=true quando useMatches falha", async () => {
    mockListPredictionsByUid.mockResolvedValue([]);
    setupGlobalMocks({ matchesError: true });

    const { result } = renderHook(
      () => useProfilePredictions("user-01", true),
      { wrapper: createWrapper() },
    );
    expect(result.current.isError).toBe(true);
  });
});
