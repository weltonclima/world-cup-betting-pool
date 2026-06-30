/**
 * Testes TDD (red-first) do Route Handler POST /api/predictions/batch (TASK-04).
 *
 * A rota ainda NÃO existe — todos os testes devem falhar (red) porque o
 * import de `@/app/api/predictions/batch/route` lançará erro de módulo ausente.
 *
 * Mocks:
 * - `@/server/firebaseAdmin`     → getAdminAuth (verifySessionCookie) + getAdminFirestore (com batch())
 * - `next/headers`               → cookies (httpOnly session cookie)
 * - `@/server/copaData`          → fetchAllMatches
 * - `@/features/predictions/lib` → isPredictionLocked (spy — usa implementação real para casos válidos)
 * - `server-only`                → stub vazio
 *
 * Casos cobertos (24 — §8 da spec):
 *
 * § 8.1 Autenticação (401)
 *  1. Cookie ausente → 401
 *  2. verifySessionCookie lança → 401
 *  3. users/{uid} não existe → 401
 *
 * § 8.2 Autorização (403)
 *  4. users/{uid}.status === "pending" → 403
 *  5. users/{uid}.status === "blocked" → 403
 *
 * § 8.3 Validação do body (400 / 422)
 *  6. Body não-JSON → 400
 *  7. `predictions` ausente no body → 422
 *  8. `predictions` array vazio → 422
 *  9. `predictions` com 105 itens → 422 (cap excedido)
 * 10. Body com campo `uid` injetado → uid da sessão prevalece; batch.set usa uid da sessão
 *
 * § 8.4 fetchAllMatches — erros de upstream (502/503/504)
 * 11. fetchAllMatches lança CopaDataFetchError → 502
 * 12. fetchAllMatches lança CopaDataTimeoutError → 504
 *
 * § 8.5 Processamento por item — resposta 200 com saved/rejected
 * 13. Lote de 1 item válido, match aberto, doc não existe → saved[0].created === true
 * 14. Lote de 1 item válido, match aberto, doc já existe → saved[0].created === false
 * 15. Item com matchId inexistente → rejected[n].reason === "not_found"
 * 16. Item com match bloqueado (isPredictionLocked=true) → rejected[n].reason === "locked"
 * 17. Item com schema inválido (homeScore: -1) → rejected[n].reason === "invalid"
 * 18. Lote misto (3 items: 1 válido + 1 locked + 1 not_found) → saved.length===1, rejected.length===2
 * 19. uid nunca vem do body — batch.set() recebe payload com uid da sessão
 *
 * § 8.6 Payload gravado
 * 20. batch.set() chamado com { merge: true } por item gravado
 * 21. Payload de create contém createdAt e updatedAt; sem status ou points
 * 22. Payload de update contém updatedAt mas NÃO createdAt; sem status ou points
 * 23. docId = ${uid}_${matchId} — confirmar via batch.set.mock.calls[0][0] (referência do doc)
 *
 * § 8.7 Erro de commit (500)
 * 24. batch.commit() lança → 500, body { error: "Erro ao salvar o lote de palpites." }
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — devem ser declarados ANTES de qualquer import de runtime.
// ---------------------------------------------------------------------------

const {
  verifySessionCookieMock,
  getFirestoreMock,
  getEffectiveMatchesMock,
  fetchAllMatchesBarrelMock,
  cookiesMock,
  isPredictionLockedMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
  fetchAllMatchesBarrelMock: vi.fn(),
  cookiesMock: vi.fn(),
  isPredictionLockedMock: vi.fn(),
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

// Mock: copaData barrel — só as classes reais de erro, para que instanceof
// funcione corretamente no copaDataErrorResponse. A rota busca partidas via
// getEffectiveMatches (matchSource), mockada logo abaixo.
vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
    fetchAllMatches: fetchAllMatchesBarrelMock,
    fetchAllTeams: vi.fn(),
    CopaDataTimeoutError: client.CopaDataTimeoutError,
    CopaDataFetchError: client.CopaDataFetchError,
    CopaDataParseError: client.CopaDataParseError,
  };
});

// Mock: getEffectiveMatches (matchSource) — fonte efetiva consumida pela rota
// de escrita do palpite (ESPN + overrides manuais), espelhando /api/matches.
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

// Mock: isPredictionLocked (barrel — nunca path direto)
// Usamos importActual para preservar predictionDocId real e mockar apenas isPredictionLocked.
vi.mock("@/features/predictions/lib", async () => {
  const actual = await vi.importActual<typeof import("@/features/predictions/lib")>(
    "@/features/predictions/lib",
  );
  return {
    ...actual,
    isPredictionLocked: isPredictionLockedMock,
  };
});

// Mock: server-only (impede erro fora de contexto Next.js)
vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Import da rota — deve falhar (RED) enquanto a rota não existir.
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/predictions/batch/route";

// ---------------------------------------------------------------------------
// Import de erros reais para instanceof funcionar corretamente no handler.
// ---------------------------------------------------------------------------
import { CopaDataFetchError, CopaDataTimeoutError } from "@/server/copaData/client";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// ---------------------------------------------------------------------------
// Fixtures de dados de teste
// ---------------------------------------------------------------------------

const MOCK_UID = "uid-abc123";
const MOCK_MATCH_ID = "1001";
const MOCK_MATCH_ID_2 = "1002";
const MOCK_SESSION_COOKIE = "session-cookie-value";

/** Partida válida, futura (não bloqueada). */
const MOCK_MATCH_UNLOCKED = {
  id: MOCK_MATCH_ID,
  status: "scheduled" as const,
  kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 dia
  homeTeamId: "team-1",
  awayTeamId: "team-2",
  homeScore: null,
  awayScore: null,
  groupId: "A",
  stage: "grupos" as const,
  venue: null,
  round: "Group Stage - 1",
};

/** Segunda partida válida, futura (não bloqueada). */
const MOCK_MATCH_UNLOCKED_2 = {
  ...MOCK_MATCH_UNLOCKED,
  id: MOCK_MATCH_ID_2,
};

/** Partida travada (já iniciou). */
const MOCK_MATCH_LOCKED = {
  ...MOCK_MATCH_UNLOCKED,
  id: "1003",
  kickoffAt: new Date(Date.now() - 60 * 1000).toISOString(), // -1 min
};

/** Body válido mínimo (1 item). */
const VALID_ITEM = {
  matchId: MOCK_MATCH_ID,
  homeScore: 2,
  awayScore: 1,
};

const VALID_BODY = {
  predictions: [VALID_ITEM],
};

// ---------------------------------------------------------------------------
// Helpers de setup do Firestore mock (com batch())
// ---------------------------------------------------------------------------

function makeFirestoreMockBatch({
  commitThrows = false,
  existingDocIds = [] as string[],
}: {
  commitThrows?: boolean;
  existingDocIds?: string[];
} = {}) {
  const commitMock = commitThrows
    ? vi.fn().mockRejectedValue(new Error("Firestore commit failed"))
    : vi.fn().mockResolvedValue(undefined);

  const setMock = vi.fn(); // WriteBatch.set — síncrono (sem retorno)

  const batchMock = vi.fn().mockReturnValue({
    set: setMock,
    commit: commitMock,
  });

  // getMock responde com base no docId passado para doc()
  // Para simplificar, capturamos o docId chamado e verificamos na lista
  const getMock = vi.fn().mockImplementation(function (this: { _docId?: string }) {
    const docId = (this as { _docId?: string })._docId ?? "";
    return Promise.resolve({ exists: existingDocIds.includes(docId) });
  });

  const docMock = vi.fn().mockImplementation((docId: string) => ({
    get: () => Promise.resolve({ exists: existingDocIds.includes(docId) }),
    _docId: docId,
  }));

  const collectionMock = vi.fn().mockReturnValue({ doc: docMock });

  return { commitMock, setMock, batchMock, getMock, docMock, collectionMock };
}

// ---------------------------------------------------------------------------
// Helpers de setup de cookies e sessão
// ---------------------------------------------------------------------------

function setupSession({
  hasCookie = true,
  cookieValid = true,
  userStatus = "approved" as "approved" | "pending" | "blocked" | null,
} = {}) {
  // Mock cookies()
  const cookieGetMock = vi.fn().mockReturnValue(
    hasCookie ? { name: SESSION_COOKIE_NAME, value: MOCK_SESSION_COOKIE } : undefined,
  );
  cookiesMock.mockResolvedValue({ get: cookieGetMock });

  // Mock verifySessionCookie
  if (!cookieValid) {
    verifySessionCookieMock.mockRejectedValue(new Error("Invalid session cookie"));
  } else {
    verifySessionCookieMock.mockResolvedValue({ uid: MOCK_UID });
  }

  // Mock Firestore — users doc
  const userDocGetMock =
    userStatus === null
      ? vi.fn().mockResolvedValue({ exists: false })
      : vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: userStatus }),
        });

  const userDocMock = vi.fn().mockReturnValue({ get: userDocGetMock });
  const userCollectionMock = vi.fn().mockReturnValue({ doc: userDocMock });

  return { userCollectionMock };
}

// ---------------------------------------------------------------------------
// Helper: monta um NextRequest POST com corpo JSON
// ---------------------------------------------------------------------------

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/predictions/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function postRawRequest(rawBody: string): NextRequest {
  return new Request("http://localhost/api/predictions/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  }) as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Helpers: pool lock (bugfix — batch burlava o lock do admin)
// ---------------------------------------------------------------------------

/**
 * Mock da coleção `pools` — responde a `.doc(groupId).get()`.
 * Espelha o helper homônimo do teste da rota single.
 */
function makePoolCollectionMock({
  poolExists = true,
  predictionsLocked = undefined as boolean | undefined,
}: {
  poolExists?: boolean;
  predictionsLocked?: boolean | undefined;
} = {}) {
  const poolGetMock = vi.fn().mockResolvedValue({
    exists: poolExists,
    data: () => (poolExists ? { predictionsLocked } : undefined),
  });
  const poolDocMock = vi.fn().mockReturnValue({ get: poolGetMock });
  return vi.fn().mockReturnValue({ doc: poolDocMock });
}

/**
 * Variante de setupSession que inclui groupId no doc do usuário — necessária
 * para o pool lock, onde o handler lê `userData.groupId` p/ montar `pools/{id}`.
 */
function setupSessionWithGroup({
  groupId = "group-abc",
  userStatus = "approved" as "approved" | "pending" | "blocked",
} = {}) {
  const cookieGetMock = vi.fn().mockReturnValue({
    name: SESSION_COOKIE_NAME,
    value: MOCK_SESSION_COOKIE,
  });
  cookiesMock.mockResolvedValue({ get: cookieGetMock });
  verifySessionCookieMock.mockResolvedValue({ uid: MOCK_UID });

  const userDocGetMock = vi.fn().mockResolvedValue({
    exists: true,
    data: () => ({ status: userStatus, groupId }),
  });
  const userDocMock = vi.fn().mockReturnValue({ get: userDocGetMock });
  const userCollectionMock = vi.fn().mockReturnValue({ doc: userDocMock });

  return { userCollectionMock };
}

// ---------------------------------------------------------------------------
// Suites de testes
// ---------------------------------------------------------------------------

describe("POST /api/predictions/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por padrão: isPredictionLocked retorna false (partida aberta)
    isPredictionLockedMock.mockReturnValue(false);
    // Por padrão: fetchAllMatches retorna lista com as partidas válidas
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH_UNLOCKED, MOCK_MATCH_UNLOCKED_2]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // § 8.1 Autenticação — 401
  // -------------------------------------------------------------------------

  describe("§8.1 autenticação", () => {
    // Caso 1
    it("(1) retorna 401 quando o cookie de sessão está ausente", async () => {
      setupSession({ hasCookie: false });
      getFirestoreMock.mockReturnValue({ collection: vi.fn(), batch: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Não autenticado.");
    });

    // Caso 2
    it("(2) retorna 401 quando verifySessionCookie lança (cookie inválido/expirado)", async () => {
      setupSession({ hasCookie: true, cookieValid: false });
      getFirestoreMock.mockReturnValue({ collection: vi.fn(), batch: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Não autenticado.");
    });

    // Caso 3
    it("(3) retorna 401 quando users/{uid} não existe no Firestore", async () => {
      const { userCollectionMock } = setupSession({ userStatus: null });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Não autenticado.");
    });
  });

  // -------------------------------------------------------------------------
  // § 8.2 Autorização — 403
  // -------------------------------------------------------------------------

  describe("§8.2 autorização", () => {
    // Caso 4
    it("(4) retorna 403 quando o usuário tem status 'pending'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "pending" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(403);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Acesso não autorizado.");
    });

    // Caso 5
    it("(5) retorna 403 quando o usuário tem status 'blocked'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "blocked" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(403);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Acesso não autorizado.");
    });
  });

  // -------------------------------------------------------------------------
  // § 8.3 Validação do body — 400 / 422
  // -------------------------------------------------------------------------

  describe("§8.3 validação do body", () => {
    function setupApprovedUser() {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });
    }

    // Caso 6
    it("(6) retorna 400 quando o body não é JSON válido", async () => {
      setupApprovedUser();

      const response = await POST(postRawRequest("not-valid-json{"));
      expect(response.status).toBe(400);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Corpo da requisição inválido (JSON esperado).");
    });

    // Caso 7
    it("(7) retorna 422 quando `predictions` está ausente no body", async () => {
      setupApprovedUser();

      const response = await POST(postRequest({}));
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
    });

    // Caso 8
    it("(8) retorna 422 quando `predictions` é um array vazio", async () => {
      setupApprovedUser();

      const response = await POST(postRequest({ predictions: [] }));
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
    });

    // Caso 9
    it("(9) retorna 422 quando `predictions` tem 105 itens (cap excedido)", async () => {
      setupApprovedUser();

      const items = Array.from({ length: 105 }, (_, i) => ({
        matchId: String(1000 + i),
        homeScore: 1,
        awayScore: 0,
      }));

      const response = await POST(postRequest({ predictions: items }));
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
    });

    // Caso 10
    it("(10) ignora uid injetado no body; batch.set usa uid da sessão", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const ATTACKER_UID = "attacker-uid-evil";
      const bodyWithUid = {
        predictions: [{ ...VALID_ITEM, uid: ATTACKER_UID }],
      };

      const response = await POST(postRequest(bodyWithUid));
      expect(response.status).toBe(200);

      // O payload gravado deve ter uid da sessão, não do body
      expect(setMock).toHaveBeenCalledTimes(1);
      const [, payload] = setMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(payload.uid).toBe(MOCK_UID);
      expect(payload.uid).not.toBe(ATTACKER_UID);
    });
  });

  // -------------------------------------------------------------------------
  // § 8.4 fetchAllMatches — erros de upstream
  // -------------------------------------------------------------------------

  describe("§8.4 erros de upstream (fetchAllMatches)", () => {
    // Caso 11
    it("(11) retorna 502 quando fetchAllMatches lança CopaDataFetchError", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });

      getEffectiveMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(502);
    });

    // Caso 12
    it("(12) retorna 504 quando fetchAllMatches lança CopaDataTimeoutError", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock, batch: vi.fn() });

      getEffectiveMatchesMock.mockRejectedValue(new CopaDataTimeoutError(5000));

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(504);
    });
  });

  // -------------------------------------------------------------------------
  // § 8.5 Processamento por item — resposta 200 com saved/rejected
  // -------------------------------------------------------------------------

  // §8.4.1 Fonte do lock — regressão (bug "prazo encerrado" em jogo aberto).
  // O lote DEVE classificar lock contra a fonte EFETIVA (getEffectiveMatches),
  // não contra fetchAllMatches cru (openfootball), que divergia da UI.
  describe("§8.4.1 fonte do lock (regressão)", () => {
    it("consome getEffectiveMatches, nunca fetchAllMatches cru (openfootball)", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [],
      });
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));

      expect(response.status).toBe(200);
      expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1);
      expect(fetchAllMatchesBarrelMock).not.toHaveBeenCalled();
    });
  });

  describe("§8.5 processamento por item", () => {
    // Caso 13
    it("(13) lote de 1 item válido, doc não existe → saved[0].created === true", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [], // doc não existe
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: Array<{ id: string; matchId: string; homeScore: number; awayScore: number; created: boolean }>;
        rejected: unknown[];
      };
      expect(body.saved).toHaveLength(1);
      expect(body.saved[0]!.created).toBe(true);
      expect(body.saved[0]!.matchId).toBe(MOCK_MATCH_ID);
      expect(body.rejected).toHaveLength(0);
    });

    // Caso 14
    it("(14) lote de 1 item válido, doc já existe → saved[0].created === false", async () => {
      const docId = `${MOCK_UID}_${MOCK_MATCH_ID}`;
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [docId],
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: Array<{ created: boolean }>;
        rejected: unknown[];
      };
      expect(body.saved).toHaveLength(1);
      expect(body.saved[0]!.created).toBe(false);
    });

    // Caso 15
    it("(15) item com matchId inexistente → rejected[n].reason === 'not_found'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(
        postRequest({ predictions: [{ matchId: "999999", homeScore: 1, awayScore: 0 }] }),
      );
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: unknown[];
        rejected: Array<{ matchId: string; reason: string; message: string; index: number }>;
      };
      expect(body.saved).toHaveLength(0);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0]!.reason).toBe("not_found");
      expect(body.rejected[0]!.matchId).toBe("999999");
    });

    // Caso 16
    it("(16) item com match bloqueado → rejected[n].reason === 'locked'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch();

      getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH_LOCKED]);
      isPredictionLockedMock.mockReturnValue(true);

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(
        postRequest({ predictions: [{ matchId: MOCK_MATCH_LOCKED.id, homeScore: 1, awayScore: 0 }] }),
      );
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: unknown[];
        rejected: Array<{ matchId: string; reason: string; message: string }>;
      };
      expect(body.saved).toHaveLength(0);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0]!.reason).toBe("locked");
      expect(body.rejected[0]!.message).toBe("O prazo para palpites nesta partida foi encerrado.");
    });

    // Caso 17
    it("(17) item com schema inválido (homeScore: -1) → rejected[n].reason === 'invalid'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(
        postRequest({ predictions: [{ matchId: MOCK_MATCH_ID, homeScore: -1, awayScore: 0 }] }),
      );
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: unknown[];
        rejected: Array<{ reason: string }>;
      };
      expect(body.saved).toHaveLength(0);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0]!.reason).toBe("invalid");
    });

    // Caso 18
    it("(18) lote misto (1 válido + 1 locked + 1 not_found) → saved.length===1, rejected.length===2", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [],
      });

      // Match 1001 aberto, Match 1003 locked, 9999 inexistente
      getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH_UNLOCKED, MOCK_MATCH_LOCKED]);
      isPredictionLockedMock.mockImplementation(
        (match: { id: string }) => match.id === MOCK_MATCH_LOCKED.id,
      );

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(
        postRequest({
          predictions: [
            { matchId: MOCK_MATCH_ID, homeScore: 1, awayScore: 0 },       // válido
            { matchId: MOCK_MATCH_LOCKED.id, homeScore: 0, awayScore: 0 }, // locked
            { matchId: "999999", homeScore: 2, awayScore: 1 },             // not_found
          ],
        }),
      );
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        saved: unknown[];
        rejected: Array<{ reason: string }>;
      };
      expect(body.saved).toHaveLength(1);
      expect(body.rejected).toHaveLength(2);

      const reasons = body.rejected.map((r) => r.reason);
      expect(reasons).toContain("locked");
      expect(reasons).toContain("not_found");
    });

    // Caso 19
    it("(19) uid nunca vem do body — batch.set() recebe payload com uid da sessão", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const EVIL_UID = "evil-uid";
      const response = await POST(
        postRequest({
          predictions: [{ matchId: MOCK_MATCH_ID, homeScore: 1, awayScore: 0, uid: EVIL_UID }],
        }),
      );
      expect(response.status).toBe(200);

      expect(setMock).toHaveBeenCalledTimes(1);
      const [, payload] = setMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(payload.uid).toBe(MOCK_UID);
      expect(payload.uid).not.toBe(EVIL_UID);
    });
  });

  // -------------------------------------------------------------------------
  // § 8.6 Payload gravado
  // -------------------------------------------------------------------------

  describe("§8.6 payload gravado", () => {
    // Caso 20
    it("(20) batch.set() é chamado com { merge: true } por item gravado", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      await POST(postRequest(VALID_BODY));

      expect(setMock).toHaveBeenCalledTimes(1);
      const [, , options] = setMock.mock.calls[0] as [unknown, unknown, unknown];
      expect(options).toEqual({ merge: true });
    });

    // Caso 21
    it("(21) payload de create contém createdAt e updatedAt; sem status ou points", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [], // doc não existe → create
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      await POST(postRequest(VALID_BODY));

      expect(setMock).toHaveBeenCalledTimes(1);
      const [, payload] = setMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(payload.createdAt).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
      expect(payload.status).toBeUndefined();
      expect(payload.points).toBeUndefined();
    });

    // Caso 22
    it("(22) payload de update contém updatedAt mas NÃO createdAt; sem status ou points", async () => {
      const docId = `${MOCK_UID}_${MOCK_MATCH_ID}`;
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, collectionMock } = makeFirestoreMockBatch({
        existingDocIds: [docId], // doc existe → update
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      await POST(postRequest(VALID_BODY));

      expect(setMock).toHaveBeenCalledTimes(1);
      const [, payload] = setMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(payload.updatedAt).toBeDefined();
      expect(payload.createdAt).toBeUndefined();
      expect(payload.status).toBeUndefined();
      expect(payload.points).toBeUndefined();
    });

    // Caso 23
    it("(23) docId = ${uid}_${matchId} — confirmar via batch.set.mock.calls[0][0]", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, setMock, docMock, collectionMock } = makeFirestoreMockBatch();

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      await POST(postRequest(VALID_BODY));

      // Verifica que docMock foi chamado com o docId correto
      expect(docMock).toHaveBeenCalledWith(`${MOCK_UID}_${MOCK_MATCH_ID}`);

      // Verifica que o primeiro argumento de setMock é o docRef retornado pelo docMock
      expect(setMock).toHaveBeenCalledTimes(1);
      const [docRef] = setMock.mock.calls[0] as [{ _docId: string }, unknown, unknown];
      expect(docRef._docId).toBe(`${MOCK_UID}_${MOCK_MATCH_ID}`);
    });
  });

  // -------------------------------------------------------------------------
  // § 8.7 Erro de commit — 500
  // -------------------------------------------------------------------------

  describe("§8.7 erro de commit", () => {
    // Caso 24
    it("(24) batch.commit() lança → 500, body { error: 'Erro ao salvar o lote de palpites.' }", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({
        commitThrows: true,
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(500);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Erro ao salvar o lote de palpites.");
    });
  });

  // -------------------------------------------------------------------------
  // § 8.8 Pool lock — predictionsLocked
  // Bugfix: o mass-fill (batch) NÃO checava o lock do pool, burlando o toggle
  // do admin. Espelha o enforcement da rota single (/api/predictions).
  // -------------------------------------------------------------------------

  describe("§8.8 pool lock (predictionsLocked)", () => {
    // Case A: pool bloqueado → 423, lote inteiro rejeitado, sem fetch de partidas.
    it("(A) retorna 423 quando o pool do usuário está bloqueado (predictionsLocked: true)", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({
        poolExists: true,
        predictionsLocked: true,
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return { doc: vi.fn() }; // predictions não é alcançado
        }),
        batch: vi.fn(),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(423);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Os palpites deste grupo estão bloqueados.");
      // Lock executa antes de buscar partidas.
      expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    });

    // Case B: predictionsLocked false → segue e grava o lote normalmente.
    it("(B) prossegue e grava o lote quando predictionsLocked é false", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({
        poolExists: true,
        predictionsLocked: false,
      });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({ existingDocIds: [] });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { saved: unknown[]; rejected: unknown[] };
      expect(body.saved).toHaveLength(1);
    });

    // Case C: groupId ausente → não consulta pools (fail-open; sem regressão).
    it("(C) não consulta pools quando groupId está ausente no doc do usuário", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const poolDocSpy = vi.fn();
      const poolCollectionMock = vi.fn().mockReturnValue({ doc: poolDocSpy });
      const { batchMock, collectionMock } = makeFirestoreMockBatch({ existingDocIds: [] });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
        batch: batchMock,
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(200);
      expect(poolDocSpy).not.toHaveBeenCalled();
    });
  });
});
