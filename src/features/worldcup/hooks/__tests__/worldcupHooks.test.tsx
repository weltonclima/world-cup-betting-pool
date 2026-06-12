// @vitest-environment jsdom
/**
 * Testes dos hooks da feature worldcup (grupos-eliminatorias, TASK-05).
 *
 * Mockam a camada de serviço (`@/services/worldcup`) e usam um QueryClient real
 * (retry off) para validar: keys estáveis, resolução de dados, `select` por
 * grupo e reuso de cache (`useGroupStandings` não dispara fetch extra).
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BracketResponse, GroupsResponse } from "@/types";

vi.mock("@/services/worldcup", () => ({
  getGroups: vi.fn(),
  getBracket: vi.fn(),
}));

import { getBracket, getGroups } from "@/services/worldcup";
import { worldcupKeys } from "../worldcupKeys";
import { useBracket, useGroups, useGroupStandings } from "..";

const getGroupsMock = vi.mocked(getGroups);
const getBracketMock = vi.mocked(getBracket);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function makeGroups(): GroupsResponse {
  const team = (id: string, name: string, code: string) => ({
    id,
    name,
    code,
  });
  const row = (groupId: string) => ({
    position: 1,
    team: team(`${groupId}1`, `Time ${groupId}`, "ABC"),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    qualification: "indefinido" as const,
  });
  return {
    hasLiveGroupMatch: false,
    groups: [
      { groupId: "A", standings: [row("A")] },
      { groupId: "B", standings: [row("B")] },
    ],
  };
}

function makeBracket(): BracketResponse {
  return {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("worldcupKeys", () => {
  it("T1: keys namespaced sob ['worldcup'] (review BL-01, sem colisão com groupsKeys)", () => {
    expect(worldcupKeys.groups()).toEqual(["worldcup", "groups"]);
    expect(worldcupKeys.bracket()).toEqual(["worldcup", "bracket"]);
    expect(worldcupKeys.group("A")).toEqual(["worldcup", "group", "A"]);
    // Não pode prefixar ["groups"] da feature irmã (pool de apostas).
    expect(worldcupKeys.groups()[0]).not.toBe("groups");
  });
});

describe("useGroups", () => {
  it("T2: resolve a classificação completa", async () => {
    getGroupsMock.mockResolvedValueOnce(makeGroups());

    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.groups).toHaveLength(2);
    expect(getGroupsMock).toHaveBeenCalledTimes(1);
  });
});

describe("useGroupStandings", () => {
  it("T3: select devolve o GroupTable do grupo pedido", async () => {
    getGroupsMock.mockResolvedValueOnce(makeGroups());

    const { result } = renderHook(() => useGroupStandings("B"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.groupId).toBe("B");
  });

  it("T4: grupo inexistente → undefined", async () => {
    getGroupsMock.mockResolvedValueOnce(makeGroups());

    const { result } = renderHook(() => useGroupStandings("Z"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("T5: useGroups + useGroupStandings compartilham a cache ['groups'] (1 fetch)", async () => {
    getGroupsMock.mockResolvedValue(makeGroups());
    const wrapper = makeWrapper();

    const { result } = renderHook(
      () => ({ all: useGroups(), one: useGroupStandings("A") }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.all.isSuccess).toBe(true);
      expect(result.current.one.isSuccess).toBe(true);
    });
    expect(result.current.one.data?.groupId).toBe("A");
    expect(getGroupsMock).toHaveBeenCalledTimes(1);
  });
});

describe("useBracket", () => {
  it("T6: resolve o chaveamento", async () => {
    getBracketMock.mockResolvedValueOnce(makeBracket());

    const { result } = renderHook(() => useBracket(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.final).toEqual([]);
    expect(getBracketMock).toHaveBeenCalledTimes(1);
  });
});

describe("polling ao vivo (refetchInterval)", () => {
  it("T7: useGroups com hasLiveGroupMatch:true refaz fetch a cada 60s (WR-03)", async () => {
    vi.useFakeTimers();
    try {
      getGroupsMock.mockResolvedValue({
        ...makeGroups(),
        hasLiveGroupMatch: true,
      });

      renderHook(() => useGroups(), { wrapper: makeWrapper() });

      await vi.advanceTimersByTimeAsync(0); // flush do fetch inicial
      expect(getGroupsMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(getGroupsMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("T8: useGroups sem jogo ao vivo NÃO faz polling (WR-03)", async () => {
    vi.useFakeTimers();
    try {
      getGroupsMock.mockResolvedValue(makeGroups()); // hasLiveGroupMatch:false

      renderHook(() => useGroups(), { wrapper: makeWrapper() });

      await vi.advanceTimersByTimeAsync(0);
      expect(getGroupsMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(120_000);
      expect(getGroupsMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("T9: useBracket NÃO faz polling (sem flag no payload) (WR-03)", async () => {
    vi.useFakeTimers();
    try {
      getBracketMock.mockResolvedValue(makeBracket());

      renderHook(() => useBracket(), { wrapper: makeWrapper() });

      await vi.advanceTimersByTimeAsync(0);
      expect(getBracketMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(120_000);
      expect(getBracketMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
