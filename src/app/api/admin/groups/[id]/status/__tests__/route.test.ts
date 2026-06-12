/**
 * Testes TDD (red-first) do Route Handler PATCH /api/admin/groups/[id]/status (TASK-05).
 *
 * Autorização: secret header `x-admin-secret` OU sessão super_admin (requireApprovedUser
 * + isSuperAdminRole sobre users/{uid}.role). Mocks: requireApprovedUser, getAdminFirestore,
 * env GROUPS_ADMIN_SECRET, server-only.
 *
 * Casos:
 *  1. 401 — sem secret e sem sessão (guarda barra)
 *  2. 403 — aprovado porém não-super_admin
 *  3. 200 — pending→active (super_admin) grava status
 *  4. 200 — active→blocked
 *  5. 200 — secret header válido (sem sessão)
 *  6. 409 — transição inválida (active→pending) sem escrita
 *  7. 404 — pool inexistente
 *  8. 422 — body sem status / status fora do enum
 *  9. 400 — JSON malformado
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

import { NextResponse } from "next/server";

import { PATCH } from "@/app/api/admin/groups/[id]/status/route";

type PatchParams = Parameters<typeof PATCH>;

const SECRET = "s3cr3t-admin";

function makeReq(opts: {
  secret?: string | null;
  body?: unknown;
  badJson?: boolean;
}): PatchParams[0] {
  return {
    headers: {
      get: (k: string) =>
        k === "x-admin-secret" ? (opts.secret ?? null) : null,
    },
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PatchParams[0];
}

function ctx(id: string): PatchParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as PatchParams[1];
}

function approved(uid = "uid-1"): void {
  requireApprovedUserMock.mockResolvedValue({
    user: { uid, email: null, nickname: null },
  });
}

const iso = "2026-06-05T12:00:00Z";
function poolDoc(status: string): Record<string, unknown> {
  return { id: "p1", name: "P", slug: "p1", status, adminId: "owner", createdAt: iso };
}

function mockDb(opts: { pool: Record<string, unknown> | null; userRole?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const poolSnap =
    opts.pool === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => opts.pool };
  const userSnap =
    opts.userRole === undefined
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => ({ role: opts.userRole }) };
  const snapByPath = (path: string) =>
    path.startsWith("pools/") ? poolSnap : userSnap;
  const tx = {
    get: vi.fn(async (ref: { path: string }) => snapByPath(ref.path)),
    update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      updates.push({ path: ref.path, data });
    }),
  };
  const collectionMock = vi.fn((name: string) => ({
    doc: (id: string) => ({
      path: `${name}/${id}`,
      get: async () => snapByPath(`${name}/${id}`),
    }),
  }));
  getFirestoreMock.mockReturnValue({
    collection: collectionMock,
    runTransaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  });
  return { updates };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["GROUPS_ADMIN_SECRET"] = SECRET;
});
afterEach(() => {
  delete process.env["GROUPS_ADMIN_SECRET"];
});

describe("PATCH /api/admin/groups/[id]/status", () => {
  it("401 sem secret e sem sessão", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await PATCH(makeReq({ body: { status: "active" } }), ctx("p1"));
    expect(res.status).toBe(401);
  });

  it("403 aprovado porém não-super_admin", async () => {
    approved("part");
    mockDb({ pool: poolDoc("pending"), userRole: "participant" });
    const res = await PATCH(makeReq({ body: { status: "active" } }), ctx("p1"));
    expect(res.status).toBe(403);
  });

  it("200 pending→active grava status (super_admin legado admin)", async () => {
    approved("a");
    const { updates } = mockDb({ pool: poolDoc("pending"), userRole: "admin" });
    const res = await PATCH(makeReq({ body: { status: "active" } }), ctx("p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pool: { status: string } };
    expect(body.pool.status).toBe("active");
    expect(updates).toContainEqual(
      expect.objectContaining({
        path: "pools/p1",
        data: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("200 active→blocked", async () => {
    approved("a");
    mockDb({ pool: poolDoc("active"), userRole: "super_admin" });
    const res = await PATCH(makeReq({ body: { status: "blocked" } }), ctx("p1"));
    expect(res.status).toBe(200);
  });

  it("200 com secret header válido (sem sessão)", async () => {
    mockDb({ pool: poolDoc("pending") });
    const res = await PATCH(
      makeReq({ secret: SECRET, body: { status: "active" } }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    expect(requireApprovedUserMock).not.toHaveBeenCalled();
  });

  it("409 transição inválida active→pending sem escrita", async () => {
    approved("a");
    const { updates } = mockDb({ pool: poolDoc("active"), userRole: "admin" });
    const res = await PATCH(makeReq({ body: { status: "pending" } }), ctx("p1"));
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("404 pool inexistente", async () => {
    approved("a");
    mockDb({ pool: null, userRole: "admin" });
    const res = await PATCH(makeReq({ body: { status: "active" } }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("422 status fora do enum", async () => {
    approved("a");
    mockDb({ pool: poolDoc("pending"), userRole: "admin" });
    const res = await PATCH(makeReq({ body: { status: "weird" } }), ctx("p1"));
    expect(res.status).toBe(422);
  });

  it("400 JSON malformado", async () => {
    approved("a");
    mockDb({ pool: poolDoc("pending"), userRole: "admin" });
    const res = await PATCH(makeReq({ badJson: true }), ctx("p1"));
    expect(res.status).toBe(400);
  });
});
