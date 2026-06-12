/**
 * Testes do Route Handler GET /api/rankings/pool (ranking fechado por pool).
 *
 * Isola a rota: `requireApprovedUser`, `getAdminFirestore` e `ensureRankingsFresh`
 * são mockados. Foco: isolamento multi-tenant (groupId SÓ da sessão), usuário sem
 * pool → null, doc ausente/malformado → null, e que o guard roda só quando há pool.
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

import { GET } from "@/app/api/rankings/pool/route";

// ───────────────────────── Fixtures ─────────────────────────
function rankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "geral",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
    ],
    ...overrides,
  };
}

function mockDb(opts: {
  groupId?: string;
  poolSnap?: { exists: boolean; data: () => unknown };
}) {
  const poolGet = vi
    .fn()
    .mockResolvedValue(opts.poolSnap ?? { exists: true, data: () => rankingDoc() });
  const collection = vi.fn((name: string) => ({
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(
        name === "users"
          ? { exists: true, data: () => (opts.groupId ? { groupId: opts.groupId } : {}) }
          : { exists: false, data: () => undefined },
      ),
      // só rankings usa o get capturado para inspeção do pool
      ...(name === "rankings" ? { get: poolGet } : {}),
    })),
  }));
  getFirestoreMock.mockReturnValue({ collection });
  return { poolGet };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

beforeEach(() => {
  vi.clearAllMocks();
  ensureFreshMock.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/rankings/pool", () => {
  it("sessão inválida → repassa o errorResponse (401), sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("usuário SEM pool → 200 null, e NÃO dispara recalc", async () => {
    approved();
    mockDb({ groupId: undefined });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("usuário com pool + doc presente → 200 com Ranking; recalc-on-read roda", async () => {
    approved();
    mockDb({ groupId: "pool-1" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(ensureFreshMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });

  it("lê o pool DA SESSÃO (pool-{groupId}-geral), nunca um do request", async () => {
    approved();
    const docFn = vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => rankingDoc() }) }));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-42" }) }) }))
            : docFn,
      })),
    });
    await GET();
    expect(docFn).toHaveBeenCalledWith("pool-pool-42-geral");
  });

  it("doc do pool ausente → 200 null", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolSnap: { exists: false, data: () => undefined } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc do pool fora do schema → 200 null", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolSnap: { exists: true, data: () => rankingDoc({ scope: "x" }) } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
