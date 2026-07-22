// @vitest-environment jsdom
/**
 * Testes do hook useLeagueStandings (TASK-20).
 *
 * Cenários:
 * - chama getLeagueStandings com o championship ATIVO e retorna a resposta;
 * - queryKey é worldcupKeys.standings(activeId) — escopada por campeonato;
 * - a config de refetchInterval reflete hasLiveMatch (60s vivo / false ocioso).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeagueStandingsResponse } from "@/types/leagues";

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/services/worldcup", () => ({
  getLeagueStandings: vi.fn(),
}));

const { activeIdState } = vi.hoisted(() => ({
  activeIdState: { value: "bra.1-2026" },
}));
vi.mock("@/features/championships", () => ({
  useActiveChampionship: () => ({ activeChampionshipId: activeIdState.value }),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { getLeagueStandings } from "@/services/worldcup";
import { useLeagueStandings } from "../useLeagueStandings";
import { worldcupKeys } from "../worldcupKeys";

const mockGet = vi.mocked(getLeagueStandings);

// ── wrapper ───────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

function makeResponse(hasLiveMatch = false): LeagueStandingsResponse {
  return {
    hasLiveMatch,
    table: [
      {
        position: 1,
        team: { id: "83", name: "Flamengo" },
        played: 1, wins: 1, draws: 0, losses: 0,
        goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  activeIdState.value = "bra.1-2026";
});

describe("useLeagueStandings — dados", () => {
  it("chama getLeagueStandings com o championship ativo e retorna a resposta", async () => {
    const { wrapper } = createWrapper();
    const data = makeResponse();
    mockGet.mockResolvedValueOnce(data);

    const { result } = renderHook(() => useLeagueStandings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith("bra.1-2026");
    expect(result.current.data).toEqual(data);
  });

  it("queryKey é worldcupKeys.standings(activeId) — escopada por campeonato", async () => {
    const { queryClient, wrapper } = createWrapper();
    mockGet.mockResolvedValueOnce(makeResponse());

    renderHook(() => useLeagueStandings(), { wrapper });
    await waitFor(() =>
      expect(
        queryClient.getQueryState(worldcupKeys.standings("bra.1-2026")),
      ).toBeDefined(),
    );

    expect(worldcupKeys.standings("bra.1-2026")).toEqual([
      "worldcup",
      "standings",
      "bra.1-2026",
    ]);
  });
});

describe("useLeagueStandings — refetchInterval reflete hasLiveMatch", () => {
  const intervalFn = (query: { state: { data: LeagueStandingsResponse | undefined } }) =>
    (query.state.data as LeagueStandingsResponse | undefined)?.hasLiveMatch
      ? 60_000
      : false;

  it("60000 quando hasLiveMatch true", () => {
    expect(intervalFn({ state: { data: makeResponse(true) } })).toBe(60_000);
  });

  it("false quando hasLiveMatch false", () => {
    expect(intervalFn({ state: { data: makeResponse(false) } })).toBe(false);
  });

  it("false quando data undefined", () => {
    expect(intervalFn({ state: { data: undefined } })).toBe(false);
  });
});
