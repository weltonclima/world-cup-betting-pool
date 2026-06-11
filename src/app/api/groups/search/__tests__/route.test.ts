/**
 * Testes TDD (red-first) do Route Handler GET /api/groups/search (TASK-04).
 *
 * Mocks: requireApprovedUser (guarda), getAdminFirestore (pools.where(status,active).get),
 * server-only.
 *
 * Casos:
 *  1. 401 — guarda
 *  2. query usa status == "active" (pending/blocked nunca consultados)
 *  3. q filtra por slug exato e por name contém (case-insensitive)
 *  4. sem q → retorna todos os ativos
 *  5. doc corrompido é descartado, não derruba a resposta
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

import { GET } from "@/app/api/groups/search/route";

type GetReq = Parameters<typeof GET>[0];

function approved(uid = "uid-1"): void {
  requireApprovedUserMock.mockResolvedValue({
    user: { uid, email: null, nickname: null },
  });
}

function makeReq(q?: string): GetReq {
  const url = q === undefined
    ? "http://x/api/groups/search"
    : `http://x/api/groups/search?q=${encodeURIComponent(q)}`;
  return { url } as unknown as GetReq;
}

function mockPools(docs: unknown[]) {
  const getMock = vi.fn(async () => ({
    docs: docs.map((d, i) => ({ id: `doc-${i}`, data: () => d })),
  }));
  const whereMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ where: whereMock }));
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
  return { whereMock, getMock, collectionMock };
}

const iso = "2026-06-05T12:00:00Z";
const parcas = { id: "bolao-dos-parcas", name: "Bolão dos Parças", slug: "bolao-dos-parcas", status: "active", adminId: "a1", createdAt: iso };
const trampo = { id: "galera-trampo", name: "Galera do Trampo", slug: "galera-trampo", status: "active", adminId: "a2", createdAt: iso };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/groups/search", () => {
  it("401 quando a guarda barra", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("consulta apenas status == active", async () => {
    approved();
    const { whereMock } = mockPools([parcas]);
    await GET(makeReq());
    expect(whereMock).toHaveBeenCalledWith("status", "==", "active");
  });

  it("q filtra por slug exato e por name contém (case-insensitive)", async () => {
    approved();
    mockPools([parcas, trampo]);
    const res = await GET(makeReq("parças".toUpperCase())); // PARÇAS → name contém
    const body = (await res.json()) as { pools: { slug: string }[] };
    expect(body.pools).toHaveLength(1);
    expect(body.pools[0]?.slug).toBe("bolao-dos-parcas");
  });

  it("sem q retorna todos os ativos", async () => {
    approved();
    mockPools([parcas, trampo]);
    const res = await GET(makeReq());
    const body = (await res.json()) as { pools: unknown[] };
    expect(body.pools).toHaveLength(2);
  });

  it("doc corrompido é descartado sem derrubar a resposta", async () => {
    approved();
    mockPools([parcas, { broken: true }]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pools: unknown[] };
    expect(body.pools).toHaveLength(1);
  });
});
