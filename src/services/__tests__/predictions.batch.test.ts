/**
 * Testes de upsertPredictionsBatch (TASK-05 — spec §8.1).
 *
 * 11 cenários de teste:
 * 1. Resposta 200 com saved+rejected vazio → retorna BatchUpsertResult sem exceção
 * 2. Resposta 200 com rejected não vazio → retorna objeto com ambos os arrays preenchidos; sem exceção
 * 3. Resposta 401 → lança PredictionServiceError(401)
 * 4. Resposta 403 → lança PredictionServiceError(403)
 * 5. Resposta 422 → lança PredictionServiceError(422)
 * 6. Resposta 500 → lança PredictionServiceError(500)
 * 7. Resposta 503 → lança PredictionServiceError(503, "Serviço de dados da Copa temporariamente indisponível.")
 * 8. Resposta 999 (não mapeado) → lança PredictionServiceError(999, FALLBACK_HTTP_MESSAGE)
 * 9. Envia credentials: "same-origin"
 * 10. Body serializado corretamente com {predictions: inputs}
 * 11. Falha de rede (fetch rejeita) → propaga erro original
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import {
  upsertPredictionsBatch,
  PredictionServiceError,
  type BatchUpsertResult,
  type UpsertPredictionInput,
} from "@/services/predictions";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeOkResponse(body: BatchUpsertResult) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

const INPUTS: UpsertPredictionInput[] = [
  { matchId: "match-01", homeScore: 2, awayScore: 1 },
  { matchId: "match-02", homeScore: 0, awayScore: 0 },
];

const SAVED_ITEM = {
  id: "uid_match-01",
  matchId: "match-01",
  homeScore: 2,
  awayScore: 1,
  created: true,
};

const REJECTED_ITEM = {
  index: 1,
  matchId: "match-02",
  reason: "locked" as const,
  message: "O prazo para este jogo foi encerrado.",
};

// ── testes ────────────────────────────────────────────────────────────────────

describe("upsertPredictionsBatch — sucesso 200", () => {
  it("T1: Resposta 200 com rejected vazio → retorna BatchUpsertResult sem exceção", async () => {
    const expected: BatchUpsertResult = { saved: [SAVED_ITEM], rejected: [] };
    fetchMock.mockResolvedValueOnce(makeOkResponse(expected));

    const result = await upsertPredictionsBatch(INPUTS);

    expect(result).toEqual(expected);
    expect(result.saved).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("T2: Resposta 200 com rejected não vazio → retorna ambos os arrays; sem exceção", async () => {
    const expected: BatchUpsertResult = {
      saved: [SAVED_ITEM],
      rejected: [REJECTED_ITEM],
    };
    fetchMock.mockResolvedValueOnce(makeOkResponse(expected));

    const result = await upsertPredictionsBatch(INPUTS);

    expect(result.saved).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ reason: "locked" });
  });
});

describe("upsertPredictionsBatch — erros HTTP → PredictionServiceError", () => {
  it("T3: status 401 → PredictionServiceError com mensagem pt-BR de autenticação", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(401));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 401,
      message: "Você precisa estar autenticado para registrar palpites.",
    });
  });

  it("T4: status 403 → PredictionServiceError com mensagem pt-BR de aprovação", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(403));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 403,
      message: "Seu acesso ainda não foi aprovado pelo administrador.",
    });
  });

  it("T5: status 422 → PredictionServiceError com mensagem pt-BR de dados inválidos", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(422));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 422,
      message: "Os dados do palpite são inválidos.",
    });
  });

  it("T6: status 500 → PredictionServiceError com mensagem pt-BR de erro interno", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(500));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 500,
      message: "Erro ao salvar o palpite. Tente novamente.",
    });
  });

  it("T7: status 503 → PredictionServiceError com mensagem pt-BR de serviço indisponível", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(503));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 503,
      message: "Serviço de dados da Copa temporariamente indisponível.",
    });
  });

  it("T7b: status 502 → PredictionServiceError com mensagem de erro de dados da Copa", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(502));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 502,
      message: "Erro ao buscar dados da Copa. Tente novamente.",
    });
  });

  it("T7c: status 504 → PredictionServiceError com mensagem de timeout", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(504));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 504,
      message: "Tempo limite ao buscar dados da Copa. Tente novamente.",
    });
  });

  it("T8: status 999 (não mapeado) → PredictionServiceError com FALLBACK_HTTP_MESSAGE", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(999));

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toMatchObject({
      name: "PredictionServiceError",
      status: 999,
      message: "Ocorreu um erro inesperado. Tente novamente.",
    });
  });

  it("erros de rota são instâncias de PredictionServiceError", async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(401));

    let caught: unknown;
    try {
      await upsertPredictionsBatch(INPUTS);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PredictionServiceError);
  });
});

describe("upsertPredictionsBatch — contrato do fetch", () => {
  it("T9: envia credentials: 'same-origin'", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse({ saved: [], rejected: [] }));

    await upsertPredictionsBatch(INPUTS);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("same-origin");
  });

  it("T10: body serializado como {predictions: inputs}", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse({ saved: [], rejected: [] }));

    await upsertPredictionsBatch(INPUTS);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/predictions/batch");
    const body = JSON.parse(init.body as string) as { predictions: UpsertPredictionInput[] };
    expect(body).toEqual({ predictions: INPUTS });
  });
});

describe("upsertPredictionsBatch — erro de rede", () => {
  it("T11: falha de rede (fetch rejeita) → propaga erro original sem wrapping", async () => {
    const networkErr = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValueOnce(networkErr);

    await expect(upsertPredictionsBatch(INPUTS)).rejects.toBe(networkErr);
  });
});
