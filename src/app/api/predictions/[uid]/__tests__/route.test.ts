/**
 * Testes do Route Handler GET /api/predictions/[uid] (anti-cola — TASK-02).
 *
 * Barreira de segurança: palpites de OUTRO participante só podem vazar para
 * jogos `status === "finished"`. O filtro server-side é a ÚNICA proteção
 * (Rules não leem match.status). Isolamos a rota mockando:
 *  - `requireApprovedUser` (auth/autorização — testado à parte);
 *  - `getAdminFirestore` (query `predictions.where("uid","==",uid)`);
 *  - `getEffectiveMatches` (fonte autoritativa de status das partidas).
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getFirestoreMock,
  requireApprovedMock,
  getEffectiveMatchesMock,
} = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
  requireApprovedMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/predictions/[uid]/route";

// ───────────────────────── Fixtures ─────────────────────────
function prediction(overrides: Record<string, unknown> = {}) {
  return {
    uid: "target",
    matchId: "m1",
    homeScore: 2,
    awayScore: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function match(id: string, status: string) {
  return {
    id,
    status,
    stage: "grupos",
    groupId: "A",
    kickoffAt: "2026-06-10T18:00:00.000Z",
    homeTeam: "BRA",
    awayTeam: "SRB",
  };
}

/**
 * Firestore mock: predictions.where("uid","==",uid).get() → snapshot dos docs.
 * Captura o uid passado ao `where` para assertion do alvo correto.
 */
function mockPredictions(docs: Array<Record<string, unknown>>) {
  const whereSpy = vi.fn();
  const getDocs = vi.fn().mockResolvedValue({
    docs: docs.map((d) => ({ id: `${d.uid}_${d.matchId}`, data: () => d })),
  });
  whereSpy.mockReturnValue({ get: getDocs });
  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => ({ where: whereSpy })),
  });
  return { whereSpy, getDocs };
}

function req(): Request {
  return {} as unknown as Request;
}
const ctx = (uid: string) => ({ params: Promise.resolve({ uid }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedMock.mockResolvedValue({ user: { uid: "viewer" } });
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/predictions/[uid] — auth", () => {
  it("sem sessão → repassa errorResponse 401, sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("leitor não-approved → repassa errorResponse 403, sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    });
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(403);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/predictions/[uid] — anti-cola (filtro finished)", () => {
  it("palpite de jogo scheduled NUNCA vaza", async () => {
    mockPredictions([prediction({ matchId: "m1" })]);
    getEffectiveMatchesMock.mockResolvedValue([match("m1", "scheduled")]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("palpite de jogo live NUNCA vaza", async () => {
    mockPredictions([prediction({ matchId: "m1" })]);
    getEffectiveMatchesMock.mockResolvedValue([match("m1", "live")]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it.each(["postponed", "canceled"])(
    "palpite de jogo %s NUNCA vaza (whitelist é só finished)",
    async (status) => {
      mockPredictions([prediction({ matchId: "m1" })]);
      getEffectiveMatchesMock.mockResolvedValue([match("m1", status)]);
      const res = await GET(req(), ctx("target"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    },
  );

  it("retorna só palpites de jogos finished (mistura finished+scheduled)", async () => {
    mockPredictions([
      prediction({ matchId: "m1" }),
      prediction({ matchId: "m2", homeScore: 0, awayScore: 0 }),
    ]);
    getEffectiveMatchesMock.mockResolvedValue([
      match("m1", "finished"),
      match("m2", "scheduled"),
    ]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].matchId).toBe("m1");
  });

  it("palpite com matchId órfão (sem partida efetiva) é descartado", async () => {
    mockPredictions([prediction({ matchId: "ghost" })]);
    getEffectiveMatchesMock.mockResolvedValue([match("m1", "finished")]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("auto-consulta (próprio uid) também aplica filtro finished", async () => {
    requireApprovedMock.mockResolvedValue({ user: { uid: "target" } });
    mockPredictions([
      prediction({ matchId: "m1" }),
      prediction({ matchId: "m2" }),
    ]);
    getEffectiveMatchesMock.mockResolvedValue([
      match("m1", "finished"),
      match("m2", "live"),
    ]);
    const res = await GET(req(), ctx("target"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].matchId).toBe("m1");
  });
});

describe("GET /api/predictions/[uid] — query e validação", () => {
  it("consulta predictions filtrando pelo uid do path param (não da sessão)", async () => {
    const { whereSpy } = mockPredictions([]);
    getEffectiveMatchesMock.mockResolvedValue([]);
    await GET(req(), ctx("target"));
    expect(whereSpy).toHaveBeenCalledWith("uid", "==", "target");
  });

  it("uid sem palpites → 200 com lista vazia", async () => {
    mockPredictions([]);
    getEffectiveMatchesMock.mockResolvedValue([match("m1", "finished")]);
    const res = await GET(req(), ctx("ninguem"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("palpite malformado é descartado; válidos de jogo finished retornam", async () => {
    mockPredictions([
      { uid: "target", matchId: "m1" }, // sem homeScore/awayScore → inválido
      prediction({ matchId: "m2" }),
    ]);
    getEffectiveMatchesMock.mockResolvedValue([
      match("m1", "finished"),
      match("m2", "finished"),
    ]);
    const res = await GET(req(), ctx("target"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].matchId).toBe("m2");
  });

  it("falha ao ler fonte de partidas → 500 pt-BR", async () => {
    mockPredictions([prediction()]);
    getEffectiveMatchesMock.mockRejectedValue(new Error("ESPN down"));
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("falha ao ler palpites no Firestore → 500 pt-BR (fail-closed)", async () => {
    const getDocs = vi.fn().mockRejectedValue(new Error("firestore down"));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn(() => ({ where: vi.fn(() => ({ get: getDocs })) })),
    });
    getEffectiveMatchesMock.mockResolvedValue([match("m1", "finished")]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(500);
    expect(typeof (await res.json()).error).toBe("string");
  });

  it("match com status undefined/desconhecido NUNCA vaza (whitelist trava)", async () => {
    mockPredictions([prediction({ matchId: "m1" })]);
    getEffectiveMatchesMock.mockResolvedValue([
      { id: "m1", stage: "grupos", groupId: "A", kickoffAt: "2026-06-10T18:00:00.000Z" },
    ]);
    const res = await GET(req(), ctx("target"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
