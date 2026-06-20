/**
 * Testes do Route Handler GET /api/rankings/pool/grupo/{groupId} (grupo da Copa
 * recortado ao pool).
 *
 * Dois "grupos": o da rota é o grupo da COPA (A–L); o pool vem da SESSÃO. Mocka
 * `requireApprovedUser`, `getAdminFirestore`, `ensureRankingsFresh`. Foco: pool só
 * da sessão, sem pool → null, grupo inválido → 400, lê `pool-{poolId}-grupo-{X}`.
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApprovedMock, getFirestoreMock, ensureFreshMock } = vi.hoisted(() => ({
  requireApprovedMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  ensureFreshMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/rankings/recalc", () => ({ ensureRankingsFresh: ensureFreshMock }));
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/rankings/pool/grupo/[groupId]/route";

const ctx = (groupId: string) => ({ params: Promise.resolve({ groupId }) });
const req = () => new Request("http://localhost/api/rankings/pool/grupo/A");

function groupDoc(overrides: Record<string, unknown> = {}) {
  return {
    groupId: "A",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
    ],
    ...overrides,
  };
}

function mockDb(opts: {
  poolId?: string;
  groupSnap?: { exists: boolean; data: () => unknown };
}) {
  const groupGet = vi
    .fn()
    .mockResolvedValue(opts.groupSnap ?? { exists: true, data: () => groupDoc() });
  const collection = vi.fn((name: string) => ({
    doc:
      name === "users"
        ? vi.fn(() => ({
            get: vi
              .fn()
              .mockResolvedValue({ exists: true, data: () => (opts.poolId ? { groupId: opts.poolId } : {}) }),
          }))
        : vi.fn((id?: string) => ({ id, get: groupGet })),
  }));
  const getAll = vi.fn(async (...refs: unknown[]) =>
    refs.map(() => ({ exists: false, data: () => undefined })),
  );
  getFirestoreMock.mockReturnValue({ collection, getAll });
  return { groupGet };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

beforeEach(() => {
  vi.clearAllMocks();
  ensureFreshMock.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/rankings/pool/grupo/{groupId}", () => {
  it("sessão inválida → 401, sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req(), ctx("A"));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("grupo da Copa inválido → 400 (não permite doc id arbitrário)", async () => {
    approved();
    mockDb({ poolId: "p1" });
    for (const bad of ["Z", "AA", "../geral", "1"]) {
      const res = await GET(req(), ctx(bad));
      expect(res.status).toBe(400);
    }
  });

  it("usuário SEM pool → 200 null, e NÃO dispara recalc", async () => {
    approved();
    mockDb({ poolId: undefined });
    const res = await GET(req(), ctx("A"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("com pool + doc presente → 200 com entries; recalc roda", async () => {
    approved();
    mockDb({ poolId: "p1" });
    const res = await GET(req(), ctx("A"));
    expect(res.status).toBe(200);
    expect(ensureFreshMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });

  it("lê pool-{poolId}-grupo-{groupId} combinando pool da SESSÃO + grupo da rota", async () => {
    approved();
    const captured: Array<string | undefined> = [];
    const groupDocFn = vi.fn((id?: string) => {
      captured.push(id);
      return { id, get: vi.fn().mockResolvedValue({ exists: true, data: () => groupDoc({ groupId: "C" }) }) };
    });
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "p7" }) }) }))
            : groupDocFn,
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    await GET(req(), ctx("C"));
    expect(captured).toContain("pool-p7-grupo-C");
  });

  it("doc ausente → 200 null", async () => {
    approved();
    mockDb({ poolId: "p1", groupSnap: { exists: false, data: () => undefined } });
    const res = await GET(req(), ctx("A"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc fora do schema → 200 null", async () => {
    approved();
    mockDb({ poolId: "p1", groupSnap: { exists: true, data: () => groupDoc({ groupId: 99 }) } });
    const res = await GET(req(), ctx("A"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
