/**
 * Testes TDD (red-first) do Route Handler PATCH /api/admin/groups/[id]/admin (TASK-05).
 *
 * Troca de admin do pool (PRD §2.9). Transação atômica: pools.adminId ← novo;
 * users/{novo}.role ← group_admin; rebaixa o antigo a participant se era group_admin.
 * Autorização: secret OU super_admin. Mocks: requireApprovedUser, getAdminFirestore
 * (runTransaction com tx.get/tx.update keyed por path), env, server-only.
 *
 * Casos:
 *  1. 403 — não-super_admin
 *  2. 200 — troca válida grava adminId + promove novo + rebaixa antigo
 *  3. 409 — novo admin inexistente
 *  4. 409 — novo admin não-approved
 *  5. 409 — novo admin com groupId de outro pool
 *  6. 422 — adminId ausente
 *  7. 404 — pool inexistente
 *  8. 200 — idempotente (novo == antigo) mantém group_admin
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApprovedUserMock, getFirestoreMock } = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

import { PATCH } from "@/app/api/admin/groups/[id]/admin/route";

type PatchParams = Parameters<typeof PATCH>;

const SECRET = "s3cr3t-admin";

function makeReq(opts: { secret?: string | null; body?: unknown }): PatchParams[0] {
  return {
    headers: {
      get: (k: string) => (k === "x-admin-secret" ? (opts.secret ?? null) : null),
    },
    json: async () => opts.body,
  } as unknown as PatchParams[0];
}

function ctx(id: string): PatchParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as PatchParams[1];
}

function approved(uid = "caller"): void {
  requireApprovedUserMock.mockResolvedValue({
    user: { uid, email: null, nickname: null },
  });
}

const iso = "2026-06-05T12:00:00Z";

type Snap = { exists: boolean; data: () => Record<string, unknown> | undefined };
function snap(data: Record<string, unknown> | null): Snap {
  return data === null
    ? { exists: false, data: () => undefined }
    : { exists: true, data: () => data };
}

/**
 * Monta o mock de Firestore com runTransaction. `docs` mapeia path→data (ou null
 * p/ inexistente). `tx.get(ref)` resolve por `ref.path`. Retorna spies.
 */
function mockDb(docs: Record<string, Record<string, unknown> | null>) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const txGet = vi.fn(async (ref: { path: string }) => snap(docs[ref.path] ?? null));
  const txUpdate = vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
    updates.push({ path: ref.path, data });
  });
  const tx = { get: txGet, update: txUpdate };
  const runTransaction = vi.fn(
    async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  );
  const collectionMock = vi.fn((name: string) => ({
    doc: (id: string) => ({
      path: `${name}/${id}`,
      // `.get()` direto serve à autorização super_admin (não-transacional);
      // `tx.get(ref)` resolve pelo mesmo `path`.
      get: async () => snap(docs[`${name}/${id}`] ?? null),
    }),
  }));
  getFirestoreMock.mockReturnValue({
    collection: collectionMock,
    runTransaction,
  });
  return { updates, txUpdate };
}

function pool(adminId: string): Record<string, unknown> {
  return { id: "p1", name: "P", slug: "p1", status: "active", adminId, createdAt: iso };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["GROUPS_ADMIN_SECRET"] = SECRET;
});
afterEach(() => {
  delete process.env["GROUPS_ADMIN_SECRET"];
});

describe("PATCH /api/admin/groups/[id]/admin", () => {
  it("403 não-super_admin", async () => {
    approved();
    mockDb({ "users/caller": { role: "participant" } });
    const res = await PATCH(makeReq({ body: { adminId: "novo" } }), ctx("p1"));
    expect(res.status).toBe(403);
  });

  it("200 troca válida: grava adminId, promove novo, rebaixa antigo", async () => {
    const { updates } = mockDb({
      "pools/p1": pool("antigo"),
      "users/novo": { role: "participant", status: "approved" },
      "users/antigo": { role: "group_admin", status: "approved" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pool: { adminId: string } };
    expect(body.pool.adminId).toBe("novo");
    expect(updates).toContainEqual(
      expect.objectContaining({ path: "pools/p1", data: expect.objectContaining({ adminId: "novo" }) }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({ path: "users/novo", data: expect.objectContaining({ role: "group_admin" }) }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({ path: "users/antigo", data: expect.objectContaining({ role: "participant" }) }),
    );
  });

  it("409 novo admin inexistente", async () => {
    mockDb({ "pools/p1": pool("antigo"), "users/novo": null });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(409);
  });

  it("409 novo admin não-approved", async () => {
    mockDb({
      "pools/p1": pool("antigo"),
      "users/novo": { role: "participant", status: "pending" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(409);
  });

  it("200 novo admin SEM groupId (dupla-compat: opcional pré-migração)", async () => {
    const { updates } = mockDb({
      "pools/p1": pool("antigo"),
      "users/novo": { role: "participant", status: "approved" },
      "users/antigo": { role: "group_admin", status: "approved" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    expect(updates).toContainEqual(
      expect.objectContaining({
        path: "users/novo",
        data: expect.objectContaining({ role: "group_admin" }),
      }),
    );
  });

  it("409 novo admin com groupId de outro pool", async () => {
    mockDb({
      "pools/p1": pool("antigo"),
      "users/novo": { role: "participant", status: "approved", groupId: "outro" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(409);
  });

  it("422 adminId ausente", async () => {
    mockDb({ "pools/p1": pool("antigo") });
    const res = await PATCH(makeReq({ secret: SECRET, body: {} }), ctx("p1"));
    expect(res.status).toBe(422);
  });

  it("404 pool inexistente", async () => {
    mockDb({ "pools/p1": null, "users/novo": { role: "participant", status: "approved" } });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(404);
  });

  it("200 novo admin super_admin NÃO é rebaixado a group_admin (review WR-01)", async () => {
    const { updates } = mockDb({
      "pools/p1": pool("antigo"),
      "users/novo": { role: "super_admin", status: "approved" },
      "users/antigo": { role: "group_admin", status: "approved" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "novo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    // adminId trocado…
    expect(updates).toContainEqual(
      expect.objectContaining({
        path: "pools/p1",
        data: expect.objectContaining({ adminId: "novo" }),
      }),
    );
    // …mas o role do super_admin é preservado (nenhuma escrita em users/novo.role).
    expect(updates).not.toContainEqual(
      expect.objectContaining({ path: "users/novo" }),
    );
  });

  it("200 idempotente novo == antigo mantém group_admin", async () => {
    const { updates } = mockDb({
      "pools/p1": pool("mesmo"),
      "users/mesmo": { role: "group_admin", status: "approved", groupId: "p1" },
    });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { adminId: "mesmo" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    // não rebaixa ninguém para participant
    expect(updates).not.toContainEqual(
      expect.objectContaining({ data: expect.objectContaining({ role: "participant" }) }),
    );
  });
});
