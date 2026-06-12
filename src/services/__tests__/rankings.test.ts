import { doc, getDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGeneralRanking,
  getGroupRanking,
  getParticipantProfile,
  getPoolRanking,
  getPoolStats,
  getRankingByScope,
  getUserRanking,
} from "@/services/rankings";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ __tag: "doc", path })),
  getDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const docMock = vi.mocked(doc);
const getDocMock = vi.mocked(getDoc);

// getRankingByScope/getGeneralRanking/getUserRanking agora leem via
// GET /api/rankings/{scope} (server). Mockamos `fetch`. Os demais serviços
// (group/statistics/pool_stats) seguem lendo Firestore client direto (getDoc).
const fetchMock = vi.fn();

function fetchResp(json: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => json } as unknown as Response;
}

function snap(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

function rankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "geral",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
      { uid: "u2", nickname: "bia", name: "Bia", position: 2, points: 8, wrong: 4, accuracy: 67 },
    ],
    ...overrides,
  };
}

function groupDoc(overrides: Record<string, unknown> = {}) {
  return {
    groupId: "A",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [{ uid: "u1", nickname: "ana", position: 1, points: 3 }],
    ...overrides,
  };
}

function statsDoc(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    totalCorrect: 10,
    accuracy: 83,
    longestStreak: 3,
    correctByStage: { grupos: 6, oitavas: 4 },
    positionHistory: [{ at: "2026-06-01T02:00:00.000Z", scope: "geral", position: 1 }],
    ...overrides,
  };
}

function poolDoc(overrides: Record<string, unknown> = {}) {
  return {
    updatedAt: "2026-06-01T02:00:00.000Z",
    totalParticipants: 28,
    highestPoints: 98,
    highestPointsName: "Ana",
    lowestPoints: 12,
    averagePoints: 56.4,
    totalCorrect: 438,
    distribution: [{ label: "90-100 pts", min: 90, max: 100, count: 3 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getRankingByScope", () => {
  it("lê GET /api/rankings/{scope} e retorna Ranking validado", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc({ scope: "oitavas" })));
    const result = await getRankingByScope("oitavas");
    expect(fetchMock).toHaveBeenCalledWith("/api/rankings/oitavas", { cache: "no-store" });
    expect(result?.scope).toBe("oitavas");
    expect(result?.entries).toHaveLength(2);
  });

  it("retorna null quando a resposta é null (doc não existe)", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null));
    expect(await getRankingByScope("grupos")).toBeNull();
  });

  it("doc malformado rejeita (ZodError)", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc({ scope: "invalido" })));
    await expect(getRankingByScope("geral")).rejects.toThrow();
  });

  it("status não-OK propaga como erro", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null, false, 500));
    await expect(getRankingByScope("geral")).rejects.toThrow(/500/);
  });
});

describe("getGeneralRanking", () => {
  it("delega a getRankingByScope('geral') (GET /api/rankings/geral)", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc()));
    const result = await getGeneralRanking();
    expect(fetchMock).toHaveBeenCalledWith("/api/rankings/geral", { cache: "no-store" });
    expect(result?.scope).toBe("geral");
  });

  it("retorna null quando vazio", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null));
    expect(await getGeneralRanking()).toBeNull();
  });
});

describe("getPoolRanking", () => {
  it("lê GET /api/rankings/pool e retorna Ranking validado", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc()));
    const result = await getPoolRanking();
    expect(fetchMock).toHaveBeenCalledWith("/api/rankings/pool", { cache: "no-store" });
    expect(result?.scope).toBe("geral");
  });

  it("retorna null quando sem pool (resposta null)", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null));
    expect(await getPoolRanking()).toBeNull();
  });

  it("status não-OK propaga como erro", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null, false, 500));
    await expect(getPoolRanking()).rejects.toThrow(/500/);
  });
});

describe("getGroupRanking", () => {
  it("lê rankings/group-{groupId}", async () => {
    getDocMock.mockResolvedValueOnce(snap(groupDoc()));
    const result = await getGroupRanking("A");
    expect(docMock).toHaveBeenCalledWith(expect.anything(), "rankings", "grupo-A");
    expect(result?.groupId).toBe("A");
  });

  it("null quando inexistente", async () => {
    getDocMock.mockResolvedValueOnce(snap(null));
    expect(await getGroupRanking("Z")).toBeNull();
  });
});

describe("getUserRanking", () => {
  it("retorna entry do usuário + total quando presente no geral", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc()));
    const result = await getUserRanking("u2");
    expect(result?.entry.uid).toBe("u2");
    expect(result?.entry.position).toBe(2);
    expect(result?.total).toBe(2);
  });

  it("retorna null quando uid ausente do ranking", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(rankingDoc()));
    expect(await getUserRanking("desconhecido")).toBeNull();
  });

  it("retorna null quando não há ranking geral", async () => {
    fetchMock.mockResolvedValueOnce(fetchResp(null));
    expect(await getUserRanking("u1")).toBeNull();
  });
});

describe("getParticipantProfile", () => {
  it("lê statistics/{uid} e valida", async () => {
    getDocMock.mockResolvedValueOnce(snap(statsDoc()));
    const result = await getParticipantProfile("u1");
    expect(docMock).toHaveBeenCalledWith(expect.anything(), "statistics", "u1");
    expect(result?.uid).toBe("u1");
    expect(result?.totalCorrect).toBe(10);
  });

  it("null quando inexistente", async () => {
    getDocMock.mockResolvedValueOnce(snap(null));
    expect(await getParticipantProfile("x")).toBeNull();
  });
});

describe("getPoolStats", () => {
  it("lê pool_stats/current e valida", async () => {
    getDocMock.mockResolvedValueOnce(snap(poolDoc()));
    const result = await getPoolStats();
    expect(docMock).toHaveBeenCalledWith(expect.anything(), "pool_stats", "current");
    expect(result?.totalParticipants).toBe(28);
    expect(result?.distribution).toHaveLength(1);
  });

  it("null quando inexistente", async () => {
    getDocMock.mockResolvedValueOnce(snap(null));
    expect(await getPoolStats()).toBeNull();
  });
});
