/**
 * Testes do endpoint POST /api/group/predictions (PRD-12 TASK-02): palpite
 * manual lançado pelo admin de grupo para um membro aprovado do próprio pool,
 * em jogo BLOQUEADO.
 *
 * Guardas (fail-closed, antes de qualquer escrita):
 *  - autorização via authorizeGroupAdminOfPool (groupId da sessão — D2);
 *  - alvo: existe + aprovado + mesmo groupId + não super_admin;
 *  - override de lock: jogo DEVE estar bloqueado (futuro → 409);
 *  - payload gravado só com chaves de predictionSchema (.strict — não-descarte);
 *  - editedBy = admin da sessão; uid = alvo (distintos);
 *  - A2: read-before-write → audit anterior→novo;
 *  - recalc in-process (recalcRankingsBestEffort), nunca /score.
 *
 * Mocks: server-only, authorize, getAdminFirestore, getEffectiveMatches, recalc,
 * writeAuditLog. predictionSchema/helpers REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { predictionSchema } from "@/schemas";

const {
  authorizeMock,
  getFirestoreMock,
  fetchMatchesMock,
  recalcBestEffortMock,
  auditMock,
} = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  fetchMatchesMock: vi.fn(),
  recalcBestEffortMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: fetchMatchesMock,
}));
vi.mock("@/server/rankings/recalc", () => ({
  recalcRankingsBestEffort: recalcBestEffortMock,
}));
vi.mock("@/server/admin/auditLog", () => ({ writeAuditLog: auditMock }));

import { POST } from "@/app/api/group/predictions/route";

function makeReq(opts: { body?: unknown; badJson?: boolean }): Request {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as Request;
}

function userDoc(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: "membro-1",
    name: "Membro",
    nickname: "membro",
    email: "membro@example.com",
    role: "participant",
    status: "approved",
    groupId: "pool-1",
    ...over,
  };
}

// Jogo ENCERRADO (bloqueado) por padrão. kickoff no passado.
function match(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "match-9",
    stage: "grupos",
    groupId: "A",
    kickoffAt: "2026-06-01T12:00:00+00:00",
    status: "finished",
    homeScore: 2,
    awayScore: 0,
    ...over,
  };
}

const setMock = vi.fn<(payload: Record<string, unknown>, opts: unknown) => Promise<void>>(
  async () => {},
);
const getMock = vi.fn();

/** Firestore: users/{uid}.get() → user; predictions/{id}.get()/set(). */
function mockDb(opts: {
  user?: Record<string, unknown> | null;
  prior?: Record<string, unknown> | null;
}): void {
  const userSnap = {
    exists: opts.user !== null,
    data: () => opts.user ?? undefined,
  };
  const predSnap = {
    exists: opts.prior != null,
    data: () => opts.prior ?? undefined,
  };
  getMock.mockImplementation(async () => predSnap);
  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({
      doc: () => {
        if (name === "users") return { get: async () => userSnap };
        return { get: getMock, set: setMock };
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({
    auth: { uid: "admin-1", groupId: "pool-1", role: "group_admin" },
  });
  fetchMatchesMock.mockResolvedValue([match()]);
  auditMock.mockResolvedValue("log-1");
  recalcBestEffortMock.mockResolvedValue(undefined);
});

const okBody = {
  targetUid: "membro-1",
  matchId: "match-9",
  homeScore: 2,
  awayScore: 0,
};

describe("POST /api/group/predictions", () => {
  it("403 quando não autorizado (gate barra antes do Firestore)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: Response.json({ error: "Acesso negado." }, { status: 403 }),
    });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(403);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("400 JSON malformado", async () => {
    mockDb({ user: userDoc() });
    const res = await POST(makeReq({ badJson: true }) as never);
    expect(res.status).toBe(400);
  });

  it("422 body inválido (sem targetUid)", async () => {
    mockDb({ user: userDoc() });
    const { targetUid: _t, ...sem } = okBody;
    void _t;
    const res = await POST(makeReq({ body: sem }) as never);
    expect(res.status).toBe(422);
  });

  it("404 alvo inexistente", async () => {
    mockDb({ user: null });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(404);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("403 alvo de OUTRO pool (isolamento D2)", async () => {
    mockDb({ user: userDoc({ groupId: "outro-pool" }) });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(403);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("403 alvo não-aprovado", async () => {
    mockDb({ user: userDoc({ status: "pending" }) });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(403);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("403 alvo é super_admin (intocável)", async () => {
    mockDb({ user: userDoc({ role: "super_admin" }) });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(403);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("404 jogo inexistente", async () => {
    mockDb({ user: userDoc() });
    fetchMatchesMock.mockResolvedValue([]);
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(404);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("409 jogo NÃO bloqueado (futuro/scheduled)", async () => {
    mockDb({ user: userDoc() });
    fetchMatchesMock.mockResolvedValue([
      match({ status: "scheduled", kickoffAt: "2030-01-01T00:00:00+00:00" }),
    ]);
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(409);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("200 sucesso (jogo encerrado): grava doc válido e recalcula", async () => {
    mockDb({ user: userDoc() });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(200);

    const payload = setMock.mock.calls[0]![0] as Record<string, unknown>;
    // uid do alvo, editedBy do admin (distintos) — sessão nunca contaminada.
    expect(payload["uid"]).toBe("membro-1");
    expect(payload["editedBy"]).toBe("admin-1");
    expect(payload["editedByRole"]).toBe("group_admin");
    expect(typeof payload["editedAt"]).toBe("string");
    // Não-descarte: payload passa no schema .strict() (não some do recalc).
    expect(predictionSchema.safeParse(payload).success).toBe(true);

    expect(recalcBestEffortMock).toHaveBeenCalledTimes(1);
  });

  it("200 jogo bloqueado-não-finalizado (ao vivo): grava sem erro", async () => {
    mockDb({ user: userDoc() });
    fetchMatchesMock.mockResolvedValue([
      match({ status: "live", homeScore: null, awayScore: null }),
    ]);
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledTimes(1);
  });

  it("A2 read-before-write: audit de sobrescrita cita placar anterior→novo", async () => {
    mockDb({
      user: userDoc(),
      prior: { uid: "membro-1", matchId: "match-9", homeScore: 1, awayScore: 1 },
    });
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledTimes(1);
    const arg = auditMock.mock.calls[0]![0] as { type: string; message: string };
    expect(arg.type).toBe("group_admin_manual_prediction");
    expect(arg.message).toContain("1"); // placar anterior 1x1
    expect(arg.message).toContain("2"); // novo 2x0
  });

  it("audit best-effort: falha no log NÃO derruba o 200", async () => {
    mockDb({ user: userDoc() });
    auditMock.mockRejectedValue(new Error("audit down"));
    const res = await POST(makeReq({ body: okBody }) as never);
    expect(res.status).toBe(200);
  });
});
