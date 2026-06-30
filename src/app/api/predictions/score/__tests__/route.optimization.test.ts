/**
 * Testes TDD (red-first) da otimização de custo do cron de pontuação
 * (scoring-write-cost TASK-03).
 *
 * Cobrem o NOVO comportamento sobre o `POST /api/predictions/score`:
 *  - Filtro grosso (B): partida com `matchResultFingerprint` igual ao registrado
 *    em `score_state/cron` é PULADA por completo (sem query de palpites, sem write),
 *    contabilizada em `skippedMatches`.
 *  - Filtro fino (A): palpite cujo `{status, points}` recalculado é igual ao
 *    persistido NÃO é regravado (`set` não chamado).
 *  - `score_state` é gravado só quando o mapa muda; resposta ganha `skippedMatches`.
 *  - Placar corrigido (hash diferente) → re-processa e regrava.
 *
 * Estes testes FALHAM contra a implementação atual (que sempre lê todos os
 * palpites, sempre regrava e não retorna `skippedMatches`).
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { matchResultFingerprint } from "@/features/predictions/lib";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  verifySessionCookieMock,
  getFirestoreMock,
  getEffectiveMatchesMock,
  cookiesMock,
  scorePredictionMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
  cookiesMock: vi.fn(),
  scorePredictionMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("@/server/copaData", () => ({
  fetchAllTeams: vi.fn(),
}));

vi.mock("@/features/predictions/lib", async () => {
  const actual = await vi.importActual<typeof import("@/features/predictions/lib")>(
    "@/features/predictions/lib",
  );
  return { ...actual, scorePrediction: scorePredictionMock };
});

// Notificações: stub neutro (best-effort, fora do escopo desta suite).
vi.mock("@/server/notifications", () => ({
  fetchPreferencesMap: vi.fn().mockResolvedValue(new Map()),
  shouldDeliver: vi.fn().mockReturnValue(false),
  notifyScoreHit: vi.fn(),
  writeNotifications: vi.fn().mockResolvedValue([]),
  sendPushForNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/predictions/score/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SCORE_SECRET = "super-secret-cron-token-abc123";

const MATCH_FINISHED = {
  id: "5001",
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  homeTeamId: "team-1",
  awayTeamId: "team-2",
  homeScore: 2,
  awayScore: 1,
  groupId: "A",
  stage: "grupos" as const,
  venue: null,
  round: 1,
};

const PREDICTION_BASE = {
  uid: "user-123",
  matchId: MATCH_FINISHED.id,
  homeScore: 2,
  awayScore: 1,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

// ---------------------------------------------------------------------------
// Firestore mock builder (com suporte a score_state)
// ---------------------------------------------------------------------------

function makeDocSnapshot(
  data: Record<string, unknown>,
  setMock: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
) {
  return { data: () => data, ref: { set: setMock } };
}

/**
 * @param scoreStateMatches  mapa inicial { matchId: hash } no doc score_state/cron.
 *                           `null` = doc ausente.
 * @param predictionsByMatch matchId → array de { data, setMock }
 */
function makeFirestoreMock({
  scoreStateMatches = null as Record<string, string> | null,
  predictionsByMatch = {} as Record<
    string,
    { data: Record<string, unknown>; setMock: ReturnType<typeof vi.fn> }[]
  >,
}: {
  scoreStateMatches?: Record<string, string> | null;
  predictionsByMatch?: Record<
    string,
    { data: Record<string, unknown>; setMock: ReturnType<typeof vi.fn> }[]
  >;
} = {}) {
  const whereMock = vi.fn().mockImplementation((_f: string, _op: string, matchId: string) => {
    const entries = predictionsByMatch[matchId] ?? [];
    const docs = entries.map((e) => makeDocSnapshot(e.data, e.setMock));
    return {
      get: vi.fn().mockResolvedValue({ empty: docs.length === 0, docs }),
    };
  });

  const scoreStateGetMock = vi.fn().mockResolvedValue(
    scoreStateMatches === null
      ? { exists: false }
      : {
          exists: true,
          data: () => ({
            matches: scoreStateMatches,
            updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          }),
        },
  );
  const scoreStateSetMock = vi.fn().mockResolvedValue(undefined);
  const scoreStateDocMock = vi
    .fn()
    .mockReturnValue({ get: scoreStateGetMock, set: scoreStateSetMock });

  getFirestoreMock.mockReturnValue({
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === "predictions") return { where: whereMock };
      if (name === "score_state") return { doc: scoreStateDocMock };
      if (name === "users") return { doc: vi.fn() };
      return {};
    }),
  });

  return { whereMock, scoreStateGetMock, scoreStateSetMock };
}

function postWithSecret(secret: string): NextRequest {
  return new Request("http://localhost/api/predictions/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
  }) as unknown as NextRequest;
}

// ---------------------------------------------------------------------------

describe("scoring-write-cost — otimização de reads/writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SCORE_SECRET", MOCK_SCORE_SECRET);
    getEffectiveMatchesMock.mockResolvedValue([MATCH_FINISHED]);
    // Default: palpite exato → correct/10.
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // ── Filtro grosso (B) ─────────────────────────────────────────────────────

  describe("filtro grosso — pula partida com hash inalterado", () => {
    it("não consulta palpites quando o fingerprint bate o score_state (CA1)", async () => {
      const { whereMock, scoreStateSetMock } = makeFirestoreMock({
        scoreStateMatches: { [MATCH_FINISHED.id]: matchResultFingerprint(MATCH_FINISHED) },
      });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);

      // Nenhuma query de palpites para a partida pulada.
      expect(whereMock).not.toHaveBeenCalled();
      // Mapa não mudou → nenhum write em score_state.
      expect(scoreStateSetMock).not.toHaveBeenCalled();

      const body = (await res.json()) as {
        scoredMatches: number;
        updatedPredictions: number;
        skippedMatches: number;
      };
      expect(body.scoredMatches).toBe(1);
      expect(body.updatedPredictions).toBe(0);
      expect(body.skippedMatches).toBe(1);
    });

    it("processa a partida quando o hash difere (placar corrigido — CA3)", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      const { whereMock, scoreStateSetMock } = makeFirestoreMock({
        // Hash antigo (placar diferente) → não bate o atual.
        scoreStateMatches: { [MATCH_FINISHED.id]: "finished|1|0" },
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [{ data: { ...PREDICTION_BASE }, setMock }],
        },
      });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);

      expect(whereMock).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledTimes(1); // first-score → grava
      // Mapa mudou (novo hash) → score_state gravado.
      expect(scoreStateSetMock).toHaveBeenCalledTimes(1);

      const body = (await res.json()) as { skippedMatches: number; updatedPredictions: number };
      expect(body.skippedMatches).toBe(0);
      expect(body.updatedPredictions).toBe(1);
    });
  });

  // ── Filtro fino (A) ───────────────────────────────────────────────────────

  describe("filtro fino — só grava palpite alterado", () => {
    it("NÃO regrava quando { status, points } já é igual ao recalculado", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      makeFirestoreMock({
        scoreStateMatches: null, // doc ausente → partida é processada
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [
            // Já pontuado igual ao computado (correct/10).
            { data: { ...PREDICTION_BASE, status: "correct", points: 10 }, setMock },
          ],
        },
      });
      scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);

      expect(setMock).not.toHaveBeenCalled(); // sem write redundante

      const body = (await res.json()) as { updatedPredictions: number };
      expect(body.updatedPredictions).toBe(0);
    });

    it("regrava quando o { status, points } recalculado difere do persistido", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      makeFirestoreMock({
        scoreStateMatches: null,
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [
            { data: { ...PREDICTION_BASE, status: "wrong", points: 0 }, setMock },
          ],
        },
      });
      scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);

      expect(setMock).toHaveBeenCalledTimes(1);
      const [payload, options] = setMock.mock.calls[0] as [Record<string, unknown>, unknown];
      expect(options).toEqual({ merge: true });
      expect(payload).toEqual({ status: "correct", points: 10 });

      const body = (await res.json()) as { updatedPredictions: number };
      expect(body.updatedPredictions).toBe(1);
    });

    it("grava palpite ainda sem pontuação persistida (first-score)", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      makeFirestoreMock({
        scoreStateMatches: null,
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [{ data: { ...PREDICTION_BASE }, setMock }],
        },
      });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);
      expect(setMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── score_state write ─────────────────────────────────────────────────────

  describe("persistência do score_state", () => {
    it("grava o doc quando a partida é processada pela 1ª vez (mapa vazio → populado)", async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);
      const { scoreStateSetMock } = makeFirestoreMock({
        scoreStateMatches: null,
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [{ data: { ...PREDICTION_BASE }, setMock }],
        },
      });

      await POST(postWithSecret(MOCK_SCORE_SECRET));

      expect(scoreStateSetMock).toHaveBeenCalledTimes(1);
      const [payload] = scoreStateSetMock.mock.calls[0] as [
        { matches: Record<string, string>; updatedAt: string },
      ];
      expect(payload.matches[MATCH_FINISHED.id]).toBe(matchResultFingerprint(MATCH_FINISHED));
      expect(typeof payload.updatedAt).toBe("string");
    });
  });

  // ── Robustez: doc malformado não congela a partida ────────────────────────

  describe("doc malformado não congela a partida (regressão C1)", () => {
    it("pontua os válidos mas NÃO avança o hash da partida com doc malformado", async () => {
      const validSet = vi.fn().mockResolvedValue(undefined);
      const { scoreStateSetMock } = makeFirestoreMock({
        scoreStateMatches: null, // doc ausente → partida processada
        predictionsByMatch: {
          [MATCH_FINISHED.id]: [
            { data: { ...PREDICTION_BASE }, setMock: validSet }, // válido
            { data: { not: "a-prediction" }, setMock: vi.fn() }, // falha predictionSchema
          ],
        },
      });
      scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      expect(res.status).toBe(200);

      // O palpite válido é pontuado normalmente...
      expect(validSet).toHaveBeenCalledTimes(1);
      // ...mas a partida NÃO é marcada como totalmente pontuada: o hash não pode
      // avançar com um doc não-parseável, senão a partida é pulada para sempre e
      // o palpite some do ranking se voltar a ser válido (CA3). Sem write em
      // score_state → próximo run re-processa.
      expect(scoreStateSetMock).not.toHaveBeenCalled();
    });
  });

  // ── Resposta ──────────────────────────────────────────────────────────────

  describe("shape da resposta", () => {
    it("inclui skippedMatches no corpo 200", async () => {
      makeFirestoreMock({
        scoreStateMatches: null,
        predictionsByMatch: { [MATCH_FINISHED.id]: [] },
      });

      const res = await POST(postWithSecret(MOCK_SCORE_SECRET));
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toHaveProperty("scoredMatches");
      expect(body).toHaveProperty("updatedPredictions");
      expect(body).toHaveProperty("skippedMatches");
    });
  });
});
