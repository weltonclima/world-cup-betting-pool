/**
 * Testes do fan-out de notificações `games` no Route Handler
 * POST /api/predictions/score (TASK-04).
 *
 * Foco: o disparo best-effort de notificações após a pontuação — NÃO a
 * pontuação em si (coberta em route.test.ts). Mocks:
 * - `@/server/notifications` → fetchPreferencesMap + writeNotifications espionados;
 *   shouldDeliver + notifyScoreHit usam implementação real (gate + copy reais).
 * - `@/server/copaData/teamRegistry` → resolveTeamByCode (resolução de nome).
 * - autorização sempre via header secret (sem cookie/sessão).
 *
 * Casos:
 *  1. correct → notificação `games` de placar para o uid dono.
 *  2. partial não-draw → "vencedor"; partial draw → "empate".
 *  3. wrong/pending → não notifica (writeNotifications não chamado).
 *  4. games:false → palpite acertado não vira item.
 *  5. best-effort: writeNotifications rejeita → response ainda 200.
 *  6. nome de time resolvido + fallback ao código.
 *  7. owner-targeting: editedBy setado ainda notifica prediction.uid.
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationPreferences } from "@/schemas/notificationPreferences";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  getFirestoreMock,
  fetchAllMatchesMock,
  scorePredictionMock,
  fetchPreferencesMapMock,
  writeNotificationsMock,
  sendPushForNotificationsMock,
  resolveTeamByCodeMock,
} = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
  fetchAllMatchesMock: vi.fn(),
  scorePredictionMock: vi.fn(),
  fetchPreferencesMapMock: vi.fn(),
  writeNotificationsMock: vi.fn(),
  sendPushForNotificationsMock: vi.fn(),
  resolveTeamByCodeMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: vi.fn() }),
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
    fetchAllMatches: fetchAllMatchesMock,
    fetchAllTeams: vi.fn(),
    CopaDataTimeoutError: client.CopaDataTimeoutError,
    CopaDataFetchError: client.CopaDataFetchError,
    CopaDataParseError: client.CopaDataParseError,
  };
});

vi.mock("@/server/copaData/teamRegistry", () => ({
  resolveTeamByCode: resolveTeamByCodeMock,
}));

vi.mock("@/features/predictions/lib", async () => {
  const actual = await vi.importActual<typeof import("@/features/predictions/lib")>(
    "@/features/predictions/lib",
  );
  return { ...actual, scorePrediction: scorePredictionMock };
});

// Mantém shouldDeliver + notifyScoreHit reais (gate + copy); só fetchPreferencesMap
// e writeNotifications são espionados.
vi.mock("@/server/notifications", async () => {
  const actual = await vi.importActual<typeof import("@/server/notifications")>(
    "@/server/notifications",
  );
  return {
    ...actual,
    fetchPreferencesMap: fetchPreferencesMapMock,
    writeNotifications: writeNotificationsMock,
    sendPushForNotifications: sendPushForNotificationsMock,
  };
});

vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/predictions/score/route";
import type { NotificationCreate } from "@/server/notifications";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SCORE_SECRET = "super-secret-cron-token-abc123";

const MATCH = {
  id: "5001",
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  homeTeamId: "BRA",
  awayTeamId: "ARG",
  homeScore: 2,
  awayScore: 1,
  groupId: "A",
  stage: "grupos" as const,
  venue: null,
  round: "Group Stage - 1",
};

function prediction(over: Record<string, unknown> = {}) {
  return {
    uid: "user-123",
    matchId: MATCH.id,
    homeScore: 2,
    awayScore: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  };
}

function prefs(over: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    userId: "user-123",
    system: true,
    games: true,
    ranking: true,
    pushEnabled: false,
    ...over,
  };
}

/** Firestore mock: só a query predictions.where(matchId).get(). */
function setupFirestore(predictions: Record<string, unknown>[]) {
  const docs = predictions.map((data) => ({
    data: () => data,
    ref: { set: vi.fn().mockResolvedValue(undefined), path: `predictions/x` },
  }));
  getFirestoreMock.mockReturnValue({
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === "predictions") {
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: docs.length === 0, docs }),
          }),
        };
      }
      return {};
    }),
  });
}

function postWithSecret(): NextRequest {
  return new Request("http://localhost/api/predictions/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": MOCK_SCORE_SECRET },
  }) as unknown as NextRequest;
}

/** Extrai os itens passados a writeNotifications na 1ª call. */
function writtenItems(): NotificationCreate[] {
  expect(writeNotificationsMock).toHaveBeenCalled();
  return writeNotificationsMock.mock.calls[0]![1] as NotificationCreate[];
}

// ---------------------------------------------------------------------------

describe("POST /api/predictions/score — notificações games (TASK-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SCORE_SECRET", MOCK_SCORE_SECRET);
    fetchAllMatchesMock.mockResolvedValue([MATCH]);
    fetchPreferencesMapMock.mockResolvedValue(new Map([["user-123", prefs()]]));
    writeNotificationsMock.mockResolvedValue(undefined);
    sendPushForNotificationsMock.mockResolvedValue({
      attempted: 0,
      success: 0,
      failure: 0,
      pruned: 0,
    });
    resolveTeamByCodeMock.mockImplementation((code: string) => {
      const names: Record<string, { name: string }> = {
        BRA: { name: "Brasil" },
        ARG: { name: "Argentina" },
      };
      return names[code];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("placar exato (correct) → notificação games de placar para o uid dono", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    setupFirestore([prediction()]);

    const res = await POST(postWithSecret());
    expect(res.status).toBe(200);

    const items = writtenItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "games-user-123-5001",
      userId: "user-123",
      type: "games",
    });
    expect(items[0]!.message).toContain("placar");
    expect(items[0]!.message).toContain("Brasil x Argentina");
  });

  it("partial não-draw → mensagem de vencedor", async () => {
    scorePredictionMock.mockReturnValue({ status: "partial", points: 5 });
    // palpite 2x1 (não-empate)
    setupFirestore([prediction({ homeScore: 2, awayScore: 1 })]);

    await POST(postWithSecret());
    const items = writtenItems();
    expect(items[0]!.message).toContain("vencedor");
  });

  it("partial draw (palpite X-X) → mensagem de empate", async () => {
    scorePredictionMock.mockReturnValue({ status: "partial", points: 5 });
    setupFirestore([prediction({ homeScore: 1, awayScore: 1 })]);

    await POST(postWithSecret());
    const items = writtenItems();
    expect(items[0]!.message).toContain("empate");
  });

  it("wrong/pending → não notifica (writeNotifications não chamado)", async () => {
    scorePredictionMock.mockReturnValue({ status: "wrong", points: 0 });
    setupFirestore([prediction(), prediction({ uid: "user-x" })]);

    const res = await POST(postWithSecret());
    expect(res.status).toBe(200);
    expect(writeNotificationsMock).not.toHaveBeenCalled();
  });

  it("preferência games:false → palpite acertado não vira item", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    fetchPreferencesMapMock.mockResolvedValue(
      new Map([["user-123", prefs({ games: false })]]),
    );
    setupFirestore([prediction()]);

    await POST(postWithSecret());
    const items = writtenItems();
    expect(items).toHaveLength(0);
  });

  it("best-effort: writeNotifications rejeita → response ainda 200 com counts", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    writeNotificationsMock.mockRejectedValue(new Error("firestore down"));
    setupFirestore([prediction()]);

    const res = await POST(postWithSecret());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scoredMatches: number;
      updatedPredictions: number;
    };
    expect(body).toEqual({ scoredMatches: 1, updatedPredictions: 1 });
  });

  it("nome de time resolvido (BRA→Brasil) e fallback ao código quando não resolve", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    fetchAllMatchesMock.mockResolvedValue([
      { ...MATCH, homeTeamId: "1A", awayTeamId: "ARG" }, // 1A não resolve
    ]);
    setupFirestore([prediction()]);

    await POST(postWithSecret());
    const items = writtenItems();
    expect(items[0]!.message).toContain("1A x Argentina");
  });

  it("TASK-07: push recebe os recém-criados retornados por writeNotifications (não os items crus)", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    setupFirestore([prediction()]);
    // write devolve um subconjunto (idempotência sob cron resolvida no write).
    const created = [
      { id: "games-user-123-5001", userId: "user-123", type: "games", title: "t", message: "m" },
    ] as NotificationCreate[];
    writeNotificationsMock.mockResolvedValue(created);

    await POST(postWithSecret());
    expect(sendPushForNotificationsMock).toHaveBeenCalledTimes(1);
    // push é alimentado pelo RETORNO do write, não pelo array original de items.
    expect(sendPushForNotificationsMock.mock.calls[0]![0]).toBe(created);
  });

  it("TASK-07 re-run: writeNotifications retorna [] → push enviado com [] (sem repush)", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    setupFirestore([prediction()]);
    writeNotificationsMock.mockResolvedValue([]); // re-run: doc já existia

    await POST(postWithSecret());
    expect(sendPushForNotificationsMock).toHaveBeenCalledTimes(1);
    expect(sendPushForNotificationsMock.mock.calls[0]![0]).toEqual([]);
  });

  it("owner-targeting: palpite com editedBy ainda notifica prediction.uid", async () => {
    scorePredictionMock.mockReturnValue({ status: "correct", points: 10 });
    setupFirestore([
      prediction({ uid: "owner-9", editedBy: "admin-1", editedByRole: "admin" }),
    ]);
    fetchPreferencesMapMock.mockResolvedValue(
      new Map([["owner-9", prefs({ userId: "owner-9" })]]),
    );

    await POST(postWithSecret());
    const items = writtenItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.userId).toBe("owner-9");
    expect(items[0]!.id).toBe("games-owner-9-5001");
  });
});
