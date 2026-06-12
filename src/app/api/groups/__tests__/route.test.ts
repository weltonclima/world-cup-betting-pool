/**
 * Testes TDD (red-first) do Route Handler POST /api/groups (TASK-04).
 *
 * Rota ainda NÃO existe — import de `@/app/api/groups/route` falha (red).
 *
 * Mocks: `@/server/auth/requireApprovedUser` (guarda), `@/server/firebaseAdmin`
 * (getAdminFirestore → pools.doc(slug).create), `server-only`.
 *
 * Casos:
 *  1. 401 — guarda retorna errorResponse (sem sessão)
 *  2. 403 — guarda retorna errorResponse (não aprovado)
 *  3. 422 — slug inválido (não chama create)
 *  4. 201 — happy: status "pending", id == slug, createdAt ISO
 *  5. adminId vem da sessão — adminId do body é ignorado
 *  6. 409 — slug duplicado (create lança ALREADY_EXISTS, code 6)  [R7]
 *  7. 500 — create lança erro inesperado
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

import { POST } from "@/app/api/groups/route";

type PostReq = Parameters<typeof POST>[0];

function approved(uid = "uid-1"): void {
  requireApprovedUserMock.mockResolvedValue({
    user: { uid, email: null, nickname: null },
  });
}

function makeReq(body: unknown): PostReq {
  return { json: async () => body } as unknown as PostReq;
}

function mockDb(createImpl: (data: unknown) => Promise<unknown>) {
  const createMock = vi.fn(createImpl);
  const docMock = vi.fn(() => ({ create: createMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
  return { createMock, docMock, collectionMock };
}

const validBody = {
  name: "Bolão dos Parças",
  slug: "bolao-dos-parcas",
  description: "Bolão da galera.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/groups (create)", () => {
  it("401 quando a guarda retorna errorResponse (sem sessão)", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("403 quando a guarda retorna errorResponse (não aprovado)", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it("422 quando o slug é inválido — não chama create", async () => {
    approved();
    const { createMock } = mockDb(async () => undefined);
    const res = await POST(makeReq({ ...validBody, slug: "Slug Inválido" }));
    expect(res.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("201 happy: status pending, id == slug, createdAt ISO", async () => {
    approved("uid-9");
    const { createMock } = mockDb(async () => undefined);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { pool: Record<string, unknown> };
    expect(body.pool.status).toBe("pending");
    expect(body.pool.id).toBe("bolao-dos-parcas");
    expect(body.pool.slug).toBe("bolao-dos-parcas");
    expect(typeof body.pool.createdAt).toBe("string");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("adminId vem da sessão — adminId do body é ignorado", async () => {
    approved("uid-session");
    const { createMock } = mockDb(async () => undefined);
    await POST(makeReq({ ...validBody, adminId: "uid-evil" }));
    const written = createMock.mock.calls[0]?.[0] as { adminId: string };
    expect(written.adminId).toBe("uid-session");
  });

  it("409 quando o slug já existe (create lança ALREADY_EXISTS) — R7", async () => {
    approved();
    mockDb(async () => {
      throw Object.assign(new Error("already exists"), { code: 6 });
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(409);
  });

  it("500 quando create lança erro inesperado", async () => {
    approved();
    mockDb(async () => {
      throw new Error("boom");
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
  });
});
