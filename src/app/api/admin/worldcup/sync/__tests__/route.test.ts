/**
 * Testes do Route Handler POST /api/admin/worldcup/sync (PRD-11 TASK-02).
 *
 * Sincroniza openfootball → `matches/{id}`, PRESERVANDO os docs com
 * `isManualOverride === true` (correções manuais nunca sobrescritas). Grava um
 * resumo em `sync_logs/{id}` e audita (best-effort).
 *
 * Casos:
 *  1. 401 — não autorizado (gate `authorizeGroupAdmin` barra)
 *  2. 200 — coleção vazia: todas persistidas (updated=N, skipped=0) + log gravado
 *  3. 200 — override manual preservado (skipped conta, não entra no batch)
 *
 * Mocks: server-only, authorizeGroupAdmin, fetchAllMatches, readPersistedMatches,
 * writeAuditLog, getAdminFirestore. `matchSchema`/`syncLog*` são REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeMock,
  fetchAllMatchesMock,
  readPersistedMock,
  writeAuditLogMock,
  getFirestoreMock,
} = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  fetchAllMatchesMock: vi.fn(),
  readPersistedMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/admin/groups/_authorize", () => ({
  authorizeGroupAdmin: authorizeMock,
}));
vi.mock("@/server/copaData", () => ({ fetchAllMatches: fetchAllMatchesMock }));
vi.mock("@/server/copaData/matchSource", () => ({
  readPersistedMatches: readPersistedMock,
}));
vi.mock("@/server/admin/auditLog", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { NextResponse } from "next/server";

import { POST } from "@/app/api/admin/worldcup/sync/route";
import type { MatchWithId } from "@/types/matches";

function baseMatch(id: string, over: Partial<MatchWithId> = {}): MatchWithId {
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

const batchSet = vi.fn();
const batchCommit = vi.fn(async () => {});
const logSet = vi.fn<(doc: Record<string, unknown>) => Promise<void>>(
  async () => {},
);
const cacheDelete = vi.fn(async () => {});

function mockDb(): void {
  getFirestoreMock.mockReturnValue({
    batch: () => ({ set: batchSet, commit: batchCommit }),
    collection: (name: string) => ({
      doc: (id?: string) =>
        name === "sync_logs"
          ? { id: "log-1", set: logSet }
          : { id, delete: cacheDelete },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ authorized: true, actorUid: "admin-1" });
  writeAuditLogMock.mockResolvedValue(undefined);
});

function req(): Request {
  return { headers: { get: () => null } } as unknown as Request;
}

describe("POST /api/admin/worldcup/sync", () => {
  it("401 quando não autorizado", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });

    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(fetchAllMatchesMock).not.toHaveBeenCalled();
  });

  it("200 coleção vazia: persiste todas e grava o log", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1"), baseMatch("m2")]);
    readPersistedMock.mockResolvedValue(new Map());
    mockDb();

    const res = await POST(req());
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      matchesUpdated: number;
      matchesSkipped: number;
      status: string;
    };
    expect(body.matchesUpdated).toBe(2);
    expect(body.matchesSkipped).toBe(0);
    expect(body.status).toBe("success");
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledOnce();
    expect(logSet).toHaveBeenCalledOnce();
  });

  it("200 preserva override manual (skipped), não entra no batch", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1"), baseMatch("m2")]);
    readPersistedMock.mockResolvedValue(
      new Map<string, MatchWithId>([
        ["m1", baseMatch("m1", { status: "finished", homeScore: 2, awayScore: 0, isManualOverride: true })],
      ]),
    );
    mockDb();

    const res = await POST(req());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { matchesUpdated: number; matchesSkipped: number };
    expect(body.matchesUpdated).toBe(1); // só m2
    expect(body.matchesSkipped).toBe(1); // m1 blindado
    expect(batchSet).toHaveBeenCalledTimes(1);
  });

  it("500 + grava sync_log de status 'error' quando o commit falha", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    readPersistedMock.mockResolvedValue(new Map());
    mockDb();
    // Falha na escrita do batch — sem o log de erro a falha ficaria invisível.
    batchCommit.mockRejectedValueOnce(new Error("commit falhou"));

    const res = await POST(req());
    expect(res.status).toBe(500);
    // O catch grava um sync_log de erro (best-effort) em vez de silenciar.
    expect(logSet).toHaveBeenCalledOnce();
    const saved = logSet.mock.calls[0]![0] as { status: string; message: string };
    expect(saved.status).toBe("error");
    expect(saved.message).toBe("commit falhou");
  });
});
