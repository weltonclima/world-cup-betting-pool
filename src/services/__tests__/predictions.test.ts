import { collection, getDocs, query, where } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPredictionsByUid,
  upsertPrediction,
  PredictionServiceError,
} from "@/services/predictions";

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

// --- Mock global fetch para testes de upsertPrediction ---
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

// ─── upsertPrediction ────────────────────────────────────────────────────────

function makeOkResponse(status = 200) {
  return {
    ok: true,
    status,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

function makeErrorResponse(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

const INPUT = { matchId: "match-01", homeScore: 2, awayScore: 1 };

describe("upsertPrediction — corpo e headers do fetch", () => {
  it("chama fetch para /api/predictions com method POST e credentials same-origin", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse());

    await upsertPrediction(INPUT);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/predictions");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
  });

  it("body enviado é JSON com {matchId, homeScore, awayScore} — sem uid", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse());

    await upsertPrediction(INPUT);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      matchId: "match-01",
      homeScore: 2,
      awayScore: 1,
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("uid");
  });

  it("header Content-Type é application/json", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse());

    await upsertPrediction(INPUT);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("upsertPrediction — sucesso (2xx)", () => {
  it("resolve void em resposta 200", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(200));
    await expect(upsertPrediction(INPUT)).resolves.toBeUndefined();
  });

  it("resolve void em resposta 201", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(201));
    await expect(upsertPrediction(INPUT)).resolves.toBeUndefined();
  });
});

describe("upsertPrediction — erros HTTP mapeados para PredictionServiceError", () => {
  const cases: Array<[number, string]> = [
    [401, "Você precisa estar autenticado para registrar palpites."],
    [403, "Seu acesso ainda não foi aprovado pelo administrador."],
    [404, "A partida solicitada não foi encontrada."],
    [422, "Os dados do palpite são inválidos."],
    [423, "O prazo para este jogo foi encerrado."],
    [500, "Erro ao salvar o palpite. Tente novamente."],
  ];

  for (const [status, expectedMessage] of cases) {
    it(`status ${status} → PredictionServiceError com mensagem pt-BR correta`, async () => {
      fetchMock.mockResolvedValueOnce(makeErrorResponse(status));

      await expect(upsertPrediction(INPUT)).rejects.toMatchObject({
        name: "PredictionServiceError",
        status,
        message: expectedMessage,
      });
    });

    it(`status ${status} → erro é instância de PredictionServiceError`, async () => {
      fetchMock.mockResolvedValueOnce(makeErrorResponse(status));

      let caught: unknown;
      try {
        await upsertPrediction(INPUT);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PredictionServiceError);
    });
  }

  it("status desconhecido (503) → PredictionServiceError com fallback pt-BR", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(503));

    await expect(upsertPrediction(INPUT)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 503,
      message: "Ocorreu um erro inesperado. Tente novamente.",
    });
  });
});

describe("upsertPrediction — erro de rede / inesperado", () => {
  it("propaga erro de rede (fetch rejeita) sem wrapping adicional", async () => {
    const networkErr = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValueOnce(networkErr);

    await expect(upsertPrediction(INPUT)).rejects.toBe(networkErr);
  });
});
