/**
 * Testes TDD (red-first) do Route Handler GET /api/groups/[id] (TASK-04).
 *
 * Mocks: requireApprovedUser (guarda), getAdminFirestore (pools.doc.get,
 * users.doc.get role, users.where.where.count.get), server-only.
 *
 * Casos:
 *  1. 401 — guarda
 *  2. 404 — pool inexistente
 *  3. 200 — pool active legível por aprovado + memberCount
 *  4. 404 — pool pending escondido de terceiro (não dono, não super_admin)
 *  5. 200 — pool pending visível ao dono (adminId == uid)
 *  6. 200 — pool pending visível ao super_admin (role legado "admin")
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { GET } from "@/app/api/groups/[id]/route";

type GetParams = Parameters<typeof GET>;

function approved(uid = "uid-1"): void {
  requireApprovedUserMock.mockResolvedValue({
    user: { uid, email: null, nickname: null },
  });
}

const req = {} as unknown as GetParams[0];
function ctx(id: string): GetParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as GetParams[1];
}

function mockDb(opts: {
  pool: Record<string, unknown> | null;
  userRole?: string;
  memberCount?: number;
}) {
  const poolGet = vi.fn(async () =>
    opts.pool === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => opts.pool },
  );
  const userGet = vi.fn(async () =>
    opts.userRole === undefined
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => ({ role: opts.userRole }) },
  );
  const countGet = vi.fn(async () => ({ data: () => ({ count: opts.memberCount ?? 0 }) }));
  const collectionMock = vi.fn((name: string) => {
    if (name === "pools") return { doc: () => ({ get: poolGet }) };
    // users
    return {
      doc: () => ({ get: userGet }),
      where: () => ({ where: () => ({ count: () => ({ get: countGet }) }) }),
    };
  });
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
}

const iso = "2026-06-05T12:00:00Z";
const active = { id: "p1", name: "P", slug: "p1", status: "active", adminId: "owner", createdAt: iso };
const pending = { ...active, status: "pending" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/groups/[id]", () => {
  it("401 quando a guarda barra", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req, ctx("p1"));
    expect(res.status).toBe(401);
  });

  it("404 quando o pool não existe", async () => {
    approved();
    mockDb({ pool: null });
    const res = await GET(req, ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("200 pool active legível por aprovado + memberCount", async () => {
    approved("qualquer");
    mockDb({ pool: active, memberCount: 3 });
    const res = await GET(req, ctx("p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pool: { slug: string }; memberCount: number };
    expect(body.pool.slug).toBe("p1");
    expect(body.memberCount).toBe(3);
  });

  it("404 pool pending escondido de terceiro", async () => {
    approved("stranger");
    mockDb({ pool: pending, userRole: "participant" });
    const res = await GET(req, ctx("p1"));
    expect(res.status).toBe(404);
  });

  it("200 pool pending visível ao dono", async () => {
    approved("owner");
    mockDb({ pool: pending, userRole: "participant" });
    const res = await GET(req, ctx("p1"));
    expect(res.status).toBe(200);
  });

  it("200 pool pending visível ao super_admin (role legado admin)", async () => {
    approved("admin-uid");
    mockDb({ pool: pending, userRole: "admin" });
    const res = await GET(req, ctx("p1"));
    expect(res.status).toBe(200);
  });
});
