// @vitest-environment jsdom
/**
 * Testes do hook usePredictionsList (TASK-08).
 *
 * Cenários:
 * - uid=null → items: [], estado neutro sem disparar join
 * - join inclui APENAS jogos COM palpite do usuário
 * - itens ordenados por kickoffAt ASC
 * - derivePredictionDisplayStatus aplicado por item
 * - isLoading/isError compostos (qualquer query em loading/error)
 * - nomes/bandeiras resolvidos via teamMap
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import type { Prediction, MatchWithId, TeamWithId } from "@/types";
import type { PredictionListItem } from "../usePredictionsList";

// ── mocks declarados antes dos imports do módulo (hoisting) ──────────────────

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

vi.mock("@/features/predictions/hooks/usePredictions");
vi.mock("@/features/matches/hooks/useMatches");
vi.mock("@/features/matches/hooks/useTeams");

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
import { usePredictions } from "@/features/predictions/hooks/usePredictions";
import { useMatches } from "@/features/matches/hooks/useMatches";
import { useTeams } from "@/features/matches/hooks/useTeams";
import { usePredictionsList } from "../usePredictionsList";

// ── typed mocks ───────────────────────────────────────────────────────────────

const mockedUseAuth = vi.mocked(useAuth);
const mockedUsePredictions = vi.mocked(usePredictions);
const mockedUseMatches = vi.mocked(useMatches);
const mockedUseTeams = vi.mocked(useTeams);

// ── helpers de query ──────────────────────────────────────────────────────────

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

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeMatch(id: string, overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    kickoffAt: "2026-06-14T16:00:00Z",
    homeTeamId: "team-bra",
    awayTeamId: "team-fra",
    stage: "grupos",
    round: 1,
    groupId: "Grupo C",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    venue: { name: "Estádio", city: "Cidade" },
    ...overrides,
  };
}

function makeTeam(id: string, name: string, flagUrl?: string): TeamWithId {
  return { id, name, flagUrl, country: name, flag: flagUrl ?? "" } as unknown as TeamWithId;
}

function makePrediction(matchId: string, overrides: Partial<Prediction> = {}): Prediction {
  return {
    uid: "user-01",
    matchId,
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

const teamBra = makeTeam("team-bra", "Brasil", "https://example.com/br.png");
const teamFra = makeTeam("team-fra", "França", "https://example.com/fr.png");
const teamArg = makeTeam("team-arg", "Argentina");

const matchEarly = makeMatch("match-001", { kickoffAt: "2026-06-14T14:00:00Z" });
const matchLate = makeMatch("match-002", {
  kickoffAt: "2026-06-14T20:00:00Z",
  homeTeamId: "team-arg",
  awayTeamId: "team-fra",
});
const matchNoPrediction = makeMatch("match-003", { kickoffAt: "2026-06-15T16:00:00Z" });

// ── setup padrão ──────────────────────────────────────────────────────────────

function setupDefaultMocks(overrides: {
  uid?: string | null;
  predictions?: Prediction[];
  matches?: MatchWithId[];
  teams?: TeamWithId[];
  predictionsLoading?: boolean;
  matchesLoading?: boolean;
  teamsLoading?: boolean;
  predictionsError?: boolean;
  matchesError?: boolean;
  teamsError?: boolean;
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

  const predictions = overrides.predictions ?? [makePrediction("match-001")];
  const matches = overrides.matches ?? [matchEarly, matchLate, matchNoPrediction];
  const teams = overrides.teams ?? [teamBra, teamFra];

  mockedUsePredictions.mockReturnValue(
    makeQueryResult<Prediction[]>(predictions, {
      isLoading: overrides.predictionsLoading,
      isError: overrides.predictionsError,
    }),
  );
  mockedUseMatches.mockReturnValue(
    makeQueryResult<MatchWithId[]>(matches, {
      isLoading: overrides.matchesLoading,
      isError: overrides.matchesError,
    }),
  );
  mockedUseTeams.mockReturnValue(
    makeQueryResult<TeamWithId[]>(teams, {
      isLoading: overrides.teamsLoading,
      isError: overrides.teamsError,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ── testes ────────────────────────────────────────────────────────────────────

describe("usePredictionsList — uid nulo", () => {
  it("T1: retorna items=[] quando uid é null", () => {
    setupDefaultMocks({ uid: null });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items).toEqual([]);
  });

  it("T2: isLoading reflete estado das queries mesmo com uid null", () => {
    setupDefaultMocks({ uid: null, matchesLoading: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isLoading).toBe(true);
  });
});

describe("usePredictionsList — join e filtro", () => {
  it("T3: inclui apenas jogos COM palpite do usuário", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly, matchLate, matchNoPrediction],
    });
    const { result } = renderHook(() => usePredictionsList());
    // match-001 tem palpite, match-002 e match-003 não
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.matchId).toBe("match-001");
  });

  it("T4: não inclui jogos SEM palpite do usuário", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly, matchLate, matchNoPrediction],
    });
    const { result } = renderHook(() => usePredictionsList());
    const ids = result.current.items.map((i) => i.matchId);
    expect(ids).not.toContain("match-002");
    expect(ids).not.toContain("match-003");
  });

  it("T5: inclui múltiplos jogos quando cada um tem palpite", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001"), makePrediction("match-002")],
      matches: [matchEarly, matchLate, matchNoPrediction],
      teams: [teamBra, teamFra, teamArg],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items).toHaveLength(2);
  });

  it("T6: retorna items=[] quando não há palpites", () => {
    setupDefaultMocks({
      predictions: [],
      matches: [matchEarly, matchLate],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items).toEqual([]);
  });
});

describe("usePredictionsList — ordenação por kickoffAt ASC", () => {
  it("T7: ordena itens por kickoffAt crescente (mais cedo primeiro)", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001"), makePrediction("match-002")],
      matches: [matchLate, matchEarly], // propositalmente invertido
      teams: [teamBra, teamFra, teamArg],
    });
    const { result } = renderHook(() => usePredictionsList());
    const ids = result.current.items.map((i) => i.matchId);
    expect(ids).toEqual(["match-001", "match-002"]); // match-001 tem kickoff mais cedo
  });
});

describe("usePredictionsList — derivação de displayStatus", () => {
  it("T8: match scheduled no futuro → displayStatus='pendente'", () => {
    const futureMatch = makeMatch("match-001", {
      kickoffAt: "2099-01-01T00:00:00Z",
      status: "scheduled",
    });
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [futureMatch],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.displayStatus).toBe("pendente");
  });

  it("T9: match finished com acerto → displayStatus='acertou'", () => {
    const finishedMatch = makeMatch("match-001", {
      kickoffAt: "2026-01-01T00:00:00Z",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    });
    setupDefaultMocks({
      predictions: [makePrediction("match-001", { homeScore: 2, awayScore: 1 })],
      matches: [finishedMatch],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.displayStatus).toBe("acertou");
  });

  it("T10: match finished com vencedor errado → displayStatus='errou'", () => {
    // Palpite 2×1 (mandante vence) mas jogo 0×3 (visitante vence) → vencedor errado.
    const finishedMatch = makeMatch("match-001", {
      kickoffAt: "2026-01-01T00:00:00Z",
      status: "finished",
      homeScore: 0,
      awayScore: 3,
    });
    setupDefaultMocks({
      predictions: [makePrediction("match-001", { homeScore: 2, awayScore: 1 })],
      matches: [finishedMatch],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.displayStatus).toBe("errou");
  });

  it("T10b: match finished com vencedor certo e placar errado → displayStatus='acertou_vencedor'", () => {
    // Palpite 2×1 (mandante vence) e jogo 3×0 (mandante vence) → +5 (TASK-04).
    const finishedMatch = makeMatch("match-001", {
      kickoffAt: "2026-01-01T00:00:00Z",
      status: "finished",
      homeScore: 3,
      awayScore: 0,
    });
    setupDefaultMocks({
      predictions: [makePrediction("match-001", { homeScore: 2, awayScore: 1 })],
      matches: [finishedMatch],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.displayStatus).toBe("acertou_vencedor");
  });

  it("T11: match não scheduled e antes de terminar → displayStatus='bloqueado'", () => {
    const liveMatch = makeMatch("match-001", {
      kickoffAt: "2026-01-01T00:00:00Z",
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });
    setupDefaultMocks({
      predictions: [makePrediction("match-001", { homeScore: 2, awayScore: 1 })],
      matches: [liveMatch],
    });
    const { result } = renderHook(() => usePredictionsList());
    // live não é "finished" então não avalia acertou/errou, mas é locked
    expect(result.current.items[0]!.displayStatus).toBe("bloqueado");
  });
});

describe("usePredictionsList — isLoading composto", () => {
  it("T12: isLoading=true quando predictionsQuery está carregando", () => {
    setupDefaultMocks({ predictionsLoading: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isLoading).toBe(true);
  });

  it("T13: isLoading=true quando matchesQuery está carregando", () => {
    setupDefaultMocks({ matchesLoading: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isLoading).toBe(true);
  });

  it("T14: isLoading=true quando teamsQuery está carregando", () => {
    setupDefaultMocks({ teamsLoading: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isLoading).toBe(true);
  });

  it("T15: isLoading=false quando todas as queries têm dados", () => {
    setupDefaultMocks();
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("usePredictionsList — isError composto", () => {
  it("T16: isError=true quando predictionsQuery tem erro", () => {
    setupDefaultMocks({ predictionsError: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isError).toBe(true);
  });

  it("T17: isError=true quando matchesQuery tem erro", () => {
    setupDefaultMocks({ matchesError: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isError).toBe(true);
  });

  it("T18: isError=true quando teamsQuery tem erro", () => {
    setupDefaultMocks({ teamsError: true });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isError).toBe(true);
  });

  it("T19: isError=false quando todas as queries têm sucesso", () => {
    setupDefaultMocks();
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.isError).toBe(false);
  });
});

describe("usePredictionsList — resolução de nomes e bandeiras via teamMap", () => {
  it("T20: homeTeam.name resolvido corretamente via teamMap", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly],
      teams: [teamBra, teamFra],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.homeTeam.name).toBe("Brasil");
  });

  it("T21: awayTeam.name resolvido corretamente via teamMap", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly],
      teams: [teamBra, teamFra],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.awayTeam.name).toBe("França");
  });

  it("T22: homeTeam.flagUrl resolvido corretamente", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly],
      teams: [teamBra, teamFra],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.homeTeam.flagUrl).toBe("https://example.com/br.png");
  });

  it("T23: fallback para teamId quando time não está no teamMap", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly],
      teams: [], // teamMap vazio — nenhum time resolvido
    });
    const { result } = renderHook(() => usePredictionsList());
    // resolveTeam retorna name = teamId quando não encontra
    expect(result.current.items[0]!.homeTeam.name).toBe("team-bra");
    expect(result.current.items[0]!.homeTeam.flagUrl).toBeUndefined();
  });

  it("T24: prediction.homeScore e awayScore preservados no item", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001", { homeScore: 3, awayScore: 0 })],
      matches: [matchEarly],
      teams: [teamBra, teamFra],
    });
    const { result } = renderHook(() => usePredictionsList());
    expect(result.current.items[0]!.prediction.homeScore).toBe(3);
    expect(result.current.items[0]!.prediction.awayScore).toBe(0);
  });
});

describe("usePredictionsList — refetch", () => {
  it("T25: refetch é uma função chamável", () => {
    const { result } = renderHook(() => usePredictionsList());
    expect(typeof result.current.refetch).toBe("function");
  });

  it("T26: refetch chama refetch das três queries", () => {
    const predictionsRefetch = vi.fn().mockResolvedValue(undefined);
    const matchesRefetch = vi.fn().mockResolvedValue(undefined);
    const teamsRefetch = vi.fn().mockResolvedValue(undefined);

    mockedUsePredictions.mockReturnValue({
      ...makeQueryResult<Prediction[]>([]),
      refetch: predictionsRefetch,
    } as unknown as UseQueryResult<Prediction[]>);

    mockedUseMatches.mockReturnValue({
      ...makeQueryResult<MatchWithId[]>([]),
      refetch: matchesRefetch,
    } as unknown as UseQueryResult<MatchWithId[]>);

    mockedUseTeams.mockReturnValue({
      ...makeQueryResult<TeamWithId[]>([]),
      refetch: teamsRefetch,
    } as unknown as UseQueryResult<TeamWithId[]>);

    const { result } = renderHook(() => usePredictionsList());
    result.current.refetch();

    expect(predictionsRefetch).toHaveBeenCalledTimes(1);
    expect(matchesRefetch).toHaveBeenCalledTimes(1);
    expect(teamsRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("usePredictionsList — tipos exportados", () => {
  it("T27: item retornado possui todas as propriedades de PredictionListItem", () => {
    setupDefaultMocks({
      predictions: [makePrediction("match-001")],
      matches: [matchEarly],
      teams: [teamBra, teamFra],
    });
    const { result } = renderHook(() => usePredictionsList());
    const item: PredictionListItem = result.current.items[0]!;
    expect(item).toHaveProperty("matchId");
    expect(item).toHaveProperty("kickoffAt");
    expect(item).toHaveProperty("homeTeam");
    expect(item).toHaveProperty("awayTeam");
    expect(item).toHaveProperty("prediction");
    expect(item).toHaveProperty("displayStatus");
  });
});
