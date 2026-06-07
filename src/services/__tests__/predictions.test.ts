import { collection, getDocs, query, where } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listPredictionsByUid } from "@/services/predictions";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  query: vi.fn(() => ({ __tag: "query" })),
  where: vi.fn(() => ({ __tag: "where" })),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const collectionMock = vi.mocked(collection);
const queryMock = vi.mocked(query);
const whereMock = vi.mocked(where);
const getDocsMock = vi.mocked(getDocs);

function makePredictionData(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    matchId: "match-123",
    homeScore: 2,
    awayScore: 1,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
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

describe("listPredictionsByUid", () => {
  it("monta query com where(uid==<uid>) e chama getDocs", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makePredictionData()]));

    await listPredictionsByUid("u1");

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "predictions",
    );
    expect(whereMock).toHaveBeenCalledWith("uid", "==", "u1");
    expect(queryMock).toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalled();
  });

  it("retorna array de Predictions validados", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makePredictionData({ matchId: "match-1", homeScore: 2, awayScore: 0 }),
        makePredictionData({ matchId: "match-2", homeScore: 1, awayScore: 1 }),
      ]),
    );

    const result = await listPredictionsByUid("u1");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ matchId: "match-1", homeScore: 2, awayScore: 0 });
    expect(result[1]).toMatchObject({ matchId: "match-2", homeScore: 1 });
  });

  it("retorna array vazio quando usuário não tem palpites", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([]));

    const result = await listPredictionsByUid("u1");

    expect(result).toEqual([]);
  });

  it("doc com placar negativo faz rejeitar (ZodError)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makePredictionData({ homeScore: -1 })]),
    );

    await expect(listPredictionsByUid("u1")).rejects.toThrow();
  });

  it("erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(listPredictionsByUid("u1")).rejects.toBe(err);
  });
});
