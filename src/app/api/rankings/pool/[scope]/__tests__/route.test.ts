/**
 * Testes do Route Handler GET /api/rankings/pool/{scope} (fase recortada ao pool).
 *
 * Espelha o teste de /api/rankings/pool: mocka `requireApprovedUser`,
 * `getAdminFirestore` e `ensureRankingsFresh`. Foco: pool SÓ da sessão, sem pool →
 * null, scope inválido → 400, doc ausente/malformado → null, e que lê
 * `pool-{groupId}-{scope}`.
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

import { GET } from "@/app/api/rankings/pool/[scope]/route";

const ctx = (scope: string) => ({ params: Promise.resolve({ scope }) });
const req = () => new Request("http://localhost/api/rankings/pool/grupos");

function rankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "grupos",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
    ],
    ...overrides,
  };
}

function mockDb(opts: {
  groupId?: string;
  scopeSnap?: { exists: boolean; data: () => unknown };
}) {
  const scopeGet = vi
    .fn()
    .mockResolvedValue(opts.scopeSnap ?? { exists: true, data: () => rankingDoc() });
  const docFn = vi.fn((id?: string) => ({
    id,
    get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
  }));
  const collection = vi.fn((name: string) => ({
    doc:
      name === "users"
        ? vi.fn(() => ({
            get: vi
              .fn()
              .mockResolvedValue({ exists: true, data: () => (opts.groupId ? { groupId: opts.groupId } : {}) }),
          }))
        : vi.fn((id?: string) => ({ id, get: scopeGet })),
  }));
  const getAll = vi.fn(async (...refs: unknown[]) =>
    refs.map(() => ({ exists: false, data: () => undefined })),
  );
  getFirestoreMock.mockReturnValue({ collection, getAll });
  return { scopeGet, docFn };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

beforeEach(() => {
  vi.clearAllMocks();
  ensureFreshMock.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/rankings/pool/{scope}", () => {
  it("sessão inválida → 401, sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req(), ctx("grupos"));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("scope inválido → 400", async () => {
    approved();
    mockDb({ groupId: "p1" });
    const res = await GET(req(), ctx("not-a-scope"));
    expect(res.status).toBe(400);
  });

  it("usuário SEM pool → 200 null, e NÃO dispara recalc", async () => {
    approved();
    mockDb({ groupId: undefined });
    const res = await GET(req(), ctx("grupos"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("com pool + doc presente → 200 com entries; recalc roda", async () => {
    approved();
    mockDb({ groupId: "p1" });
    const res = await GET(req(), ctx("grupos"));
    expect(res.status).toBe(200);
    expect(ensureFreshMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });

  it("lê pool-{groupId}-{scope} DA SESSÃO", async () => {
    approved();
    const captured: Array<string | undefined> = [];
    const scopeDoc = vi.fn((id?: string) => {
      captured.push(id);
      return { id, get: vi.fn().mockResolvedValue({ exists: true, data: () => rankingDoc() }) };
    });
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "p9" }) }) }))
            : scopeDoc,
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    await GET(req(), ctx("oitavas"));
    expect(captured).toContain("pool-p9-oitavas");
  });

  it("doc ausente → 200 null", async () => {
    approved();
    mockDb({ groupId: "p1", scopeSnap: { exists: false, data: () => undefined } });
    const res = await GET(req(), ctx("grupos"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc fora do schema → 200 null", async () => {
    approved();
    mockDb({ groupId: "p1", scopeSnap: { exists: true, data: () => rankingDoc({ scope: 123 }) } });
    const res = await GET(req(), ctx("grupos"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
