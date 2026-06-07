import { doc, getDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStatistics } from "@/services/statistics";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ __tag: "doc" })),
  getDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const docMock = vi.mocked(doc);
const getDocMock = vi.mocked(getDoc);

function makeStatisticsData(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    totalCorrect: 12,
    accuracy: 60,
    longestStreak: 3,
    correctByStage: { grupos: 8, oitavas: 4 },
    positionHistory: [
      {
        at: "2026-06-01T02:00:00.000Z",
        scope: "geral",
        position: 5,
      },
    ],
    ...overrides,
  };
}

function snapExists(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

function snapMissing() {
  return {
    exists: () => false,
    data: () => undefined,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getStatistics", () => {
  it("acessa o doc statistics/{uid} correto", async () => {
    getDocMock.mockResolvedValueOnce(snapExists(makeStatisticsData()));

    await getStatistics("u1");

    expect(docMock).toHaveBeenCalledWith(
      expect.anything(),
      "statistics",
      "u1",
    );
    expect(getDocMock).toHaveBeenCalled();
  });

  it("retorna Statistics validado quando doc existe", async () => {
    getDocMock.mockResolvedValueOnce(snapExists(makeStatisticsData()));

    const result = await getStatistics("u1");

    expect(result).toMatchObject({
      uid: "u1",
      totalCorrect: 12,
      accuracy: 60,
    });
  });

  it("retorna null quando o doc não existe (usuário sem dados)", async () => {
    getDocMock.mockResolvedValueOnce(snapMissing());

    const result = await getStatistics("u1");

    expect(result).toBeNull();
  });

  it("doc malformado (accuracy fora de 0–100) faz rejeitar (ZodError)", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists(makeStatisticsData({ accuracy: 200 })),
    );

    await expect(getStatistics("u1")).rejects.toThrow();
  });

  it("erro do getDoc propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocMock.mockRejectedValueOnce(err);

    await expect(getStatistics("u1")).rejects.toBe(err);
  });
});
