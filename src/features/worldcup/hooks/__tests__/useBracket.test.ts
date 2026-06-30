// @vitest-environment jsdom
/**
 * Testes do hook useBracket (TASK-05).
 *
 * Cenários:
 * - chama getBracket e retorna BracketResponse
 * - queryKey é worldcupKeys.bracket() → ["bracket"]
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BracketResponse, KnockoutMatch } from "@/types/worldcup";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/services/worldcup", () => ({
  getGroups: vi.fn(),
  getBracket: vi.fn(),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { getBracket } from "@/services/worldcup";
import { bracketHasLiveOrDueMatch, useBracket } from "../useBracket";
import { worldcupKeys } from "../worldcupKeys";

const mockGetBracket = vi.mocked(getBracket);

// ── factory de wrapper QueryClient ───────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeBracketResponse(): BracketResponse {
  return {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };
}

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBracket — dados", () => {
  it("chama getBracket e retorna BracketResponse", async () => {
    const { wrapper } = createWrapper();
    const data = makeBracketResponse();
    mockGetBracket.mockResolvedValueOnce(data);

    const { result } = renderHook(() => useBracket(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetBracket).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual(data);
  });

  it("queryKey é worldcupKeys.bracket() → [\"worldcup\", \"bracket\"]", async () => {
    const { queryClient, wrapper } = createWrapper();
    mockGetBracket.mockResolvedValueOnce(makeBracketResponse());

    renderHook(() => useBracket(), { wrapper });

    await waitFor(() =>
      queryClient.getQueryState(worldcupKeys.bracket()) !== undefined,
    );

    expect(worldcupKeys.bracket()).toEqual(["worldcup", "bracket"]);
    const state = queryClient.getQueryState(worldcupKeys.bracket());
    expect(state).toBeDefined();
  });

  it("BracketResponse contém os 6 buckets esperados", async () => {
    const { wrapper } = createWrapper();
    mockGetBracket.mockResolvedValueOnce(makeBracketResponse());

    const { result } = renderHook(() => useBracket(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toHaveProperty("roundOf32");
    expect(data).toHaveProperty("roundOf16");
    expect(data).toHaveProperty("quarterFinals");
    expect(data).toHaveProperty("semiFinals");
    expect(data).toHaveProperty("thirdPlace");
    expect(data).toHaveProperty("final");
  });
});

// ── gatilho de polling ao vivo (fix placar ao vivo no chaveamento) ──────────────

const NOW = Date.parse("2026-06-30T18:00:00Z");
const PAST = "2026-06-30T17:30:00Z"; // kickoff já passou
const FUTURE = "2026-06-30T18:30:00Z"; // kickoff ainda no futuro

function makeMatch(overrides: Partial<KnockoutMatch> = {}): KnockoutMatch {
  return {
    id: "m1",
    phase: "oitavas",
    homeTeam: { name: "Brasil", defined: true },
    awayTeam: { name: "Argentina", defined: true },
    status: "definido",
    ...overrides,
  };
}

function bracketWith(matches: KnockoutMatch[], bucket: keyof BracketResponse = "roundOf16"): BracketResponse {
  return { ...makeBracketResponse(), [bucket]: matches };
}

describe("bracketHasLiveOrDueMatch — gatilho de refetch", () => {
  it("data undefined → false", () => {
    expect(bracketHasLiveOrDueMatch(undefined, NOW)).toBe(false);
  });

  it("bracket vazio → false", () => {
    expect(bracketHasLiveOrDueMatch(makeBracketResponse(), NOW)).toBe(false);
  });

  it("confronto em-andamento → true (placar ao vivo muda)", () => {
    const live = makeMatch({
      status: "em-andamento",
      homeScore: 1,
      awayScore: 0,
      kickoffAt: PAST,
    });
    expect(bracketHasLiveOrDueMatch(bracketWith([live]), NOW)).toBe(true);
  });

  it("em-andamento em qualquer bucket é detectado (achata os 6) → true", () => {
    const live = makeMatch({
      id: "f1",
      phase: "final",
      status: "em-andamento",
      homeScore: 0,
      awayScore: 0,
      kickoffAt: PAST,
    });
    expect(bracketHasLiveOrDueMatch(bracketWith([live], "final"), NOW)).toBe(true);
  });

  it("definido com kickoff já passado → true (transição definido→ao-vivo)", () => {
    const due = makeMatch({ status: "definido", kickoffAt: PAST });
    expect(bracketHasLiveOrDueMatch(bracketWith([due]), NOW)).toBe(true);
  });

  it("definido com kickoff no futuro → false", () => {
    const upcoming = makeMatch({ status: "definido", kickoffAt: FUTURE });
    expect(bracketHasLiveOrDueMatch(bracketWith([upcoming]), NOW)).toBe(false);
  });

  it("definido sem kickoffAt → false", () => {
    const noKickoff = makeMatch({ status: "definido", kickoffAt: undefined });
    expect(bracketHasLiveOrDueMatch(bracketWith([noKickoff]), NOW)).toBe(false);
  });

  it("aguardando → false (não dispara poll)", () => {
    const waiting = makeMatch({
      status: "aguardando",
      homeTeam: { name: "Vencedor Jogo 1", defined: false },
    });
    expect(bracketHasLiveOrDueMatch(bracketWith([waiting]), NOW)).toBe(false);
  });

  it("encerrado mesmo com kickoff passado → false (estado estável)", () => {
    const finished = makeMatch({
      status: "encerrado",
      homeScore: 2,
      awayScore: 1,
      kickoffAt: PAST,
    });
    expect(bracketHasLiveOrDueMatch(bracketWith([finished]), NOW)).toBe(false);
  });
});
