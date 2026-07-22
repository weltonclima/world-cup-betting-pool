/**
 * Testes do Route Handler POST /api/admin/championships/[id]/archive
 * (multi-championship-launch TASK-13).
 *
 * Trigger manual do pipeline de arquivamento. Só super_admin (ou secret
 * cron/script via `authorizeGroupAdmin`). Delega a `archiveChampionship`;
 * mapeia `ChampionshipNotFinishedError` → 409 e erro genérico → 500
 * (`copaDataErrorResponse`). Auditoria best-effort com `championship_archived`.
 *
 * Casos:
 *  1. 401 — não autorizado
 *  2. 400 — id com traversal no path
 *  3. 404 — campeonato desconhecido no catálogo
 *  4. 409 — campeonato ainda não encerrado (ChampionshipNotFinishedError)
 *  5. 200 — sucesso: devolve summary + grava auditoria championship_archived
 *  6. 500 — erro inesperado (fonte fora do ar) mapeado por copaDataErrorResponse
 *
 * Mocks: server-only, authorizeGroupAdmin, getChampionship, archiveChampionship
 * (+ ChampionshipNotFinishedError real no mock), writeAuditLog, getAdminFirestore.
 * copaDataErrorResponse REAL (valida o mapeamento genérico → 500).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeMock,
  getChampionshipMock,
  archiveMock,
  writeAuditLogMock,
  getFirestoreMock,
  ChampionshipNotFinishedErrorMock,
} = vi.hoisted(() => {
  // Classe de erro REAL no mock — o `instanceof` da rota precisa da mesma ref;
  // definida DENTRO do hoisted p/ estar disponível quando a factory do mock roda.
  class ChampionshipNotFinishedErrorMock extends Error {
    constructor(id: string) {
      super(`Campeonato "${id}" não está encerrado; arquivamento abortado.`);
      this.name = "ChampionshipNotFinishedError";
    }
  }
  return {
    authorizeMock: vi.fn(),
    getChampionshipMock: vi.fn(),
    archiveMock: vi.fn(),
    writeAuditLogMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    ChampionshipNotFinishedErrorMock,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/admin/groups/_authorize", () => ({
  authorizeGroupAdmin: authorizeMock,
}));
vi.mock("@/server/copaData/championshipCatalog", () => ({
  getChampionship: getChampionshipMock,
}));
vi.mock("@/server/copaData/archive", () => ({
  archiveChampionship: archiveMock,
  ChampionshipNotFinishedError: ChampionshipNotFinishedErrorMock,
}));
vi.mock("@/server/admin/auditLog", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { NextResponse } from "next/server";

import { POST } from "@/app/api/admin/championships/[id]/archive/route";

type PostParams = Parameters<typeof POST>;

function makeReq(): PostParams[0] {
  return { headers: { get: () => null } } as unknown as PostParams[0];
}

function ctx(id: string): PostParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as PostParams[1];
}

const LEAGUE = { id: "bra.1-2026", type: "league", status: "live" };

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ authorized: true, actorUid: "admin-1" });
  getChampionshipMock.mockReturnValue(LEAGUE);
  getFirestoreMock.mockReturnValue({} as never);
  writeAuditLogMock.mockResolvedValue(undefined);
});

describe("POST /api/admin/championships/[id]/archive", () => {
  it("401 quando não autorizado", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await POST(makeReq(), ctx("bra.1-2026"));
    expect(res.status).toBe(401);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("400 quando o id tem traversal no path", async () => {
    const res = await POST(makeReq(), ctx("bra.1-2026/../fifa.world"));
    expect(res.status).toBe(400);
    expect(getChampionshipMock).not.toHaveBeenCalled();
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("404 quando o campeonato é desconhecido no catálogo", async () => {
    getChampionshipMock.mockReturnValue(undefined);
    const res = await POST(makeReq(), ctx("nope.1-2026"));
    expect(res.status).toBe(404);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("409 quando o campeonato ainda não está encerrado", async () => {
    archiveMock.mockRejectedValue(new ChampionshipNotFinishedErrorMock("bra.1-2026"));
    const res = await POST(makeReq(), ctx("bra.1-2026"));
    expect(res.status).toBe(409);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("200 devolve summary e grava auditoria championship_archived", async () => {
    archiveMock.mockResolvedValue({
      championshipId: "bra.1-2026",
      matchesPersisted: 380,
      poolsArchived: 3,
      historyDocs: 4,
      alreadyArchived: false,
    });
    const res = await POST(makeReq(), ctx("bra.1-2026"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { matchesPersisted: number; poolsArchived: number };
    expect(body.matchesPersisted).toBe(380);
    expect(body.poolsArchived).toBe(3);

    expect(archiveMock).toHaveBeenCalledOnce();
    expect(writeAuditLogMock).toHaveBeenCalledOnce();
    const log = writeAuditLogMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(log["type"]).toBe("championship_archived");
    expect(log["actorUid"]).toBe("admin-1");
  });

  it("actorUid cai para 'system' no caminho secret/cron (sem sessão)", async () => {
    authorizeMock.mockResolvedValue({ authorized: true, actorUid: null });
    archiveMock.mockResolvedValue({
      championshipId: "bra.1-2026",
      matchesPersisted: 1,
      poolsArchived: 0,
      historyDocs: 1,
      alreadyArchived: false,
    });
    await POST(makeReq(), ctx("bra.1-2026"));
    const log = writeAuditLogMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(log["actorUid"]).toBe("system");
  });

  it("500 quando archiveChampionship falha de forma inesperada", async () => {
    archiveMock.mockRejectedValue(new Error("fonte fora do ar"));
    const res = await POST(makeReq(), ctx("bra.1-2026"));
    expect(res.status).toBe(500);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });
});
