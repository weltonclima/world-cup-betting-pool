/**
 * Testes do Route Handler GET /api/rankings/{scope} (recalc-on-read).
 *
 * Isola a rota: `ensureRankingsFresh` é mockado (o guard de frescor tem testes
 * próprios em src/server/rankings/recalc). Aqui validamos: validação de escopo
 * (400), leitura do doc (200 + Ranking validado), doc ausente/malformado (null),
 * e que o guard é chamado antes de servir.
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getFirestoreMock, ensureFreshMock, requireApprovedMock } = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
  ensureFreshMock: vi.fn(),
  requireApprovedMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("@/server/rankings/recalc", () => ({
  ensureRankingsFresh: ensureFreshMock,
}));

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/rankings/[scope]/route";

// ───────────────────────── Fixtures ─────────────────────────
function rankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "geral",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
      { uid: "u2", nickname: "bia", name: "Bia", position: 2, points: 8, wrong: 4, accuracy: 67 },
    ],
    ...overrides,
  };
}

/** Firestore mock: rankings/{scope}.get() → snap controlável. */
function mockDb(snap: { exists: boolean; data: () => unknown }) {
  const getDoc = vi.fn().mockResolvedValue(snap);
  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: getDoc })) })),
  });
  return { getDoc };
}

function req(..._ignored: unknown[]): Request {
  return {} as unknown as Request;
}
const ctx = (scope: string) => ({ params: Promise.resolve({ scope }) });

beforeEach(() => {
  vi.clearAllMocks();
  ensureFreshMock.mockResolvedValue(undefined);
  requireApprovedMock.mockResolvedValue({ user: { uid: "u1" } });
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/rankings/{scope}", () => {
  it("sessão não aprovada → repassa errorResponse (401), sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req(), ctx("geral"));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("escopo inválido → 400, sem tocar Firestore nem o guard", async () => {
    const res = await GET(req("xyz"), ctx("xyz"));
    expect(res.status).toBe(400);
    expect(ensureFreshMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("escopo válido + doc presente → 200 com Ranking validado; chama ensureRankingsFresh", async () => {
    mockDb({ exists: true, data: () => rankingDoc({ scope: "geral" }) });
    const res = await GET(req("geral"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(ensureFreshMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.scope).toBe("geral");
    expect(body.entries).toHaveLength(2);
  });

  it("recalc-on-read roda ANTES de ler o doc (guard primeiro)", async () => {
    const order: string[] = [];
    ensureFreshMock.mockImplementation(async () => {
      order.push("ensureFresh");
    });
    const getDoc = vi.fn().mockImplementation(async () => {
      order.push("getDoc");
      return { exists: true, data: () => rankingDoc() };
    });
    getFirestoreMock.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: getDoc })) })),
    });
    await GET(req("geral"), ctx("geral"));
    expect(order).toEqual(["ensureFresh", "getDoc"]);
  });

  it("doc ausente → 200 com body null", async () => {
    mockDb({ exists: false, data: () => undefined });
    const res = await GET(req("oitavas"), ctx("oitavas"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc fora do schema → 200 com body null (não propaga)", async () => {
    mockDb({ exists: true, data: () => rankingDoc({ scope: "invalido" }) });
    const res = await GET(req("geral"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it.each(["geral", "grupos", "oitavas", "quartas", "semifinal", "final"])(
    "aceita escopo válido %s",
    async (scope) => {
      mockDb({ exists: true, data: () => rankingDoc({ scope }) });
      const res = await GET(req(), ctx(scope));
      expect(res.status).toBe(200);
    },
  );
});
