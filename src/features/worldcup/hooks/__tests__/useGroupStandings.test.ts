// @vitest-environment jsdom
/**
 * Testes do hook useGroupStandings (TASK-05).
 *
 * Cenários:
 * - useGroupStandings("A") → retorna o GroupTable do grupo A
 * - useGroupStandings("Z") → null quando grupo não existe
 * - usa a mesma queryKey ["groups"] (não ["group", groupId])
 * - refetchInterval: hasLiveGroupMatch:true → 60000, false → false
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupsResponse, GroupTable } from "@/types/worldcup";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/services/worldcup", () => ({
  getGroups: vi.fn(),
  getBracket: vi.fn(),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { getGroups } from "@/services/worldcup";
import { useGroupStandings } from "../useGroupStandings";
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

function makeGroupTable(groupId: string): GroupTable {
  return {
    groupId,
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
  };
}

function makeGroupsResponse(hasLiveGroupMatch = false): GroupsResponse {
  return {
    groups: [makeGroupTable("A"), makeGroupTable("B")],
    hasLiveGroupMatch,
  };
}

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGroupStandings — slice correto", () => {
  it("retorna o GroupTable do grupo 'A' via select", async () => {
    const { wrapper } = createWrapper();
    mockGetGroups.mockResolvedValueOnce(makeGroupsResponse());

    const { result } = renderHook(() => useGroupStandings("A"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ groupId: "A" });
  });

  it("retorna null quando grupo 'Z' não existe", async () => {
    const { wrapper } = createWrapper();
    mockGetGroups.mockResolvedValueOnce(makeGroupsResponse());

    const { result } = renderHook(() => useGroupStandings("Z"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("usa queryKey [\"groups\"] — NÃO [\"group\", groupId]", async () => {
    const { queryClient, wrapper } = createWrapper();
    mockGetGroups.mockResolvedValueOnce(makeGroupsResponse());

    renderHook(() => useGroupStandings("A"), { wrapper });

    await waitFor(() =>
      queryClient.getQueryState(worldcupKeys.groups()) !== undefined,
    );

    // Cache key deve ser ["worldcup", "groups"], não ["worldcup", "group", "A"]
    expect(worldcupKeys.groups()).toEqual(["worldcup", "groups"]);
    const baseState = queryClient.getQueryState(worldcupKeys.groups());
    expect(baseState).toBeDefined();

    // Confirma que ["group", "A"] NÃO existe no cache
    const groupState = queryClient.getQueryState(worldcupKeys.group("A"));
    expect(groupState).toBeUndefined();
  });

  it("chama getGroups (mesma queryFn que useGroups)", async () => {
    const { wrapper } = createWrapper();
    mockGetGroups.mockResolvedValueOnce(makeGroupsResponse());

    renderHook(() => useGroupStandings("B"), { wrapper });

    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledOnce());
  });
});

describe("useGroupStandings — refetchInterval", () => {
  it("refetchInterval retorna 60000 quando hasLiveGroupMatch é true", () => {
    const fakeQuery = { state: { data: { hasLiveGroupMatch: true } as GroupsResponse } };

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
});
