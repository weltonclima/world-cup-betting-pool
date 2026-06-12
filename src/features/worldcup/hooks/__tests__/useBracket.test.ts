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

import type { BracketResponse } from "@/types/worldcup";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/services/worldcup", () => ({
  getGroups: vi.fn(),
  getBracket: vi.fn(),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { getBracket } from "@/services/worldcup";
import { useBracket } from "../useBracket";
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
