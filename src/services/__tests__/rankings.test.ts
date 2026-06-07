import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGeneralRanking } from "@/services/rankings";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  query: vi.fn(() => ({ __tag: "query" })),
  where: vi.fn(() => ({ __tag: "where" })),
  limit: vi.fn(() => ({ __tag: "limit" })),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const collectionMock = vi.mocked(collection);
const queryMock = vi.mocked(query);
const whereMock = vi.mocked(where);
const limitMock = vi.mocked(limit);
const getDocsMock = vi.mocked(getDocs);

function makeRankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "geral",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      {
        uid: "u1",
        nickname: "fulano",
        position: 1,
        points: 10,
      },
    ],
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

describe("getGeneralRanking", () => {
  it("monta query com where(scope=='geral') + limit(1) e chama getDocs", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makeRankingDoc()]));

    await getGeneralRanking();

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "rankings",
    );
    expect(whereMock).toHaveBeenCalledWith("scope", "==", "geral");
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(queryMock).toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalled();
  });

  it("retorna Ranking validado quando doc existe", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makeRankingDoc()]));

    const result = await getGeneralRanking();

    expect(result).toMatchObject({
      scope: "geral",
      entries: [{ uid: "u1", position: 1, points: 10 }],
    });
  });

  it("retorna null quando snapshot está vazio", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([]));

    const result = await getGeneralRanking();

    expect(result).toBeNull();
  });

  it("doc malformado faz a leitura rejeitar (propaga ZodError)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeRankingDoc({ scope: "invalido" })]),
    );

    await expect(getGeneralRanking()).rejects.toThrow();
  });

  it("erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(getGeneralRanking()).rejects.toBe(err);
  });
});
