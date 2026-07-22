/**
 * Testes do Route Handler POST /api/invite/[code]/redeem (PRD-10 A2).
 *
 * Contabiliza o consumo de um convite: re-valida e incrementa `usedCount` de
 * forma atômica, respeitando `isActive`/`expiresAt`/`maxUses`. O incremento só
 * ocorre se o `groupId` do usuário (gravado no signUp) bater com o do convite —
 * impede inflar a contagem de um pool alheio com qualquer ID token válido.
 *
 * Casos:
 *  1. 400 — code fora do formato canônico
 *  2. 400 — JSON malformado
 *  3. 422 — body sem idToken
 *  4. 401 — ID token inválido
 *  5. 404 — convite inexistente
 *  6. 409 — convite inativo
 *  7. 409 — convite expirado
 *  8. 409 — limite de usos atingido
 *  9. 403 — groupId do usuário ≠ groupId do convite
 * 10. 200 — sucesso incrementa usedCount
 *
 * Mocks: server-only, getAdminAuth + getAdminFirestore. `inviteSchema`/
 * `inviteCodeSchema` REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyIdTokenMock,
  getFirestoreMock,
  notifyJoinRequestMock,
  writeNotificationsMock,
  sendPushMock,
} = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  notifyJoinRequestMock: vi.fn(),
  writeNotificationsMock: vi.fn(),
  sendPushMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
  getAdminFirestore: getFirestoreMock,
}));
vi.mock("@/server/notifications", () => ({
  notifyJoinRequest: notifyJoinRequestMock,
  writeNotifications: writeNotificationsMock,
  sendPushForNotifications: sendPushMock,
}));

import { POST } from "@/app/api/invite/[code]/redeem/route";

type PostParams = Parameters<typeof POST>;

const VALID_CODE = "ABC123";

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostParams[0] {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostParams[0];
}

function ctx(code: string): PostParams[1] {
  return { params: Promise.resolve({ code }) } as unknown as PostParams[1];
}

function invite(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: VALID_CODE,
    groupId: "pool-1",
    code: VALID_CODE,
    maxUses: 10,
    usedCount: 0,
    expiresAt: "2099-01-01T00:00:00Z",
    isActive: true,
    createdBy: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const updateMock = vi.fn();
const setMock = vi.fn();

function mockDb(opts: {
  invite: Record<string, unknown> | null;
  userGroupId?: string;
  userName?: string;
  /** Se true, o subdoc `redemptions/{uid}` já existe (uid já resgatou). */
  alreadyRedeemed?: boolean;
  /** adminId do pool do convite. `undefined` = doc de pool ausente. */
  poolAdminId?: string;
  poolName?: string;
  /** Se true, o doc do pool não tem campo `name` (exercita fallback de copy). */
  poolNameMissing?: boolean;
}): void {
  const inviteSnap =
    opts.invite === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => opts.invite };
  const userSnap =
    opts.userGroupId === undefined
      ? { exists: false, data: () => undefined }
      : {
          exists: true,
          data: () => ({ groupId: opts.userGroupId, name: opts.userName }),
        };
  const redemptionSnap = { exists: opts.alreadyRedeemed === true };
  const poolSnap =
    opts.poolAdminId === undefined
      ? { exists: false, data: () => undefined }
      : {
          exists: true,
          data: () =>
            opts.poolNameMissing === true
              ? { adminId: opts.poolAdminId }
              : { adminId: opts.poolAdminId, name: opts.poolName ?? "Bolão" },
        };
  const tx = {
    get: vi.fn(async (ref: { kind: string }) => {
      if (ref.kind === "invite") return inviteSnap;
      if (ref.kind === "user") return userSnap;
      return redemptionSnap; // kind === "redemption"
    }),
    update: updateMock,
    set: setMock,
  };
  // inviteRef expõe `.collection("redemptions").doc(uid)` → ref kind "redemption".
  const inviteDocRef = {
    kind: "invite",
    collection: (_sub: string) => ({
      doc: (uid: string) => ({ kind: "redemption", id: uid }),
    }),
  };
  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({
      doc: (id: string) => {
        if (name === "invites") return inviteDocRef;
        // Pool lido FORA da transação (pós-commit) p/ resolver admin destino.
        if (name === "pools") return { kind: "pool", id, get: async () => poolSnap };
        return { kind: "user", id };
      },
    }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
  notifyJoinRequestMock.mockReturnValue({
    id: "system-joinreq-pool-1-user-1",
    userId: "admin-1",
    type: "system",
    title: "Novo pedido de entrada",
    message: "Alguém pediu para entrar.",
  });
  writeNotificationsMock.mockResolvedValue([
    { id: "system-joinreq-pool-1-user-1", userId: "admin-1", type: "system" },
  ]);
  sendPushMock.mockResolvedValue(undefined);
});

const okBody = { idToken: "tok" };

describe("POST /api/invite/[code]/redeem", () => {
  it("400 code fora do formato canônico", async () => {
    const res = await POST(makeReq({ body: okBody }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("400 JSON malformado", async () => {
    const res = await POST(makeReq({ badJson: true }), ctx(VALID_CODE));
    expect(res.status).toBe(400);
  });

  it("422 body sem idToken", async () => {
    const res = await POST(makeReq({ body: {} }), ctx(VALID_CODE));
    expect(res.status).toBe(422);
  });

  it("401 ID token inválido", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("bad token"));
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(401);
  });

  it("404 convite inexistente", async () => {
    mockDb({ invite: null, userGroupId: "pool-1" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(404);
  });

  it("409 convite inativo", async () => {
    mockDb({ invite: invite({ isActive: false }), userGroupId: "pool-1" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(409);
  });

  it("409 convite expirado", async () => {
    mockDb({ invite: invite({ expiresAt: "2000-01-01T00:00:00Z" }), userGroupId: "pool-1" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(409);
  });

  it("409 limite de usos atingido", async () => {
    mockDb({ invite: invite({ maxUses: 5, usedCount: 5 }), userGroupId: "pool-1" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(409);
  });

  it("403 groupId do usuário ≠ groupId do convite", async () => {
    mockDb({ invite: invite(), userGroupId: "outro-pool" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("200 sucesso incrementa usedCount (resgate novo)", async () => {
    mockDb({ invite: invite({ usedCount: 2 }), userGroupId: "pool-1" });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledOnce();
    const data = updateMock.mock.calls[0]![1] as { usedCount: number };
    expect(data.usedCount).toBe(3);
    // Marca o resgate por uid (idempotência futura)
    expect(setMock).toHaveBeenCalledOnce();
  });

  // ── S2 perf-hardening: idempotência por uid ──────────────────────────────
  it("200 idempotente: uid já resgatado NÃO incrementa usedCount", async () => {
    mockDb({ invite: invite({ usedCount: 2 }), userGroupId: "pool-1", alreadyRedeemed: true });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("200 no-op: convite cheio mas uid já resgatado → não bloqueia nem incrementa", async () => {
    mockDb({
      invite: invite({ maxUses: 5, usedCount: 5 }),
      userGroupId: "pool-1",
      alreadyRedeemed: true,
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  // ── TASK-17: notificação de pedido de entrada ao admin do pool ────────────
  it("resgate novo → notifica o admin do pool (system) e pusha", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      userName: "João",
      poolAdminId: "admin-1",
      poolName: "Bolão dos Parças",
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(notifyJoinRequestMock).toHaveBeenCalledOnce();
    expect(notifyJoinRequestMock).toHaveBeenCalledWith({
      adminUid: "admin-1",
      applicantName: "João",
      poolName: "Bolão dos Parças",
      groupId: "pool-1",
      applicantUid: "user-1",
    });
    expect(writeNotificationsMock).toHaveBeenCalledOnce();
    expect(sendPushMock).toHaveBeenCalledOnce();
  });

  it("resgate repetido (já resgatado) → NÃO notifica o admin", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      poolAdminId: "admin-1",
      alreadyRedeemed: true,
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(notifyJoinRequestMock).not.toHaveBeenCalled();
    expect(writeNotificationsMock).not.toHaveBeenCalled();
  });

  it("admin do pool = próprio resgatante → NÃO auto-notifica", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      poolAdminId: "user-1", // === uid do token
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledOnce(); // resgate ocorre
    expect(notifyJoinRequestMock).not.toHaveBeenCalled();
  });

  it("pool sem adminId (doc ausente) → resgate ok, sem notificação", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      // poolAdminId undefined → pool doc ausente
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledOnce();
    expect(notifyJoinRequestMock).not.toHaveBeenCalled();
  });

  it("pool sem `name` → notifica com poolName de fallback ('seu bolão')", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      userName: "João",
      poolAdminId: "admin-1",
      poolNameMissing: true,
    });
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(notifyJoinRequestMock).toHaveBeenCalledOnce();
    expect(notifyJoinRequestMock).toHaveBeenCalledWith({
      adminUid: "admin-1",
      applicantName: "João",
      poolName: "seu bolão",
      groupId: "pool-1",
      applicantUid: "user-1",
    });
  });

  it("falha ao notificar NÃO quebra o resgate (best-effort)", async () => {
    mockDb({
      invite: invite(),
      userGroupId: "pool-1",
      poolAdminId: "admin-1",
    });
    writeNotificationsMock.mockRejectedValue(new Error("boom"));
    const res = await POST(makeReq({ body: okBody }), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledOnce();
  });
});
