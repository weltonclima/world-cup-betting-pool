import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNextScheduledMatch,
  getRecentFinishedMatches,
} from "@/services/matches";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  query: vi.fn(() => ({ __tag: "query" })),
  where: vi.fn(() => ({ __tag: "where" })),
  orderBy: vi.fn(() => ({ __tag: "orderBy" })),
  limit: vi.fn(() => ({ __tag: "limit" })),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const collectionMock = vi.mocked(collection);
const queryMock = vi.mocked(query);
const whereMock = vi.mocked(where);
const orderByMock = vi.mocked(orderBy);
const limitMock = vi.mocked(limit);
const getDocsMock = vi.mocked(getDocs);

/**
 * Cria um doc de partida agendada (scheduled) — placar obrigatoriamente null.
 */
function makeScheduledMatchData(overrides: Record<string, unknown> = {}) {
  return {
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-15T20:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "Group A",
    venue: { name: "MetLife Stadium", city: "East Rutherford" },
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

/**
 * Cria um doc de partida finalizada (finished) — placar obrigatoriamente present.
 */
function makeFinishedMatchData(overrides: Record<string, unknown> = {}) {
  return {
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-10T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "Group A",
    venue: { name: "SoFi Stadium", city: "Inglewood" },
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

function snapshotWith(docsData: Array<Record<string, unknown>>) {
  return {
    empty: docsData.length === 0,
    docs: docsData.map((data) => ({ data: () => data })),
  } as unknown as Awaited<ReturnType<typeof getDocs>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getNextScheduledMatch", () => {
  it("monta query com where(status=='scheduled') + orderBy(kickoffAt asc) + limit(1)", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makeScheduledMatchData()]));

    await getNextScheduledMatch();

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "matches",
    );
    expect(whereMock).toHaveBeenCalledWith("status", "==", "scheduled");
    expect(orderByMock).toHaveBeenCalledWith("kickoffAt", "asc");
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(queryMock).toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalled();
  });

  it("retorna Match validado quando há partida agendada", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeScheduledMatchData({ homeTeamId: "team-bra" })]),
    );

    const result = await getNextScheduledMatch();

    expect(result).toMatchObject({
      homeTeamId: "team-bra",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
    });
  });

  it("retorna null quando não há partidas agendadas", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([]));

    const result = await getNextScheduledMatch();

    expect(result).toBeNull();
  });

  it("doc malformado faz rejeitar (ZodError)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeScheduledMatchData({ status: "invalido" })]),
    );

    await expect(getNextScheduledMatch()).rejects.toThrow();
  });

  it("erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(getNextScheduledMatch()).rejects.toBe(err);
  });
});

describe("getRecentFinishedMatches", () => {
  it("monta query com where(status=='finished') + orderBy(kickoffAt desc) + limit(5)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeFinishedMatchData()]),
    );

    await getRecentFinishedMatches();

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "matches",
    );
    expect(whereMock).toHaveBeenCalledWith("status", "==", "finished");
    expect(orderByMock).toHaveBeenCalledWith("kickoffAt", "desc");
    expect(limitMock).toHaveBeenCalledWith(5);
  });

  it("retorna array de Matches validados", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makeFinishedMatchData({ homeScore: 3, awayScore: 0 }),
        makeFinishedMatchData({ homeTeamId: "team-fra", homeScore: 1, awayScore: 1 }),
      ]),
    );

    const result = await getRecentFinishedMatches();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ homeScore: 3, awayScore: 0, status: "finished" });
    expect(result[1]).toMatchObject({ homeTeamId: "team-fra" });
  });

  it("retorna array vazio quando não há partidas finalizadas", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([]));

    const result = await getRecentFinishedMatches();

    expect(result).toEqual([]);
  });

  it("doc malformado faz rejeitar (ZodError)", async () => {
    // finished sem placar viola o refinement do schema
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeFinishedMatchData({ homeScore: null, awayScore: null })]),
    );

    await expect(getRecentFinishedMatches()).rejects.toThrow();
  });

  it("erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("unavailable"), {
      code: "unavailable",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(getRecentFinishedMatches()).rejects.toBe(err);
  });
});
