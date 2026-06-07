/**
 * Testes TDD (red-first) do Route Handler POST /api/predictions/score (TASK-04).
 *
 * A rota ainda NÃO existe — todos os testes devem falhar (red) porque o
 * import de `@/app/api/predictions/score/route` lançará erro de módulo ausente.
 *
 * Mocks:
 * - `@/server/firebaseAdmin`        → getAdminAuth (verifySessionCookie) + getAdminFirestore
 * - `next/headers`                  → cookies (httpOnly session cookie)
 * - `../../../_lib/apiFootballData` → fetchAllMatches
 * - `@/features/predictions/lib`    → scorePrediction (spy — usa implementação real para casos de binário)
 * - `server-only`                   → {} (sem erro fora do contexto Next.js)
 *
 * Casos cobertos:
 *  1.  401 — sem secret E sem cookie (não autenticado)
 *  2.  401 — secret errado E sem cookie
 *  3.  401 — secret errado E cookie inválido (verifySessionCookie lança)
 *  4.  403 — secret errado E usuário com role "user" (não-admin)
 *  5.  200 — autorizado por header secret correto
 *  6.  200 — autorizado por sessão admin
 *  7.  binário — palpite com placar exato → status "correct", points 1
 *  8.  binário — palpite com placar errado → status "wrong", points 0
 *  9.  partida não-finished (scheduled) é ignorada (não processada)
 * 10.  partida finished sem palpites → zero writes, scoredMatches=1, updatedPredictions=0
 * 11.  idempotência — rodar duas vezes produz os mesmos valores gravados
 * 12.  sumário correto: { scoredMatches, updatedPredictions }
 * 13.  503 — fetchAllMatches lança ApiFootballQuotaError
 * 14.  set() chamado com { merge: true } e apenas { status, points }
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — devem ser declarados ANTES de qualquer import de runtime.
// ---------------------------------------------------------------------------

const {
  verifySessionCookieMock,
  getFirestoreMock,
  fetchAllMatchesMock,
  cookiesMock,
  scorePredictionMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  fetchAllMatchesMock: vi.fn(),
  cookiesMock: vi.fn(),
  scorePredictionMock: vi.fn(),
}));

// Mock: Admin SDK (firebaseAdmin)
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));

// Mock: next/headers — cookies()
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

// Mock: fetchAllMatches (caminho relativo ao arquivo de rota score/route.ts)
vi.mock("../../../_lib/apiFootballData", () => ({
  fetchAllMatches: fetchAllMatchesMock,
}));

// Mock: scorePrediction (barrel — nunca path direto)
// Usamos importActual para preservar predictionDocId e outros exports reais.
vi.mock("@/features/predictions/lib", async () => {
  const actual = await vi.importActual<typeof import("@/features/predictions/lib")>(
    "@/features/predictions/lib",
  );
  return {
    ...actual,
    scorePrediction: scorePredictionMock,
  };
});

// Mock: server-only (impede erro fora de contexto Next.js)
vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Import da rota — deve falhar (RED) enquanto a rota não existir.
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/predictions/score/route";

// ---------------------------------------------------------------------------
// Import de erros reais para instanceof funcionar corretamente no handler.
// ---------------------------------------------------------------------------
import { ApiFootballQuotaError } from "@/server/apiFootball/client";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// ---------------------------------------------------------------------------
// Fixtures de dados de teste
// ---------------------------------------------------------------------------

const MOCK_SCORE_SECRET = "super-secret-cron-token-abc123";
const MOCK_UID = "uid-admin-xyz";
const MOCK_SESSION_COOKIE = "admin-session-cookie-value";

/** Partida finalizada com resultado 2-1. */
const MOCK_MATCH_FINISHED = {
  id: "5001",
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // -2h
  homeTeamId: "team-1",
  awayTeamId: "team-2",
  homeScore: 2,
  awayScore: 1,
  groupId: "A",
  stage: "grupos" as const,
  venue: null,
  round: "Group Stage - 1",
};

/** Partida agendada (não finished). */
const MOCK_MATCH_SCHEDULED = {
  ...MOCK_MATCH_FINISHED,
  id: "5002",
  status: "scheduled" as const,
  kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 dia
  homeScore: null,
  awayScore: null,
};

/** Palpite com placar exato (deve marcar correct). */
const MOCK_PREDICTION_CORRECT = {
  uid: "user-123",
  matchId: MOCK_MATCH_FINISHED.id,
  homeScore: 2,
  awayScore: 1,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

/** Palpite com placar errado (deve marcar wrong). */
const MOCK_PREDICTION_WRONG = {
  uid: "user-456",
  matchId: MOCK_MATCH_FINISHED.id,
  homeScore: 1,
  awayScore: 0,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers de setup do Firestore mock para a query where matchId==
// ---------------------------------------------------------------------------

/**
 * Cria um doc snapshot fake com ref.set mockado.
 */
function makeDocSnapshot(data: Record<string, unknown>, setMock = vi.fn().mockResolvedValue(undefined)) {
  return {
    data: () => data,
    ref: { set: setMock },
  };
}

/**
 * Cria um snapshot de query fake (resultado de .where().get()).
 */
function makeQuerySnapshot(docs: ReturnType<typeof makeDocSnapshot>[]) {
  return {
    empty: docs.length === 0,
    docs,
  };
}

/**
 * Monta o mock do Firestore para o loop de pontuação.
 * `matchPredictionsMap`: matchId → array de dados de palpite
 * `userDocData`: dados do doc users/{uid} para auth de admin
 */
function makeFirestoreMock({
  matchPredictionsMap = {} as Record<string, Record<string, unknown>[]>,
  userDocData = { role: "admin" } as Record<string, unknown> | null,
  docSetMock = vi.fn().mockResolvedValue(undefined),
}: {
  matchPredictionsMap?: Record<string, Record<string, unknown>[]>;
  userDocData?: Record<string, unknown> | null;
  docSetMock?: ReturnType<typeof vi.fn>;
} = {}) {
  // Map de sets por palpite (para verificações de idempotência)
  const setMocks: ReturnType<typeof vi.fn>[][] = [];

  const getMock = vi.fn().mockResolvedValue(
    userDocData === null
      ? { exists: false }
      : { exists: true, data: () => userDocData },
  );
  const userDocMock = vi.fn().mockReturnValue({ get: getMock });
  const userCollectionMock = vi.fn().mockReturnValue({ doc: userDocMock });

  // Mock para query predictions where matchId ==
  const whereMock = vi.fn().mockImplementation((_field: string, _op: string, matchId: string) => {
    const predictions = matchPredictionsMap[matchId] ?? [];
    const docSets = predictions.map(() => vi.fn().mockResolvedValue(undefined));
    setMocks.push(docSets);
    const docs = predictions.map((data, i) => makeDocSnapshot(data, docSets[i]));
    const snapshot = makeQuerySnapshot(docs);
    return {
      get: vi.fn().mockResolvedValue(snapshot),
    };
  });

  const predictionsCollectionMock = vi.fn().mockReturnValue({ where: whereMock });

  getFirestoreMock.mockReturnValue({
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === "users") return { doc: userDocMock };
      if (name === "predictions") return { where: whereMock };
      return {};
    }),
  });

  return { whereMock, setMocks, getMock };
}

// ---------------------------------------------------------------------------
// Helpers de setup de cookies e sessão admin
// ---------------------------------------------------------------------------

function setupAdminSession({
  hasCookie = true,
  cookieValid = true,
  userRole = "admin" as "admin" | "user" | null,
} = {}) {
  const cookieGetMock = vi.fn().mockReturnValue(
    hasCookie ? { name: SESSION_COOKIE_NAME, value: MOCK_SESSION_COOKIE } : undefined,
  );
  cookiesMock.mockResolvedValue({ get: cookieGetMock });

  if (!cookieValid) {
    verifySessionCookieMock.mockRejectedValue(new Error("Invalid session cookie"));
  } else {
    verifySessionCookieMock.mockResolvedValue({ uid: MOCK_UID });
  }

  // Firestore users doc (para auth admin)
  const userDocData =
    userRole === null
      ? null
      : { role: userRole, status: "approved" };

  makeFirestoreMock({ userDocData: userDocData ?? undefined });
}

// ---------------------------------------------------------------------------
// Helper: monta um NextRequest POST (body vazio — endpoint não usa body)
// ---------------------------------------------------------------------------

function postRequest(headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/predictions/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  }) as unknown as NextRequest;
}

function postRequestWithSecret(secret: string): NextRequest {
  return postRequest({ "x-cron-secret": secret });
}

// ---------------------------------------------------------------------------
// Suites de testes
// ---------------------------------------------------------------------------

describe("POST /api/predictions/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Por padrão: SCORE_SECRET definida
    vi.stubEnv("SCORE_SECRET", MOCK_SCORE_SECRET);
    // Por padrão: fetchAllMatches retorna partida finished
    fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH_FINISHED]);
    // Por padrão: scorePrediction usa implementação real
    scorePredictionMock.mockImplementation(
      (prediction: typeof MOCK_PREDICTION_CORRECT, match: typeof MOCK_MATCH_FINISHED) => {
        if (
          match.status !== "finished" ||
          match.homeScore === null ||
          match.awayScore === null
        ) {
          return { status: "pending", points: 0 };
        }
        const correct =
          prediction.homeScore === match.homeScore &&
          prediction.awayScore === match.awayScore;
        return correct
          ? { status: "correct", points: 1 }
          : { status: "wrong", points: 0 };
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // 1. Proteção — 401 (sem credencial)
  // -------------------------------------------------------------------------

  describe("proteção — sem credencial", () => {
    it("retorna 401 quando header secret está ausente E não há cookie", async () => {
      // Sem header secret, sem cookie
      cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
      getFirestoreMock.mockReturnValue({ collection: vi.fn().mockReturnValue({ doc: vi.fn() }) });

      const response = await POST(postRequest()); // sem x-cron-secret
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });

    it("retorna 401 quando header secret está errado E não há cookie", async () => {
      cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
      getFirestoreMock.mockReturnValue({ collection: vi.fn().mockReturnValue({ doc: vi.fn() }) });

      const response = await POST(postRequestWithSecret("wrong-secret"));
      expect(response.status).toBe(401);
    });

    it("retorna 401 quando header secret errado E cookie inválido", async () => {
      setupAdminSession({ hasCookie: true, cookieValid: false });

      const response = await POST(postRequestWithSecret("wrong-secret"));
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Proteção — 403 (autenticado mas não admin)
  // -------------------------------------------------------------------------

  describe("proteção — usuário não-admin", () => {
    it("retorna 403 quando header secret errado E cookie válido mas role é 'user'", async () => {
      setupAdminSession({ userRole: "user" });

      const response = await POST(postRequestWithSecret("wrong-secret"));
      expect(response.status).toBe(403);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Autorização por header secret
  // -------------------------------------------------------------------------

  describe("autorizado por header secret", () => {
    it("retorna 200 quando x-cron-secret bate com SCORE_SECRET", async () => {
      makeFirestoreMock({
        matchPredictionsMap: {
          [MOCK_MATCH_FINISHED.id]: [MOCK_PREDICTION_CORRECT],
        },
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body).toHaveProperty("scoredMatches");
      expect(body).toHaveProperty("updatedPredictions");
    });

    it("não chama cookies() quando autorizado por secret", async () => {
      makeFirestoreMock({ matchPredictionsMap: {} });
      fetchAllMatchesMock.mockResolvedValue([]);

      await POST(postRequestWithSecret(MOCK_SCORE_SECRET));

      // cookies() não deve ser chamado quando secret for válida
      expect(cookiesMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Autorização por sessão admin
  // -------------------------------------------------------------------------

  describe("autorizado por sessão admin", () => {
    it("retorna 200 quando sessão admin válida (sem header secret)", async () => {
      setupAdminSession({ userRole: "admin" });
      // Sobrescrever getFirestoreMock para também responder queries de predictions
      makeFirestoreMock({
        matchPredictionsMap: {
          [MOCK_MATCH_FINISHED.id]: [MOCK_PREDICTION_CORRECT],
        },
        userDocData: { role: "admin", status: "approved" },
      });

      const response = await POST(postRequest()); // sem header secret
      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Binário — pontuação correta
  // -------------------------------------------------------------------------

  describe("pontuação binária", () => {
    it("grava status 'correct' e points 1 quando placar é exato", async () => {
      const setMockCorrect = vi.fn().mockResolvedValue(undefined);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  empty: false,
                  docs: [makeDocSnapshot(MOCK_PREDICTION_CORRECT, setMockCorrect)],
                }),
              }),
            };
          }
          return {};
        }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      expect(setMockCorrect).toHaveBeenCalledTimes(1);
      const [payload, options] = setMockCorrect.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
      ];
      expect(options).toEqual({ merge: true });
      expect(payload.status).toBe("correct");
      expect(payload.points).toBe(1);
    });

    it("grava status 'wrong' e points 0 quando placar é diferente", async () => {
      const setMockWrong = vi.fn().mockResolvedValue(undefined);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  empty: false,
                  docs: [makeDocSnapshot(MOCK_PREDICTION_WRONG, setMockWrong)],
                }),
              }),
            };
          }
          return {};
        }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      expect(setMockWrong).toHaveBeenCalledTimes(1);
      const [payload, options] = setMockWrong.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
      ];
      expect(options).toEqual({ merge: true });
      expect(payload.status).toBe("wrong");
      expect(payload.points).toBe(0);
    });

    it("set() é chamado apenas com { status, points } e { merge: true }", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  empty: false,
                  docs: [makeDocSnapshot(MOCK_PREDICTION_CORRECT, setMock)],
                }),
              }),
            };
          }
          return {};
        }),
      });

      await POST(postRequestWithSecret(MOCK_SCORE_SECRET));

      const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
      // Apenas status e points — sem uid, matchId, homeScore, awayScore, etc.
      expect(Object.keys(payload)).toHaveLength(2);
      expect(payload).toHaveProperty("status");
      expect(payload).toHaveProperty("points");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Partida não-finished é ignorada
  // -------------------------------------------------------------------------

  describe("partida não-finished é ignorada", () => {
    it("não processa palpites quando partida tem status 'scheduled'", async () => {
      fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH_SCHEDULED]);

      const whereMock = vi.fn();
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockReturnValue({ where: whereMock }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      // where() não deve ser chamado (nenhuma query de palpites)
      expect(whereMock).not.toHaveBeenCalled();

      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body.scoredMatches).toBe(0);
      expect(body.updatedPredictions).toBe(0);
    });

    it("retorna scoredMatches=0 quando todas as partidas são scheduled/live", async () => {
      fetchAllMatchesMock.mockResolvedValue([
        MOCK_MATCH_SCHEDULED,
        { ...MOCK_MATCH_SCHEDULED, id: "5003", status: "live" as const },
      ]);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockReturnValue({ where: vi.fn() }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body.scoredMatches).toBe(0);
      expect(body.updatedPredictions).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Partida finished sem palpites → zero writes
  // -------------------------------------------------------------------------

  describe("partida finished sem palpites", () => {
    it("não chama set() quando snapshot está vazio, mas incrementa scoredMatches", async () => {
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
              }),
            };
          }
          return {};
        }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body.updatedPredictions).toBe(0);
      expect(body.scoredMatches).toBe(1); // partida foi inspecionada
    });
  });

  // -------------------------------------------------------------------------
  // 8. Idempotência
  // -------------------------------------------------------------------------

  describe("idempotência", () => {
    it("rodar duas vezes grava os mesmos valores de status e points", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      const docSnap = makeDocSnapshot(MOCK_PREDICTION_CORRECT, setMock);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [docSnap] }),
              }),
            };
          }
          return {};
        }),
      });

      // Primeira run
      await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      // Segunda run
      await POST(postRequestWithSecret(MOCK_SCORE_SECRET));

      expect(setMock).toHaveBeenCalledTimes(2);

      const [firstPayload] = setMock.mock.calls[0] as [Record<string, unknown>];
      const [secondPayload] = setMock.mock.calls[1] as [Record<string, unknown>];

      // Ambas as calls gravam os mesmos valores
      expect(firstPayload.status).toBe(secondPayload.status);
      expect(firstPayload.points).toBe(secondPayload.points);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Sumário correto
  // -------------------------------------------------------------------------

  describe("sumário { scoredMatches, updatedPredictions }", () => {
    it("retorna contagens corretas para múltiplas partidas e palpites", async () => {
      const MATCH_2 = {
        ...MOCK_MATCH_FINISHED,
        id: "5010",
        homeScore: 0,
        awayScore: 0,
      };
      fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH_FINISHED, MATCH_2]);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "predictions") {
            return {
              where: vi.fn().mockImplementation((_field: string, _op: string, matchId: string) => {
                const data: Record<string, unknown>[] =
                  matchId === MOCK_MATCH_FINISHED.id
                    ? [MOCK_PREDICTION_CORRECT, MOCK_PREDICTION_WRONG] // 2 palpites na partida 1
                    : [{ ...MOCK_PREDICTION_CORRECT, matchId: MATCH_2.id }]; // 1 palpite na partida 2
                const docs = data.map((d) =>
                  makeDocSnapshot(d, vi.fn().mockResolvedValue(undefined)),
                );
                return {
                  get: vi.fn().mockResolvedValue({ empty: docs.length === 0, docs }),
                };
              }),
            };
          }
          return {};
        }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body.scoredMatches).toBe(2);
      expect(body.updatedPredictions).toBe(3);
    });

    it("retorna { scoredMatches: 0, updatedPredictions: 0 } quando não há partidas finished", async () => {
      fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH_SCHEDULED]);
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockReturnValue({ where: vi.fn() }),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
      };
      expect(body).toEqual({ scoredMatches: 0, updatedPredictions: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // 10. Erros de upstream — fetchAllMatches lança
  // -------------------------------------------------------------------------

  describe("erros de integração com API-Football", () => {
    it("retorna 503 quando fetchAllMatches lança ApiFootballQuotaError", async () => {
      fetchAllMatchesMock.mockRejectedValue(new ApiFootballQuotaError());

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockReturnValue({}),
      });

      const response = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
      expect(response.status).toBe(503);
    });
  });
});
