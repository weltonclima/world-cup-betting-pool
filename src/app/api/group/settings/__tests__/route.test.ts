/**
 * Testes do Route Handler GET/PATCH /api/group/settings (PRD-10 TASK-07).
 *
 * PATCH é partial-update do PRÓPRIO pool (groupId da sessão — D2). `.strict()`
 * rejeita campos imutáveis (slug/status/adminId). `maxParticipants: null` LIMPA o
 * limite via `FieldValue.delete()` (sem sentinela "" — review BR-01). O 422 NÃO
 * vaza `issues` do Zod (review WR-03 — minimize sensitive data in errors).
 *
 * Mocks: server-only, authorizeGroupAdminOfPool, getAdminFirestore,
 * firebase-admin/firestore (FieldValue). `poolSchema` REAL.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => "__delete__" },
}));

import { NextResponse } from "next/server";

import { GET, PATCH } from "@/app/api/group/settings/route";

type PatchReq = Parameters<typeof PATCH>[0];

function makeReq(opts: { body?: unknown; badJson?: boolean }): PatchReq {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PatchReq;
}

function pool(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pool-1",
    name: "Bolão FC",
    slug: "pool-1",
    status: "active",
    adminId: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

// Tipado: sem a assinatura, `mock.calls[0]` seria tupla vazia e `calls[0][0]`
// falharia no tsc (vitest run/esbuild não checa tipos).
const updateMock = vi.fn<(patch: Record<string, unknown>) => Promise<void>>(
  async () => {},
);

function mockDb(opts: { exists?: boolean; data?: Record<string, unknown> }): void {
  const snap = { exists: opts.exists ?? true, data: () => opts.data ?? pool() };
  getFirestoreMock.mockReturnValue({
    collection: () => ({
      doc: () => ({ get: async () => snap, update: updateMock }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({
    auth: { uid: "admin-1", groupId: "pool-1", role: "group_admin" },
  });
});

describe("GET /api/group/settings", () => {
  it("401 quando não autorizado", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("404 pool inexistente", async () => {
    mockDb({ exists: false });
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("200 devolve o pool da sessão", async () => {
    mockDb({});
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pool: { id: string } };
    expect(body.pool.id).toBe("pool-1");
  });
});

describe("PATCH /api/group/settings", () => {
  it("400 JSON malformado", async () => {
    const res = await PATCH(makeReq({ badJson: true }));
    expect(res.status).toBe(400);
  });

  it("422 rejeita campo imutável (strict) e NÃO vaza issues (WR-03)", async () => {
    const res = await PATCH(makeReq({ body: { slug: "novo-slug" } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
    expect(body["issues"]).toBeUndefined();
  });

  it("404 pool inexistente", async () => {
    mockDb({ exists: false });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(404);
  });

  it("200 atualiza o name", async () => {
    mockDb({ data: pool({ name: "Novo Nome" }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["name"]).toBe("Novo Nome");
  });

  it("200 maxParticipants null → FieldValue.delete (BR-01, sem sentinela)", async () => {
    mockDb({});
    const res = await PATCH(makeReq({ body: { maxParticipants: null } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["maxParticipants"]).toBe("__delete__");
  });

  it("200 maxParticipants número → define o valor", async () => {
    mockDb({ data: pool({ maxParticipants: 50 }) });
    const res = await PATCH(makeReq({ body: { maxParticipants: 50 } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["maxParticipants"]).toBe(50);
  });

  it("200 predictionsLocked true → persiste true", async () => {
    mockDb({ data: pool({ predictionsLocked: true }) });
    const res = await PATCH(makeReq({ body: { predictionsLocked: true } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["predictionsLocked"]).toBe(true);
  });

  it("200 predictionsLocked false → persiste false (destravar)", async () => {
    mockDb({ data: pool({ predictionsLocked: false }) });
    const res = await PATCH(makeReq({ body: { predictionsLocked: false } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["predictionsLocked"]).toBe(false);
  });

  it("200 sem predictionsLocked → campo ausente no patch (não toca o valor existente)", async () => {
    mockDb({ data: pool({ predictionsLocked: true }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("predictionsLocked" in patch).toBe(false);
  });

  it("422 predictionsLocked string → rejeitado (strict type)", async () => {
    const res = await PATCH(makeReq({ body: { predictionsLocked: "yes" } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
    expect(body["issues"]).toBeUndefined();
  });

  it("200 splitPhaseRanking true → persiste true", async () => {
    mockDb({ data: pool({ splitPhaseRanking: true }) });
    const res = await PATCH(makeReq({ body: { splitPhaseRanking: true } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["splitPhaseRanking"]).toBe(true);
  });

  it("200 splitPhaseRanking false → persiste false (desligar)", async () => {
    mockDb({ data: pool({ splitPhaseRanking: false }) });
    const res = await PATCH(makeReq({ body: { splitPhaseRanking: false } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["splitPhaseRanking"]).toBe(false);
  });

  it("200 sem splitPhaseRanking → campo ausente no patch (não toca o valor existente)", async () => {
    mockDb({ data: pool({ splitPhaseRanking: true }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("splitPhaseRanking" in patch).toBe(false);
  });

  it("422 splitPhaseRanking string → rejeitado (strict type)", async () => {
    const res = await PATCH(makeReq({ body: { splitPhaseRanking: "yes" } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
    expect(body["issues"]).toBeUndefined();
  });
});
