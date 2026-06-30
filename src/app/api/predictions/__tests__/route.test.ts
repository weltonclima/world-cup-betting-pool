/**
 * Testes TDD (red-first) do Route Handler POST /api/predictions (TASK-03).
 *
 * A rota ainda NÃO existe — todos os testes devem falhar (red) porque o
 * import de `@/app/api/predictions/route` lançará erro de módulo ausente.
 *
 * Mocks:
 * - `@/server/firebaseAdmin`     → getAdminAuth (verifySessionCookie) + getAdminFirestore
 * - `next/headers`               → cookies (httpOnly session cookie)
 * - `@/server/copaData/matchSource` → getEffectiveMatches
 * - `@/features/predictions/lib` → isPredictionLocked (spy — usa implementação real para casos 5/6/7)
 *
 * Casos cobertos:
 *  1. 401 — sem cookie de sessão
 *  2. 401 — cookie inválido (verifySessionCookie lança)
 *  3. 403 — usuário com status "pending"
 *  4. 403 — usuário com status "blocked"
 *  5. 422 — body inválido: matchId vazio
 *  6. 422 — body inválido: homeScore negativo
 *  7. 422 — body inválido: homeScore decimal
 *  8. 422 — body inválido: campos ausentes
 *  9. 404 — matchId inexistente em fetchAllMatches
 * 10. 423 — partida travada (isPredictionLocked retorna true)
 * 11. 201 — create de palpite novo (doc não existe)
 * 12. 200 — update de palpite existente (doc já existe)
 * 13. uid vem da sessão; uid no body é ignorado (stripped)
 * 14. payload gravado contém uid, matchId, homeScore, awayScore, updatedAt
 * 15. payload de create inclui createdAt; update NÃO sobrescreve createdAt
 * 16. payload NUNCA contém status nem points
 * 17. set() é chamado com { merge: true }
 * 18. doc id é ${uid}_${matchId}
 * 19. 502 — getEffectiveMatches lança EspnFetchError
 * 20. 500 — Firestore set() lança
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
  cookiesMock,
  isPredictionLockedMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
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

// Mock: copaData barrel — fetchAllTeams stub. A rota busca partidas via
// getEffectiveMatches (matchSource), mockada logo abaixo. As classes de erro
// vivem em espnClient e são mapeadas por copaDataErrorResponse.
vi.mock("@/server/copaData", () => ({
  fetchAllTeams: vi.fn(),
}));

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
import { POST } from "@/app/api/predictions/route";

// ---------------------------------------------------------------------------
// Import de erros reais para instanceof funcionar corretamente no handler.
// ---------------------------------------------------------------------------
import { EspnFetchError } from "@/server/copaData/espnClient";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// ---------------------------------------------------------------------------
// Fixtures de dados de teste
// ---------------------------------------------------------------------------

const MOCK_UID = "uid-abc123";
const MOCK_MATCH_ID = "1001";
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

/** Partida travada (já iniciou). */
const MOCK_MATCH_LOCKED = {
  ...MOCK_MATCH_UNLOCKED,
  id: "1002",
  kickoffAt: new Date(Date.now() - 60 * 1000).toISOString(), // -1 min
};

/** Body válido mínimo. */
const VALID_BODY = {
  matchId: MOCK_MATCH_ID,
  homeScore: 2,
  awayScore: 1,
};

// ---------------------------------------------------------------------------
// Helpers de setup do Firestore mock
// ---------------------------------------------------------------------------

function makeFirestoreMock({
  docExists = false,
  setThrows = false,
}: {
  docExists?: boolean;
  setThrows?: boolean;
} = {}) {
  const setMock = setThrows
    ? vi.fn().mockRejectedValue(new Error("Firestore write failed"))
    : vi.fn().mockResolvedValue(undefined);

  const getMock = vi.fn().mockResolvedValue({ exists: docExists });

  const docMock = vi.fn().mockReturnValue({
    get: getMock,
    set: setMock,
  });

  const collectionMock = vi.fn().mockReturnValue({ doc: docMock });

  getFirestoreMock.mockReturnValue({ collection: collectionMock });

  return { setMock, getMock, docMock, collectionMock };
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
  return new Request("http://localhost/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Helpers: pool lock (TASK-02)
// ---------------------------------------------------------------------------

/**
 * Cria mock da coleção `pools` para testes de pool lock.
 * Retorna um collectionMock que responde a `.doc(groupId).get()`.
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
 * Variante de setupSession que inclui groupId no doc do usuário.
 * Necessário para testes de pool lock (TASK-02), onde o route handler
 * lê `userData.groupId` para montar `pools/{groupId}`.
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

describe("POST /api/predictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por padrão: isPredictionLocked retorna false (partida aberta)
    isPredictionLockedMock.mockReturnValue(false);
    // Por padrão: fetchAllMatches retorna lista com a partida válida
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH_UNLOCKED]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Autenticação — 401
  // -------------------------------------------------------------------------

  describe("autenticação", () => {
    it("retorna 401 quando o cookie de sessão está ausente", async () => {
      setupSession({ hasCookie: false });
      // Firestore não será chamado; mock simples para evitar erro
      getFirestoreMock.mockReturnValue({ collection: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Não autenticado.");
    });

    it("retorna 401 quando verifySessionCookie lança (cookie inválido/expirado)", async () => {
      setupSession({ hasCookie: true, cookieValid: false });
      getFirestoreMock.mockReturnValue({ collection: vi.fn() });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(401);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Não autenticado.");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Autorização — 403
  // -------------------------------------------------------------------------

  describe("autorização", () => {
    it("retorna 403 quando o usuário tem status 'pending'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "pending" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(403);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Acesso não autorizado.");
    });

    it("retorna 403 quando o usuário tem status 'blocked'", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "blocked" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(403);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Acesso não autorizado.");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Validação do body — 422
  // -------------------------------------------------------------------------

  describe("validação do body", () => {
    function setupApprovedUser() {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      // getFirestoreMock retorna o mock de usuário para a leitura de auth,
      // mas a escrita não chega a ser chamada nesses casos.
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });
    }

    it("retorna 422 quando matchId é uma string vazia", async () => {
      setupApprovedUser();

      const response = await POST(
        postRequest({ matchId: "", homeScore: 1, awayScore: 0 }),
      );
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
      expect(Array.isArray(body.issues)).toBe(true);
    });

    it("retorna 422 quando homeScore é negativo", async () => {
      setupApprovedUser();

      const response = await POST(
        postRequest({ matchId: MOCK_MATCH_ID, homeScore: -1, awayScore: 0 }),
      );
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
    });

    it("retorna 422 quando homeScore é decimal (não inteiro)", async () => {
      setupApprovedUser();

      const response = await POST(
        postRequest({ matchId: MOCK_MATCH_ID, homeScore: 1.5, awayScore: 0 }),
      );
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
    });

    it("retorna 422 quando campos obrigatórios estão ausentes", async () => {
      setupApprovedUser();

      // Body sem homeScore e awayScore
      const response = await POST(postRequest({ matchId: MOCK_MATCH_ID }));
      expect(response.status).toBe(422);

      const body = (await response.json()) as { error: string; issues: unknown[] };
      expect(body.error).toBe("Dados de entrada inválidos.");
      expect(body.issues).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Partida não encontrada — 404
  // -------------------------------------------------------------------------

  describe("partida não encontrada", () => {
    it("retorna 404 quando matchId não existe em fetchAllMatches", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });

      // fetchAllMatches retorna lista sem a partida requisitada
      getEffectiveMatchesMock.mockResolvedValue([]);

      const response = await POST(
        postRequest({ matchId: "999999", homeScore: 1, awayScore: 0 }),
      );
      expect(response.status).toBe(404);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Partida não encontrada.");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Partida bloqueada — 423
  // -------------------------------------------------------------------------

  describe("partida bloqueada", () => {
    it("retorna 423 quando isPredictionLocked retorna true", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });

      getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH_LOCKED]);
      isPredictionLockedMock.mockReturnValue(true);

      const response = await POST(
        postRequest({ matchId: MOCK_MATCH_LOCKED.id, homeScore: 1, awayScore: 0 }),
      );
      expect(response.status).toBe(423);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("O prazo para palpites nesta partida foi encerrado.");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Create bem-sucedido — 201
  // -------------------------------------------------------------------------

  describe("create de palpite novo", () => {
    it("retorna 201 com { prediction } quando o doc não existe", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });

      // Firestore: users doc para auth + predictions doc para upsert
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { setMock, docMock, collectionMock } = makeFirestoreMock({ docExists: false });

      // getFirestoreMock precisa retornar o mock de users na 1ª chamada (.collection("users"))
      // e o mock de predictions na 2ª chamada (.collection("predictions")).
      // Usamos implementação baseada no nome da coleção.
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(201);

      const body = (await response.json()) as {
        prediction: {
          id: string;
          uid: string;
          matchId: string;
          homeScore: number;
          awayScore: number;
        };
      };
      expect(body.prediction).toBeDefined();
      expect(body.prediction.uid).toBe(MOCK_UID);
      expect(body.prediction.matchId).toBe(MOCK_MATCH_ID);
      expect(body.prediction.homeScore).toBe(VALID_BODY.homeScore);
      expect(body.prediction.awayScore).toBe(VALID_BODY.awayScore);
      // id determinístico: ${uid}_${matchId}
      expect(body.prediction.id).toBe(`${MOCK_UID}_${MOCK_MATCH_ID}`);

      // set() deve ter sido chamado com { merge: true }
      expect(setMock).toHaveBeenCalledTimes(1);
      const [payload, options] = setMock.mock.calls[0] as [Record<string, unknown>, unknown];
      expect(options).toEqual({ merge: true });

      // Payload contém campos obrigatórios
      expect(payload.uid).toBe(MOCK_UID);
      expect(payload.matchId).toBe(MOCK_MATCH_ID);
      expect(payload.homeScore).toBe(VALID_BODY.homeScore);
      expect(payload.awayScore).toBe(VALID_BODY.awayScore);
      expect(payload.updatedAt).toBeDefined();
      // Create: createdAt deve estar no payload
      expect(payload.createdAt).toBeDefined();

      // Nunca gravar status nem points
      expect(payload.status).toBeUndefined();
      expect(payload.points).toBeUndefined();
    });

    it("usa doc id ${uid}_${matchId} para a coleção predictions", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { docMock, collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      await POST(postRequest(VALID_BODY));

      // docMock foi chamado com o id determinístico
      expect(docMock).toHaveBeenCalledWith(`${MOCK_UID}_${MOCK_MATCH_ID}`);
    });
  });

  // -------------------------------------------------------------------------
  // 6.1. Fonte do lock — regressão (bug "prazo encerrado" em jogo aberto)
  // -------------------------------------------------------------------------
  // A rota DEVE avaliar o lock contra a fonte EFETIVA (getEffectiveMatches:
  // ESPN + overrides manuais), a mesma que a UI consome.
  describe("fonte do lock (regressão)", () => {
    it("consome getEffectiveMatches", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { collectionMock } = makeFirestoreMock({ docExists: false });
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));

      // Jogo aberto na fonte efetiva → palpite aceito.
      expect(response.status).toBe(201);
      // Fonte efetiva consultada.
      expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Update bem-sucedido — 200
  // -------------------------------------------------------------------------

  describe("update de palpite existente", () => {
    it("retorna 200 quando o doc já existe", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { setMock, collectionMock } = makeFirestoreMock({ docExists: true });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        prediction: { id: string; uid: string; matchId: string };
      };
      expect(body.prediction).toBeDefined();
      expect(body.prediction.uid).toBe(MOCK_UID);

      // set() com merge: true
      expect(setMock).toHaveBeenCalledTimes(1);
      const [payload, options] = setMock.mock.calls[0] as [Record<string, unknown>, unknown];
      expect(options).toEqual({ merge: true });

      // Update: createdAt NÃO deve estar no payload (preservado via merge)
      expect(payload.createdAt).toBeUndefined();
      // updatedAt deve estar presente
      expect(payload.updatedAt).toBeDefined();

      // Nunca gravar status nem points
      expect(payload.status).toBeUndefined();
      expect(payload.points).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 8. uid vem da sessão, NUNCA do body
  // -------------------------------------------------------------------------

  describe("segurança — uid da sessão, não do body", () => {
    it("ignora uid enviado no body e usa o uid da sessão", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { setMock, collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      const ATTACKER_UID = "attacker-uid-evil";
      const bodyWithUid = { ...VALID_BODY, uid: ATTACKER_UID };

      const response = await POST(postRequest(bodyWithUid));
      // Deve ser aceito (201) — uid do body é stripped
      expect(response.status).toBe(201);

      // Payload gravado usa o uid da sessão, não o do body
      const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.uid).toBe(MOCK_UID);
      expect(payload.uid).not.toBe(ATTACKER_UID);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Erros de upstream — getEffectiveMatches lança
  // -------------------------------------------------------------------------

  describe("erros de integração com copaData", () => {
    it("retorna 502 quando getEffectiveMatches lança EspnFetchError", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      getFirestoreMock.mockReturnValue({ collection: userCollectionMock });

      getEffectiveMatchesMock.mockRejectedValue(new EspnFetchError(503));

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(502);
    });
  });

  // -------------------------------------------------------------------------
  // 10. Erro de escrita no Firestore — 500
  // -------------------------------------------------------------------------

  describe("erro de escrita no Firestore", () => {
    it("retorna 500 quando docRef.set() lança", async () => {
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const { collectionMock } = makeFirestoreMock({ setThrows: true });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(500);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Erro ao salvar o palpite.");
    });
  });

  // -------------------------------------------------------------------------
  // 11. Pool lock — predictionsLocked (TASK-02)
  // Casos A-F: RED antes da implementação, GREEN após.
  // -------------------------------------------------------------------------

  describe("pool lock (predictionsLocked)", () => {
    // Case A: pool locked → 423
    it("retorna 423 com mensagem de pool lock quando predictionsLocked é true", async () => {
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
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(423);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Os palpites deste grupo estão bloqueados.");
    });

    // Case B: predictionsLocked: false → passa normalmente
    it("prossegue normalmente quando predictionsLocked é false", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({
        poolExists: true,
        predictionsLocked: false,
      });
      const { collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(201);
    });

    // Case C: predictionsLocked ausente → fail-open
    it("prossegue normalmente quando predictionsLocked está ausente no doc do pool", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({
        poolExists: true,
        predictionsLocked: undefined,
      });
      const { collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(201);
    });

    // Case D: pool doc não existe → fail-open
    it("prossegue normalmente quando o doc do pool não existe no Firestore", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({ poolExists: false });
      const { collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(201);
    });

    // Case E: groupId ausente no user doc → skip pool check, sem query em pools/undefined
    it("prossegue normalmente e não consulta pools quando groupId está ausente no doc do usuário", async () => {
      // setupSession sem groupId simula usuário em transição (TASK-12 backfill pendente)
      const { userCollectionMock } = setupSession({ userStatus: "approved" });
      const poolDocSpy = vi.fn();
      const poolCollectionMock = vi.fn().mockReturnValue({ doc: poolDocSpy });
      const { collectionMock } = makeFirestoreMock({ docExists: false });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(201);
      // Confirma ausência de query em pools/undefined
      expect(poolDocSpy).not.toHaveBeenCalled();
    });

    // Case F: pool lock executa antes de buscar partida — fetchAllMatches não é chamado
    it("retorna pool-lock 423 antes de buscar partida — fetchAllMatches não é invocado", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const poolCollectionMock = makePoolCollectionMock({
        poolExists: true,
        predictionsLocked: true,
      });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return { doc: vi.fn() };
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      expect(response.status).toBe(423);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Os palpites deste grupo estão bloqueados.");
      // Pool lock retorna antes de fetchAllMatches — confirma ordem de verificação
      expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    });

    // Case G: erro no read do pool → fail-open (não bloqueia o palpite)
    it("prossegue normalmente quando pools.doc().get() lança (fail-open por erro de leitura)", async () => {
      const { userCollectionMock } = setupSessionWithGroup({ groupId: "group-abc" });
      const { collectionMock } = makeFirestoreMock({ docExists: false });

      const poolGetMock = vi.fn().mockRejectedValue(new Error("Firestore pool read failed"));
      const poolDocMock = vi.fn().mockReturnValue({ get: poolGetMock });
      const poolCollectionMock = vi.fn().mockReturnValue({ doc: poolDocMock });

      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockImplementation((name: string) => {
          if (name === "users") return userCollectionMock();
          if (name === "pools") return poolCollectionMock();
          return collectionMock();
        }),
      });

      const response = await POST(postRequest(VALID_BODY));
      // Erro no read do pool não deve bloquear o participante — fail-open
      expect(response.status).toBe(201);
    });
  });
});
