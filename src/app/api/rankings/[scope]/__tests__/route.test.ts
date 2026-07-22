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

/**
 * Firestore mock: rankings/{scope}.get() → snap controlável; `getAll` serve os
 * users vivos da hidratação (default: nenhum → entries mantêm o snapshot).
 */
function mockDb(
  snap: { exists: boolean; data: () => unknown },
  liveUsers: Record<string, Record<string, unknown>> = {},
) {
  const getDoc = vi.fn().mockResolvedValue(snap);
  const getAll = vi.fn(async (...refs: Array<{ uid?: string }>) =>
    refs.map((r) => {
      const data = r.uid ? liveUsers[r.uid] : undefined;
      return { id: r.uid, exists: data !== undefined, data: () => data };
    }),
  );
  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn((uid?: string) => ({ uid, get: getDoc })) })),
    getAll,
  });
  return { getDoc, getAll };
}

// TASK-21: o handler agora lê `?championship` via `new URL(request.url)`, então o
// request precisa de uma URL real. Segundo arg opcional = valor de `?championship`.
function req(_scope?: unknown, championship?: string): Request {
  const q = typeof championship === "string" ? `?championship=${championship}` : "";
  return new Request(`http://localhost/api/rankings/scope${q}`);
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
      collection: vi.fn(() => ({ doc: vi.fn((uid?: string) => ({ uid, get: getDoc })) })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    await GET(req("geral"), ctx("geral"));
    expect(order).toEqual(["ensureFresh", "getDoc"]);
  });

  it("hidrata foto/apelido/nome AO VIVO (sobrescreve o snapshot do recalc)", async () => {
    mockDb({ exists: true, data: () => rankingDoc({ scope: "geral" }) }, {
      u1: { avatarUrl: "data:image/jpeg;base64,NEW", nickname: "ana2", name: "Ana Nova" },
    });
    const res = await GET(req("geral"), ctx("geral"));
    const body = await res.json();
    const u1 = body.entries.find((e: { uid: string }) => e.uid === "u1");
    expect(u1.avatarUrl).toBe("data:image/jpeg;base64,NEW");
    expect(u1.nickname).toBe("ana2");
    expect(u1.name).toBe("Ana Nova");
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

// ───────────────────── TASK-21: ?championship ─────────────────────
/** Doc de ranking por campeonato (scope namespaced + `championshipId`). */
function champDoc(id: string) {
  return {
    scope: `${id}-geral`,
    championshipId: id,
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
    ],
  };
}

/** Firestore mock que captura o doc-id lido em `rankings`. */
function mockDbCapture(snap: { exists: boolean; data: () => unknown }) {
  const captured: string[] = [];
  const getDoc = vi.fn().mockResolvedValue(snap);
  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => {
        if (id) captured.push(id);
        return { uid: id, get: getDoc };
      }),
    })),
    getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
  });
  return { captured };
}

describe("GET /api/rankings/{scope} — ?championship (TASK-21)", () => {
  it("sem param → doc bare servido (compat byte-idêntica)", async () => {
    const { captured } = mockDbCapture({ exists: true, data: () => rankingDoc({ scope: "geral" }) });
    const res = await GET(req("geral"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(captured).toContain("geral"); // doc bare, sem prefixo de campeonato
  });

  it("?championship=fifa.world → tratado como legado (doc bare)", async () => {
    const { captured } = mockDbCapture({ exists: true, data: () => rankingDoc({ scope: "geral" }) });
    const res = await GET(req("geral", "fifa.world"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(captured).toContain("geral");
  });

  it("?championship={liga} + geral → serve rankings/{id}-geral via schema dedicado", async () => {
    const { captured } = mockDbCapture({ exists: true, data: () => champDoc("bra.1-2026") });
    const res = await GET(req("geral", "bra.1-2026"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(captured).toContain("bra.1-2026-geral");
    const body = await res.json();
    expect(body.championshipId).toBe("bra.1-2026");
    expect(body.entries).toHaveLength(1);
  });

  it("?championship={liga} + fase → 400, sem tocar Firestore nem o guard", async () => {
    const res = await GET(req("grupos", "bra.1-2026"), ctx("grupos"));
    expect(res.status).toBe(400);
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("?championship=desconhecido → 400, sem tocar Firestore", async () => {
    const res = await GET(req("geral", "nao.existe-2026"), ctx("geral"));
    expect(res.status).toBe(400);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("doc por campeonato ausente → 200 null", async () => {
    mockDbCapture({ exists: false, data: () => undefined });
    const res = await GET(req("geral", "bra.1-2026"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc por campeonato SEM championshipId → 200 null (schema dedicado rejeita)", async () => {
    mockDbCapture({ exists: true, data: () => rankingDoc({ scope: "bra.1-2026-geral" }) });
    const res = await GET(req("geral", "bra.1-2026"), ctx("geral"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
