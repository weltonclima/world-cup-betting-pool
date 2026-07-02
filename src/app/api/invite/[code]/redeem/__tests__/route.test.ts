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

const { verifyIdTokenMock, getFirestoreMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
  getAdminFirestore: getFirestoreMock,
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
  /** Se true, o subdoc `redemptions/{uid}` já existe (uid já resgatou). */
  alreadyRedeemed?: boolean;
}): void {
  const inviteSnap =
    opts.invite === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => opts.invite };
  const userSnap =
    opts.userGroupId === undefined
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => ({ groupId: opts.userGroupId }) };
  const redemptionSnap = { exists: opts.alreadyRedeemed === true };
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
      doc: (id: string) =>
        name === "invites" ? inviteDocRef : { kind: "user", id },
    }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
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
});
