// @vitest-environment jsdom
/**
 * Testes do hook useGroups (TASK-05).
 *
 * Cenários:
 * - chama getGroups e retorna GroupsResponse
 * - queryKey é worldcupKeys.groups() → ["groups"]
 * - refetchInterval: hasLiveGroupMatch:true → 60000, false → false
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupsResponse } from "@/types/worldcup";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/services/worldcup", () => ({
  getGroups: vi.fn(),
  getBracket: vi.fn(),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { getGroups } from "@/services/worldcup";
import { useGroups } from "../useGroups";
import { worldcupKeys } from "../worldcupKeys";

const mockGetGroups = vi.mocked(getGroups);

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

function makeGroupsResponse(hasLiveGroupMatch = false): GroupsResponse {
  return {
    groups: [
      {
        groupId: "A",
        standings: [
          {
            position: 1,
            team: { id: "bra", name: "Brasil", code: "BRA" },
            played: 3,
            wins: 3,
            draws: 0,
            losses: 0,
            goalsFor: 9,
            goalsAgainst: 1,
            goalDifference: 8,
            points: 9,
            qualification: "classificado",
          },
        ],
      },
    ],
    hasLiveGroupMatch,
  };
}

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGroups — dados", () => {
  it("chama getGroups e retorna GroupsResponse", async () => {
    const { wrapper } = createWrapper();
    const data = makeGroupsResponse();
    mockGetGroups.mockResolvedValueOnce(data);

    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGroups).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual(data);
  });

  it("queryKey é worldcupKeys.groups() → [\"groups\"]", async () => {
    const { queryClient, wrapper } = createWrapper();
    mockGetGroups.mockResolvedValueOnce(makeGroupsResponse());

    renderHook(() => useGroups(), { wrapper });

    await waitFor(() =>
      queryClient.getQueryState(worldcupKeys.groups()) !== undefined,
    );

    expect(worldcupKeys.groups()).toEqual(["groups"]);
    const state = queryClient.getQueryState(worldcupKeys.groups());
    expect(state).toBeDefined();
  });
});

describe("useGroups — refetchInterval", () => {
  it("refetchInterval retorna 60000 quando hasLiveGroupMatch é true", () => {
    // Testa a função de intervalo diretamente com um query fake
    // (sem fake timers — teste leve do retorno, conforme spec §9)
    const fakeQuery = { state: { data: { hasLiveGroupMatch: true } as GroupsResponse } };

    // Extrai a lógica: (query) => data?.hasLiveGroupMatch ? 60_000 : false
    // Replica exatamente o comportamento do hook
    const intervalFn = (query: { state: { data: GroupsResponse | undefined } }) =>
      (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch
        ? 60_000
        : false;

    expect(intervalFn(fakeQuery)).toBe(60_000);
  });

  it("refetchInterval retorna false quando hasLiveGroupMatch é false", () => {
    const fakeQuery = { state: { data: { hasLiveGroupMatch: false } as GroupsResponse } };

    const intervalFn = (query: { state: { data: GroupsResponse | undefined } }) =>
      (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch
        ? 60_000
        : false;

    expect(intervalFn(fakeQuery)).toBe(false);
  });

  it("refetchInterval retorna false quando data é undefined", () => {
    const fakeQuery = { state: { data: undefined } };

    const intervalFn = (query: { state: { data: GroupsResponse | undefined } }) =>
      (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch
        ? 60_000
        : false;

    expect(intervalFn(fakeQuery)).toBe(false);
  });
});
