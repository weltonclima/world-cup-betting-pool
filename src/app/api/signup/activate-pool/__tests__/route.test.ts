/**
 * Testes do Route Handler POST /api/signup/activate-pool (multi-championship TASK-18).
 *
 * Promoção pós-verificação de e-mail: re-verifica `decoded.email_verified` no
 * servidor e promove os pools `status:pending` administrados pelo caller para
 * `active`. Idempotente (pool já `active` → no-op) e best-effort. Nunca toca pool
 * de outro dono nem pool `blocked` (a query já filtra `adminId`+`status:pending`).
 *
 * Casos:
 *  1. 400 — JSON malformado
 *  2. 422 — body sem idToken
 *  3. 401 — ID token inválido
 *  4. verificado + 1 pool pending do caller → promove a active, activated:1
 *  5. verificado + nenhum pool pending → activated:0 (idempotente)
 *  6. NÃO verificado → { ok:false, activated:0 }, nada promovido (sem update)
 *  7. verificado + N pools pending → activated:N, todos active
 *  8. falha de escrita (update) → 500 (erro tratado, não derruba o processo)
 *
 * Mocks: server-only, getAdminAuth (verifyIdToken) e getAdminFirestore (query
 * `pools.where(adminId).where(status:pending).get()` + `doc.ref.update`).
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

import { POST } from "@/app/api/signup/activate-pool/route";

type PostParams = Parameters<typeof POST>;

const UID = "user-1";

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostParams[0] {
  return {
    url: "https://bolao.app/api/signup/activate-pool",
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostParams[0];
}

/** Update registrado por doc (para inspeção do que foi promovido). */
interface UpdateOp {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Firestore fake para a query de promoção. `pendingIds` são os pools pending do
 * caller devolvidos pela query já filtrada (`adminId==uid && status==pending`).
 * Cada `doc.ref.update` é registrado; `updateThrows` injeta falha de IO.
 */
function mockDb(opts: { pendingIds?: string[]; updateThrows?: unknown } = {}): {
  updates: UpdateOp[];
  whereCalls: Array<[string, string, unknown]>;
} {
  const updates: UpdateOp[] = [];
  const whereCalls: Array<[string, string, unknown]> = [];
  const ids = opts.pendingIds ?? [];

  const docs = ids.map((id) => ({
    id,
    ref: {
      update: vi.fn(async (data: Record<string, unknown>) => {
        if (opts.updateThrows) throw opts.updateThrows;
        updates.push({ id, data });
      }),
    },
  }));

  const query = {
    where: vi.fn((field: string, op: string, value: unknown) => {
      whereCalls.push([field, op, value]);
      return query;
    }),
    get: vi.fn(async () => ({ docs, empty: docs.length === 0 })),
  };

  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => query),
  });

  return { updates, whereCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdTokenMock.mockResolvedValue({ uid: UID, email_verified: true });
});

describe("POST /api/signup/activate-pool", () => {
  it("400 JSON malformado", async () => {
    mockDb();
    const res = await POST(makeReq({ badJson: true }));
    expect(res.status).toBe(400);
  });

  it("422 body sem idToken", async () => {
    mockDb();
    const res = await POST(makeReq({ body: {} }));
    expect(res.status).toBe(422);
  });

  it("401 ID token inválido", async () => {
    mockDb();
    verifyIdTokenMock.mockRejectedValue(new Error("bad token"));
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(401);
  });

  it("verificado + 1 pool pending do caller → promove a active, activated:1", async () => {
    const { updates, whereCalls } = mockDb({ pendingIds: ["meu-grupo"] });
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; activated: number };
    expect(body.ok).toBe(true);
    expect(body.activated).toBe(1);

    // Query filtra por dono E status pending (BR3: nunca outro dono / blocked).
    expect(whereCalls).toContainEqual(["adminId", "==", UID]);
    expect(whereCalls).toContainEqual(["status", "==", "pending"]);

    // Promoção: status active + updatedAt carimbado.
    expect(updates).toHaveLength(1);
    expect(updates[0]!.id).toBe("meu-grupo");
    expect(updates[0]!.data.status).toBe("active");
    expect(typeof updates[0]!.data.updatedAt).toBe("string");
  });

  it("verificado + nenhum pool pending → activated:0 (idempotente)", async () => {
    const { updates } = mockDb({ pendingIds: [] });
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; activated: number };
    expect(body.ok).toBe(true);
    expect(body.activated).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("NÃO verificado → { ok:false, activated:0 }, nada promovido", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: UID, email_verified: false });
    const { updates } = mockDb({ pendingIds: ["meu-grupo"] });
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; activated: number };
    expect(body.ok).toBe(false);
    expect(body.activated).toBe(0);
    // Nunca promove sem verificação (BR1/BR4).
    expect(updates).toHaveLength(0);
  });

  it("verificado + N pools pending → promove todos, activated:N", async () => {
    const { updates } = mockDb({ pendingIds: ["g1", "g2", "g3"] });
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; activated: number };
    expect(body.activated).toBe(3);
    expect(updates.map((u) => u.id).sort()).toEqual(["g1", "g2", "g3"]);
    expect(updates.every((u) => u.data.status === "active")).toBe(true);
  });

  it("falha de escrita (update) → 500 tratado, sem derrubar o processo", async () => {
    mockDb({ pendingIds: ["meu-grupo"], updateThrows: new Error("io down") });
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(500);
  });
});
