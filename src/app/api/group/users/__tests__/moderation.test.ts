/**
 * Testes do núcleo de moderação `_moderation.ts` (PRD-10 TASK-05):
 * `handleStatusModeration` (approve/reject/block/unblock) e `handleRemove`.
 *
 * Guardas de isolamento/papel verificadas em TODA ação:
 *  - `groupId` da SESSÃO (D2) — alvo de outro pool → 403;
 *  - super_admin é INTOCÁVEL por um group_admin → 403;
 *  - transição de status precisa casar com o estado atual → 409;
 *  - reject ≡ blocked (A1); block captura `blockReason`; unblock limpa;
 *  - remove só atua sobre BLOQUEADO (soft-delete: limpa groupId, marca timestamp).
 *
 * Mocks: server-only, authorizeGroupAdminOfPool, getAdminFirestore,
 * firebase-admin/firestore (FieldValue). `userSchema`/`canTransition` REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock, recalcBestEffortMock, writeNotificationsMock } =
  vi.hoisted(() => ({
    authorizeMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    recalcBestEffortMock: vi.fn(),
    writeNotificationsMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/rankings/recalc", () => ({
  recalcRankingsBestEffort: recalcBestEffortMock,
}));
// `notifyModeration` REAL (valida a copy de moderação end-to-end);
// `writeNotifications` é espiada (TASK-03: notificação `system` server-side).
vi.mock("@/server/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/notifications")>();
  return { ...actual, writeNotifications: writeNotificationsMock };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => "__delete__" },
}));

import {
  handleRemove,
  handleStatusModeration,
} from "@/app/api/group/users/_moderation";

function makeReq(opts: { body?: unknown; badJson?: boolean }): Request {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as Request;
}

function userDoc(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: "u2",
    name: "Membro",
    nickname: "membro",
    email: "membro@example.com",
    role: "participant",
    status: "pending",
    groupId: "pool-1",
    ...over,
  };
}

// Tipado: sem a assinatura, `mock.calls[0]` seria tupla vazia e `calls[0][0]`
// falharia no tsc (vitest run/esbuild não checa tipos).
const updateMock = vi.fn<(patch: Record<string, unknown>) => Promise<void>>(
  async () => {},
);

/** `doc().get()` devolve `snap`; o re-read pós-update reusa o mesmo doc. */
function mockDb(opts: { exists?: boolean; user?: Record<string, unknown> }): void {
  const snap = {
    exists: opts.exists ?? true,
    data: () => opts.user ?? userDoc(),
  };
  getFirestoreMock.mockReturnValue({
    collection: () => ({
      doc: () => ({ get: async () => snap, update: updateMock }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({
    auth: { uid: "admin-1", groupId: "pool-1", role: "group_admin" },
  });
});

const okBody = { uid: "u2" };

describe("handleStatusModeration", () => {
  it("403 quando não autorizado (gate barra antes do Firestore)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: Response.json({ error: "Acesso negado." }, { status: 403 }),
    });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(403);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("400 JSON malformado", async () => {
    const res = await handleStatusModeration(makeReq({ badJson: true }), "approve");
    expect(res.status).toBe(400);
  });

  it("422 body sem uid", async () => {
    const res = await handleStatusModeration(makeReq({ body: {} }), "approve");
    expect(res.status).toBe(422);
  });

  it("404 usuário inexistente", async () => {
    mockDb({ exists: false });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(404);
  });

  it("403 alvo de OUTRO pool (isolamento D2)", async () => {
    mockDb({ user: userDoc({ groupId: "outro-pool" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("403 alvo é super_admin (intocável)", async () => {
    mockDb({ user: userDoc({ role: "super_admin", status: "pending" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("409 estado atual não casa com a ação (approve sobre não-pending)", async () => {
    mockDb({ user: userDoc({ status: "approved" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("200 approve: pending → approved", async () => {
    mockDb({ user: userDoc({ status: "pending" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["status"]).toBe("approved");
  });

  it("200 reject ≡ blocked (A1)", async () => {
    mockDb({ user: userDoc({ status: "pending" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "reject");
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["status"]).toBe("blocked");
  });

  it("200 block captura blockReason", async () => {
    mockDb({ user: userDoc({ status: "approved" }) });
    const res = await handleStatusModeration(
      makeReq({ body: { uid: "u2", reason: "  spam  " } }),
      "block",
    );
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["status"]).toBe("blocked");
    expect(patch["blockReason"]).toBe("spam"); // trim aplicado
  });

  it("200 unblock limpa blockReason", async () => {
    mockDb({ user: userDoc({ status: "blocked" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "unblock");
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["status"]).toBe("approved");
    expect(patch["blockReason"]).toBe("");
  });
});

describe("handleStatusModeration — notificação `system` (TASK-03)", () => {
  /** Lê o único item gravado na chamada de writeNotifications. */
  function writtenNotification(): Record<string, unknown> {
    const items = writeNotificationsMock.mock.calls[0]![1] as Record<string, unknown>[];
    return items[0]!;
  }

  it.each([
    ["approve", "pending", "Cadastro aprovado"],
    ["reject", "pending", "Cadastro não aprovado"],
    ["block", "approved", "Conta bloqueada"],
    ["unblock", "blocked", "Conta reativada"],
  ] as const)(
    "%s grava 1 notificação `system` server-side com a copy correta",
    async (kind, fromStatus, expectedTitle) => {
      mockDb({ user: userDoc({ status: fromStatus }) });
      const res = await handleStatusModeration(makeReq({ body: okBody }), kind);
      expect(res.status).toBe(200);
      expect(writeNotificationsMock).toHaveBeenCalledTimes(1);
      const notif = writtenNotification();
      expect(notif["type"]).toBe("system");
      expect(notif["userId"]).toBe("u2");
      expect(notif["title"]).toBe(expectedTitle);
      expect(notif["id"]).toBeUndefined(); // auto-id (sem ID determinístico)
    },
  );

  it("best-effort: falha de writeNotifications NÃO derruba a moderação (200)", async () => {
    mockDb({ user: userDoc({ status: "pending" }) });
    writeNotificationsMock.mockRejectedValueOnce(new Error("admin sdk down"));
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(200); // status já persistido; notificação é efeito best-effort
    expect(updateMock).toHaveBeenCalled();
  });

  it("não notifica quando a ação falha antes do write (409)", async () => {
    mockDb({ user: userDoc({ status: "approved" }) });
    const res = await handleStatusModeration(makeReq({ body: okBody }), "approve");
    expect(res.status).toBe(409);
    expect(writeNotificationsMock).not.toHaveBeenCalled();
  });
});

describe("handleRemove", () => {
  it("403 alvo de outro pool", async () => {
    mockDb({ user: userDoc({ status: "blocked", groupId: "outro-pool" }) });
    const res = await handleRemove(makeReq({ body: okBody }));
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("409 alvo não está bloqueado", async () => {
    mockDb({ user: userDoc({ status: "approved" }) });
    const res = await handleRemove(makeReq({ body: okBody }));
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("200 soft-delete: limpa groupId e marca removedFromGroupAt", async () => {
    mockDb({ user: userDoc({ status: "blocked" }) });
    const res = await handleRemove(makeReq({ body: okBody }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["groupId"]).toBe("__delete__"); // FieldValue.delete()
    expect(patch["removedFromGroupAt"]).toBeTypeOf("string");
  });
});
