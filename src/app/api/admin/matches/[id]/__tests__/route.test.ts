/**
 * Testes do Route Handler PUT /api/admin/matches/[id] (PRD-11 TASK-04).
 *
 * Edição manual de placar/status: persiste em `matches/{id}` com
 * `isManualOverride: true` (blinda do sync). Herda os campos não-editáveis da
 * partida efetiva atual. Coerência placar↔status reforçada pelo `matchSchema`
 * (refine) → body incoerente devolve 422.
 *
 * Casos:
 *  1. 401 — não autorizado
 *  2. 400 — id ausente no path
 *  3. 400 — JSON malformado
 *  4. 422 — status fora do enum (body inválido)
 *  5. 404 — partida inexistente na fonte efetiva
 *  6. 422 — incoerência placar↔status (finished sem placar)
 *  7. 200 — edição válida marca isManualOverride e grava o doc
 *
 * Mocks: server-only, authorizeGroupAdmin, getEffectiveMatches, writeAuditLog,
 * getAdminFirestore. Schemas REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeMock,
  getEffectiveMatchesMock,
  writeAuditLogMock,
  getFirestoreMock,
  recalcBestEffortMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  recalcBestEffortMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/app/api/admin/groups/_authorize", () => ({
  authorizeGroupAdmin: authorizeMock,
}));
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));
vi.mock("@/server/admin/auditLog", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/rankings/recalc", () => ({
  recalcRankingsBestEffort: recalcBestEffortMock,
}));

import { NextResponse } from "next/server";

import { DELETE, PUT } from "@/app/api/admin/matches/[id]/route";
import type { MatchWithId } from "@/types/matches";

type PutParams = Parameters<typeof PUT>;

function makeReq(opts: { body?: unknown; badJson?: boolean }): PutParams[0] {
  return {
    headers: { get: () => null },
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PutParams[0];
}

function ctx(id: string): PutParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as PutParams[1];
}

function effMatch(id: string, over: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-06-11T12:00:00Z",
    stage: "grupos",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...over,
  };
}

// Tipado (não `vi.fn(async () => {})`): sem a assinatura, `mock.calls[0]` seria
// uma tupla vazia e `calls[0][0]` falharia no tsc (vitest run/esbuild não checa).
const matchSet = vi.fn<(doc: Record<string, unknown>) => Promise<void>>(
  async () => {},
);
const matchDelete = vi.fn(async () => {});
const cacheDelete = vi.fn(async () => {});
let matchSnap: { exists: boolean };

function mockDb(opts: { matchExists?: boolean } = {}): void {
  matchSnap = { exists: opts.matchExists ?? true };
  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({
      doc: (id?: string) =>
        name === "matches"
          ? { id, set: matchSet, delete: matchDelete, get: async () => matchSnap }
          : { id, delete: cacheDelete },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ authorized: true, actorUid: "admin-1" });
  writeAuditLogMock.mockResolvedValue(undefined);
  recalcBestEffortMock.mockResolvedValue(undefined);
  mockDb();
});

describe("PUT /api/admin/matches/[id]", () => {
  it("401 quando não autorizado", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await PUT(makeReq({ body: { status: "live", homeScore: 1, awayScore: 0 } }), ctx("m1"));
    expect(res.status).toBe(401);
  });

  it("400 id ausente no path", async () => {
    const res = await PUT(makeReq({ body: { status: "scheduled", homeScore: null, awayScore: null } }), ctx(""));
    expect(res.status).toBe(400);
  });

  it("400 JSON malformado", async () => {
    const res = await PUT(makeReq({ badJson: true }), ctx("m1"));
    expect(res.status).toBe(400);
  });

  it("422 status fora do enum", async () => {
    const res = await PUT(makeReq({ body: { status: "weird", homeScore: null, awayScore: null } }), ctx("m1"));
    expect(res.status).toBe(422);
  });

  it("404 partida inexistente na fonte efetiva", async () => {
    getEffectiveMatchesMock.mockResolvedValue([]);
    const res = await PUT(makeReq({ body: { status: "scheduled", homeScore: null, awayScore: null } }), ctx("ghost"));
    expect(res.status).toBe(404);
  });

  it("422 incoerência placar↔status (finished sem placar)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([effMatch("m1")]);
    const res = await PUT(makeReq({ body: { status: "finished", homeScore: null, awayScore: null } }), ctx("m1"));
    expect(res.status).toBe(422);
    expect(matchSet).not.toHaveBeenCalled();
  });

  it("200 edição válida marca isManualOverride e grava", async () => {
    getEffectiveMatchesMock.mockResolvedValue([effMatch("m1")]);
    const res = await PUT(makeReq({ body: { status: "finished", homeScore: 3, awayScore: 1 } }), ctx("m1"));
    expect(res.status).toBe(200);

    expect(matchSet).toHaveBeenCalledOnce();
    const saved = matchSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(saved["isManualOverride"]).toBe(true);
    expect(saved["status"]).toBe("finished");
    expect(saved["homeScore"]).toBe(3);
    expect(saved["editedBy"]).toBe("admin-1");
    // Encadeia o recalc do ranking (placar manual é a única fonte de resultado).
    expect(recalcBestEffortMock).toHaveBeenCalledOnce();
    // Invalida o cache das rotas públicas de jogos (lista + detalhe) — D2.
    expect(revalidatePathMock).toHaveBeenCalledWith("/api/matches");
    expect(revalidatePathMock).toHaveBeenCalledWith("/api/matches/m1");
  });

  it("não dispara recalc quando a edição é rejeitada (422)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([effMatch("m1")]);
    await PUT(makeReq({ body: { status: "finished", homeScore: null, awayScore: null } }), ctx("m1"));
    expect(recalcBestEffortMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/matches/[id] (un-protect)", () => {
  it("401 quando não autorizado", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await DELETE(makeReq({}), ctx("m1"));
    expect(res.status).toBe(401);
  });

  it("400 id ausente no path", async () => {
    const res = await DELETE(makeReq({}), ctx(""));
    expect(res.status).toBe(400);
  });

  it("404 quando a partida não possui edição manual", async () => {
    mockDb({ matchExists: false });
    const res = await DELETE(makeReq({}), ctx("m1"));
    expect(res.status).toBe(404);
    expect(matchDelete).not.toHaveBeenCalled();
  });

  it("200 remove o override e devolve ao sync oficial", async () => {
    mockDb({ matchExists: true });
    const res = await DELETE(makeReq({}), ctx("m1"));
    expect(res.status).toBe(200);
    expect(matchDelete).toHaveBeenCalledOnce();
    const body = (await res.json()) as { cleared: boolean };
    expect(body.cleared).toBe(true);
    // Remover override muda o resultado efetivo → recalcula.
    expect(recalcBestEffortMock).toHaveBeenCalledOnce();
    // Invalida o cache das rotas públicas de jogos (lista + detalhe) — D2.
    expect(revalidatePathMock).toHaveBeenCalledWith("/api/matches");
    expect(revalidatePathMock).toHaveBeenCalledWith("/api/matches/m1");
  });

  it("não dispara recalc quando não há override a remover (404)", async () => {
    mockDb({ matchExists: false });
    await DELETE(makeReq({}), ctx("m1"));
    expect(recalcBestEffortMock).not.toHaveBeenCalled();
  });
});
