/**
 * Testes do Route Handler POST/DELETE /api/push/tokens (web-push-pwa TASK-03).
 *
 * Store de tokens FCM por usuário (multi-device). Gate sessão→approved via
 * requireApprovedUser. Upsert idempotente por token (doc id = token). DELETE
 * idempotente (cleanup de logout não falha). `uid` SEMPRE da sessão.
 *
 * Mocks: server-only, requireApprovedUser, getAdminFirestore. Schema REAL.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { requireApprovedUserMock, getFirestoreMock } = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { POST, DELETE } from "@/app/api/push/tokens/route";

const UID = "uid-1";
const TOKEN = "fcm-token-abc123";

function req(opts: {
  body?: unknown;
  badJson?: boolean;
  userAgent?: string | null;
  method?: string;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.userAgent) headers["user-agent"] = opts.userAgent;
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as NextRequest;
}

const setMock = vi.fn<(data: unknown, opts?: unknown) => Promise<void>>(async () => {});
const deleteMock = vi.fn<() => Promise<void>>(async () => {});

function mockDb(opts: { exists?: boolean; data?: Record<string, unknown> } = {}) {
  const snap = { exists: opts.exists ?? false, data: () => opts.data };
  getFirestoreMock.mockReturnValue({
    collection: () => ({
      doc: () => ({ get: async () => snap, set: setMock, delete: deleteMock }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedUserMock.mockResolvedValue({
    user: { uid: UID, email: "a@x.com", nickname: "a" },
  });
  mockDb();
});

describe("POST /api/push/tokens", () => {
  it("401 quando sem sessão", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await POST(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("403 quando usuário não-approved", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    });
    const res = await POST(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(403);
  });

  it("422 body sem token", async () => {
    const res = await POST(req({ body: {} }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["issues"]).toBeUndefined();
  });

  it("422 token vazio", async () => {
    const res = await POST(req({ body: { token: "" } }));
    expect(res.status).toBe(422);
  });

  it("400 JSON malformado", async () => {
    const res = await POST(req({ badJson: true }));
    expect(res.status).toBe(400);
  });

  it("201 cria doc com userId da sessão, datas e userAgent do header", async () => {
    mockDb({ exists: false });
    const res = await POST(req({ body: { token: TOKEN }, userAgent: "Mozilla/5.0" }));
    expect(res.status).toBe(201);
    const [data] = setMock.mock.calls[0]!;
    const doc = data as Record<string, unknown>;
    expect(doc["token"]).toBe(TOKEN);
    expect(doc["userId"]).toBe(UID);
    expect(doc["userAgent"]).toBe("Mozilla/5.0");
    expect(typeof doc["createdAt"]).toBe("string");
    expect(typeof doc["lastSeenAt"]).toBe("string");
  });

  it("200 upsert idempotente: preserva createdAt e atualiza lastSeenAt", async () => {
    mockDb({
      exists: true,
      data: {
        token: TOKEN,
        userId: UID,
        userAgent: "old",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const res = await POST(req({ body: { token: TOKEN }, userAgent: "new" }));
    expect(res.status).toBe(200);
    const [data, setOpts] = setMock.mock.calls[0]!;
    const doc = data as Record<string, unknown>;
    expect(doc["createdAt"]).toBe("2026-01-01T00:00:00.000Z");
    expect(doc["lastSeenAt"]).not.toBe("2026-01-01T00:00:00.000Z");
    expect(setOpts).toEqual({ merge: true });
  });

  it("reatribui userId ao uid da sessão quando token era de outro usuário", async () => {
    mockDb({
      exists: true,
      data: {
        token: TOKEN,
        userId: "outro-uid",
        userAgent: "x",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const res = await POST(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(200);
    const doc = setMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(doc["userId"]).toBe(UID);
  });

  it("422 body com campo extra (strict) — não confia em userId do body", async () => {
    const res = await POST(req({ body: { token: TOKEN, userId: "hacker" } }));
    expect(res.status).toBe(422);
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/push/tokens", () => {
  function ownedToken(userId = UID) {
    return {
      token: TOKEN,
      userId,
      userAgent: "ua",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("401 quando sem sessão", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await DELETE(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("403 quando usuário não-approved", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    });
    const res = await DELETE(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("422 body sem token", async () => {
    const res = await DELETE(req({ body: {} }));
    expect(res.status).toBe(422);
  });

  it("200 remove o token do próprio usuário", async () => {
    mockDb({ exists: true, data: ownedToken() });
    const res = await DELETE(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("403 não remove token de outro usuário (ownership)", async () => {
    mockDb({ exists: true, data: ownedToken("outro-uid") });
    const res = await DELETE(req({ body: { token: TOKEN } }));
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("200 idempotente: token inexistente não falha nem chama delete", async () => {
    mockDb({ exists: false });
    const res = await DELETE(req({ body: { token: "nao-existe" } }));
    expect(res.status).toBe(200);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
