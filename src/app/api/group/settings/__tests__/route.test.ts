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

const { authorizeMock, getFirestoreMock, recalcMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  recalcMock: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/rankings/recalc", () => ({
  recalcRankingsBestEffort: recalcMock,
}));
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

  it("200 ignoreOvertimeGoals true → persiste true", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: true }) });
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: true } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["ignoreOvertimeGoals"]).toBe(true);
  });

  it("200 ignoreOvertimeGoals false → persiste false (desligar)", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: false }) });
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: false } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["ignoreOvertimeGoals"]).toBe(false);
  });

  it("200 sem ignoreOvertimeGoals → campo ausente no patch (não toca o valor existente)", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: true }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("ignoreOvertimeGoals" in patch).toBe(false);
  });

  it("422 ignoreOvertimeGoals string → rejeitado (strict type)", async () => {
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: "yes" } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
  });

  it("dispara recalc global quando ignoreOvertimeGoals MUDA (false → true)", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: false }) });
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: true } }));
    expect(res.status).toBe(200);
    expect(recalcMock).toHaveBeenCalledTimes(1);
  });

  it("dispara recalc quando liga a flag ausente (undefined → true)", async () => {
    mockDb({ data: pool() }); // sem o campo → tratado como false
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: true } }));
    expect(res.status).toBe(200);
    expect(recalcMock).toHaveBeenCalledTimes(1);
  });

  it("NÃO dispara recalc quando ignoreOvertimeGoals não muda (true → true)", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: true }) });
    const res = await PATCH(makeReq({ body: { ignoreOvertimeGoals: true } }));
    expect(res.status).toBe(200);
    expect(recalcMock).not.toHaveBeenCalled();
  });

  it("NÃO dispara recalc quando o PATCH não toca a flag (só nome)", async () => {
    mockDb({ data: pool({ ignoreOvertimeGoals: true }) });
    const res = await PATCH(makeReq({ body: { name: "Outro Nome" } }));
    expect(res.status).toBe(200);
    expect(recalcMock).not.toHaveBeenCalled();
  });

  // ── TASK-01 personalizacao-grupo: logoBase64 ──────────────────────────────
  it("200 logoBase64 → persiste o valor", async () => {
    const dataUrl = "data:image/jpeg;base64,/9j/logo";
    mockDb({ data: pool({ logoBase64: dataUrl }) });
    const res = await PATCH(makeReq({ body: { logoBase64: dataUrl } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["logoBase64"]).toBe(dataUrl);
  });

  it("200 sem logoBase64 → campo ausente no patch (não toca o valor existente)", async () => {
    mockDb({ data: pool({ logoBase64: "data:image/jpeg;base64,/9j/x" }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("logoBase64" in patch).toBe(false);
  });

  it("422 logoBase64 acima do limite → rejeitado", async () => {
    const res = await PATCH(makeReq({ body: { logoBase64: "a".repeat(300_001) } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
  });

  it("422 logoBase64 não-string → rejeitado (strict type)", async () => {
    const res = await PATCH(makeReq({ body: { logoBase64: 123 } }));
    expect(res.status).toBe(422);
  });

  it("422 logoBase64 com prefixo não-raster (SVG/HTML) → rejeitado (defense-in-depth M1)", async () => {
    for (const bad of [
      "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==",
      "data:text/html,<script>alert(1)</script>",
      "https://evil.example/x.png",
    ]) {
      const res = await PATCH(makeReq({ body: { logoBase64: bad } }));
      expect(res.status).toBe(422);
    }
  });

  it("200 logoBase64 com prefixo raster válido (png/webp) → aceito", async () => {
    for (const ok of ["data:image/png;base64,iVBOR", "data:image/webp;base64,UklGR"]) {
      mockDb({ data: pool({ logoBase64: ok }) });
      const res = await PATCH(makeReq({ body: { logoBase64: ok } }));
      expect(res.status).toBe(200);
    }
  });

  it("NÃO dispara recalc ao mudar apenas o logo", async () => {
    mockDb({ data: pool({ logoBase64: "data:image/jpeg;base64,/9j/y" }) });
    const res = await PATCH(makeReq({ body: { logoBase64: "data:image/jpeg;base64,/9j/y" } }));
    expect(res.status).toBe(200);
    expect(recalcMock).not.toHaveBeenCalled();
  });

  // ── TASK-02 personalizacao-grupo: cores por tema ──────────────────────────
  it("200 primaryColorLight/Dark hex válido → persiste cada campo", async () => {
    mockDb({ data: pool({ primaryColorLight: "#1a2b3c", primaryColorDark: "#abcdef" }) });
    const res = await PATCH(
      makeReq({ body: { primaryColorLight: "#1a2b3c", primaryColorDark: "#abcdef" } }),
    );
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["primaryColorLight"]).toBe("#1a2b3c");
    expect(patch["primaryColorDark"]).toBe("#abcdef");
  });

  it("200 sem cores → campos ausentes no patch", async () => {
    mockDb({ data: pool({ primaryColorLight: "#111111" }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("primaryColorLight" in patch).toBe(false);
    expect("primaryColorDark" in patch).toBe(false);
  });

  it("200 aceita definir só uma das cores (independentes)", async () => {
    mockDb({ data: pool({ primaryColorDark: "#222222" }) });
    const res = await PATCH(makeReq({ body: { primaryColorDark: "#222222" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["primaryColorDark"]).toBe("#222222");
    expect("primaryColorLight" in patch).toBe(false);
  });

  it("422 cor hex inválida → rejeitado", async () => {
    for (const bad of ["red", "#123", "123456", "#12345g"]) {
      const res = await PATCH(makeReq({ body: { primaryColorLight: bad } }));
      expect(res.status).toBe(422);
    }
  });

  it("422 cor não-string → rejeitado", async () => {
    const res = await PATCH(makeReq({ body: { primaryColorDark: 123 } }));
    expect(res.status).toBe(422);
  });

  it("seta o cookie pool-primary ao mudar uma cor (SSR sem flash, TASK-03)", async () => {
    mockDb({ data: pool({ primaryColorLight: "#1a2b3c" }) });
    const res = await PATCH(makeReq({ body: { primaryColorLight: "#1a2b3c" } }));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get("pool-primary");
    expect(cookie?.value).toContain("#1a2b3c");
    expect(cookie?.httpOnly).toBe(false);
  });

  it("NÃO seta o cookie pool-primary quando o PATCH não toca cor", async () => {
    mockDb({ data: pool({ name: "Novo" }) });
    const res = await PATCH(makeReq({ body: { name: "Novo" } }));
    expect(res.status).toBe(200);
    expect(res.cookies.get("pool-primary")).toBeUndefined();
  });

  // ── TASK-07 multi-championship: enabledChampionships + rankingMode ─────────
  it("200 enabledChampionships válido + rankingMode → persiste ambos", async () => {
    const ids = ["fifa.world", "bra.1-2026"];
    mockDb({ data: pool({ enabledChampionships: ids, rankingMode: "por-campeonato" }) });
    const res = await PATCH(
      makeReq({ body: { enabledChampionships: ids, rankingMode: "por-campeonato" } }),
    );
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["enabledChampionships"]).toEqual(ids);
    expect(patch["rankingMode"]).toBe("por-campeonato");
  });

  it("422 enabledChampionships com id fora do catálogo → NÃO chama update", async () => {
    mockDb({});
    const res = await PATCH(
      makeReq({ body: { enabledChampionships: ["fifa.world", "xyz.999-2026"] } }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("422 enabledChampionships vazio (piso ≥ 1) → NÃO chama update", async () => {
    mockDb({});
    const res = await PATCH(makeReq({ body: { enabledChampionships: [] } }));
    expect(res.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("422 enabledChampionships com duplicados → NÃO chama update", async () => {
    mockDb({});
    const res = await PATCH(
      makeReq({ body: { enabledChampionships: ["fifa.world", "fifa.world"] } }),
    );
    expect(res.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("422 enabledChampionships acima do teto → NÃO chama update", async () => {
    mockDb({});
    const ids = Array.from({ length: 11 }, (_, i) => `champ-${i}`);
    const res = await PATCH(makeReq({ body: { enabledChampionships: ids } }));
    expect(res.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("422 rankingMode fora do enum → rejeitado (strict)", async () => {
    const res = await PATCH(makeReq({ body: { rankingMode: "misto" } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("Dados inválidos.");
  });

  it("200 parcial: só rankingMode → não toca enabledChampionships", async () => {
    mockDb({ data: pool({ rankingMode: "geral" }) });
    const res = await PATCH(makeReq({ body: { rankingMode: "geral" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["rankingMode"]).toBe("geral");
    expect("enabledChampionships" in patch).toBe(false);
  });

  it("200 parcial: só enabledChampionships válido → não toca rankingMode", async () => {
    const ids = ["fifa.world"];
    mockDb({ data: pool({ enabledChampionships: ids }) });
    const res = await PATCH(makeReq({ body: { enabledChampionships: ids } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["enabledChampionships"]).toEqual(ids);
    expect("rankingMode" in patch).toBe(false);
  });

  it("200 enabledChampionships no limite exato (10 ids válidos) → persiste", async () => {
    const ids = [
      "fifa.world",
      "conmebol.america-2026",
      "uefa.euro-2026",
      "uefa.nations-2026",
      "fifa.cwc-2026",
      "bra.1-2026",
      "eng.1-2026",
      "esp.1-2026",
      "ita.1-2026",
      "ger.1-2026",
    ];
    mockDb({ data: pool({ enabledChampionships: ids }) });
    const res = await PATCH(makeReq({ body: { enabledChampionships: ids } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch["enabledChampionships"]).toEqual(ids);
  });

  it("NÃO dispara recalc ao mudar só config de campeonato", async () => {
    mockDb({ data: pool({ rankingMode: "por-campeonato" }) });
    const res = await PATCH(makeReq({ body: { rankingMode: "por-campeonato" } }));
    expect(res.status).toBe(200);
    expect(recalcMock).not.toHaveBeenCalled();
  });

  it("200 sem os campos novos → ausentes no patch (retrocompat)", async () => {
    mockDb({ data: pool({ name: "Novo Nome" }) });
    const res = await PATCH(makeReq({ body: { name: "Novo Nome" } }));
    expect(res.status).toBe(200);
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("enabledChampionships" in patch).toBe(false);
    expect("rankingMode" in patch).toBe(false);
  });
});
