/**
 * Testes do Route Handler POST /api/group/users/promote (PRD-10 TASK-06).
 *
 * Promoção é o MAIOR risco de escalonamento da PRD-10: um `group_admin` promove
 * um membro a admin do PRÓPRIO pool. Guardas verificadas:
 *  - `groupId` SEMPRE da sessão (nunca do body — D2);
 *  - alvo precisa ser APROVADO e do MESMO pool (403 cross-pool);
 *  - alvo NUNCA pode ser super_admin (403 — proteção de papel);
 *  - troca atômica: novo → group_admin, admin anterior → participant.
 *
 * Mocks: server-only, authorizeGroupAdminOfPool, getAdminFirestore.
 * `poolSchema`/`roleSchema`/`userStatusSchema` são REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { NextResponse } from "next/server";

import { POST } from "@/app/api/group/users/promote/route";

type PostReq = Parameters<typeof POST>[0];

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostReq {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostReq;
}

function pool(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pool-1",
    name: "Bolão FC",
    slug: "pool-1",
    status: "active",
    adminId: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const updateMock = vi.fn();

/** Mocka a transação: tx.get despacha por ref `{ kind, id }`. */
function mockDb(opts: {
  poolExists?: boolean;
  poolData?: Record<string, unknown>;
  target?: Record<string, unknown> | null;
  oldAdmin?: Record<string, unknown> | null;
}): void {
  const poolSnap = {
    exists: opts.poolExists ?? true,
    data: () => opts.poolData ?? pool(),
  };
  function userSnap(data: Record<string, unknown> | null | undefined) {
    return { exists: data != null, data: () => data ?? undefined };
  }
  const tx = {
    get: vi.fn(async (ref: { kind: string; id: string }) => {
      if (ref.kind === "pools") return poolSnap;
      if (ref.id === "admin-1") return userSnap(opts.oldAdmin ?? { role: "group_admin" });
      return userSnap(opts.target);
    }),
    update: updateMock,
  };
  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({
      doc: (id: string) => ({ kind: name, id }),
    }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({
    auth: { uid: "admin-1", groupId: "pool-1", role: "group_admin" },
  });
});

const okBody = { uid: "u2" };

describe("POST /api/group/users/promote", () => {
  it("401 quando não autorizado (não toca no Firestore)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("400 JSON malformado", async () => {
    const res = await POST(makeReq({ badJson: true }));
    expect(res.status).toBe(400);
  });

  it("422 body sem uid", async () => {
    const res = await POST(makeReq({ body: {} }));
    expect(res.status).toBe(422);
  });

  it("404 pool não encontrado", async () => {
    mockDb({ poolExists: false, target: { status: "approved", groupId: "pool-1" } });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(404);
  });

  it("409 alvo não aprovado", async () => {
    mockDb({ target: { status: "pending", groupId: "pool-1", role: "participant" } });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("403 alvo de OUTRO pool (isolamento D2)", async () => {
    mockDb({ target: { status: "approved", groupId: "outro-pool", role: "participant" } });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("403 alvo é super_admin (proteção de papel)", async () => {
    mockDb({ target: { status: "approved", groupId: "pool-1", role: "super_admin" } });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("200 promove participante e rebaixa o admin anterior", async () => {
    mockDb({
      target: { status: "approved", groupId: "pool-1", role: "participant" },
      oldAdmin: { role: "group_admin" },
    });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(200);
    // pool.adminId ← novo; novo → group_admin; anterior → participant.
    const calls = updateMock.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(calls.some((p) => p["adminId"] === "u2")).toBe(true);
    expect(calls.some((p) => p["role"] === "group_admin")).toBe(true);
    expect(calls.some((p) => p["role"] === "participant")).toBe(true);
  });
});
