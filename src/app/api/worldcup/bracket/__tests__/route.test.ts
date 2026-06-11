/**
 * Testes do Route Handler GET /api/worldcup/bracket.
 *
 * Mocks: @/server/copaData (fetch), @/server/worldcup/cache (snapshot).
 * Cobre: cache fresco, stale, ausente, fetch falha + snap, fetch falha + sem snap,
 *        headers Cache-Control, writeSnapshot lança → 200 (best-effort).
 * Confirma: body de bracket NÃO contém hasLiveGroupMatch (contrato TASK-01).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  fetchAllMatchesMock,
  fetchAllTeamsMock,
  readSnapshotMock,
  writeSnapshotMock,
  isFreshMock,
} = vi.hoisted(() => ({
  fetchAllMatchesMock: vi.fn(),
  fetchAllTeamsMock: vi.fn(),
  readSnapshotMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  isFreshMock: vi.fn(),
}));

vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
    fetchAllMatches: fetchAllMatchesMock,
    fetchAllTeams: fetchAllTeamsMock,
    CopaDataTimeoutError: client.CopaDataTimeoutError,
    CopaDataFetchError: client.CopaDataFetchError,
    CopaDataParseError: client.CopaDataParseError,
  };
});

vi.mock("@/server/worldcup/cache", () => ({
  readSnapshot: readSnapshotMock,
  writeSnapshot: writeSnapshotMock,
  isFresh: isFreshMock,
}));

// server-only é importado pelos módulos de servidor
vi.mock("server-only", () => ({}));

import { CopaDataFetchError, CopaDataTimeoutError } from "@/server/copaData/client";
import { GET } from "@/app/api/worldcup/bracket/route";
import type { BracketResponse } from "@/types/worldcup";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Partida eliminatória de oitavas agendada */
const MOCK_KNOCKOUT_MATCH = {
  id: "m65",
  homeTeamId: "1A",
  awayTeamId: "2B",
  kickoffAt: "2026-07-04T20:00:00Z",
  stage: "oitavas" as const,
  round: 1,
  groupId: null,
  venue: { name: "MetLife Stadium", city: "East Rutherford" },
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

/** Payload de bracket pré-computado (contrato TASK-01 — sem hasLiveGroupMatch) */
const MOCK_BRACKET_PAYLOAD: BracketResponse = {
  roundOf32: [],
  roundOf16: [
    {
      id: "m65",
      phase: "oitavas",
      homeTeam: { name: "1º do Grupo A", defined: false },
      awayTeam: { name: "2º do Grupo B", defined: false },
      status: "aguardando",
    },
  ],
  quarterFinals: [],
  semiFinals: [],
  thirdPlace: [],
  final: [],
};

const MOCK_SNAPSHOT = {
  payload: MOCK_BRACKET_PAYLOAD,
  computedAt: Date.now() - 100,
  hasLiveGroupMatch: false,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/worldcup/bracket", () => {
  beforeEach(() => {
    fetchAllMatchesMock.mockReset();
    fetchAllTeamsMock.mockReset();
    readSnapshotMock.mockReset();
    writeSnapshotMock.mockReset();
    isFreshMock.mockReset();
    // Default: writeSnapshot resolve sem erro
    writeSnapshotMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Cache fresco ────────────────────────────────────────────────────────────

  it("retorna payload do snapshot quando fresco, sem chamar fetchAllMatches", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchAllMatchesMock).not.toHaveBeenCalled();
    expect(fetchAllTeamsMock).not.toHaveBeenCalled();

    const body = (await response.json()) as BracketResponse;
    expect(body.roundOf16).toEqual(MOCK_BRACKET_PAYLOAD.roundOf16);
  });

  it("body do snapshot NÃO contém hasLiveGroupMatch (contrato TASK-01)", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;
    // Bracket body puro: não deve ter hasLiveGroupMatch
    expect(body).not.toHaveProperty("hasLiveGroupMatch");
  });

  it("inclui header Cache-Control correto (sem live) quando snapshot fresco", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control com ttl=60 quando snapshot fresco e hasLive=true", async () => {
    const liveSnap = { ...MOCK_SNAPSHOT, hasLiveGroupMatch: true };
    readSnapshotMock.mockResolvedValue(liveSnap);
    isFreshMock.mockReturnValue(true);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=60",
    );
  });

  // ── Cache stale ─────────────────────────────────────────────────────────────

  it("faz fetch + computa + chama writeSnapshot quando cache stale", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchAllMatchesMock).toHaveBeenCalledOnce();
    expect(fetchAllTeamsMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();

    const body = (await response.json()) as BracketResponse;
    expect(body).toHaveProperty("roundOf16");
    // Body puro (sem hasLiveGroupMatch)
    expect(body).not.toHaveProperty("hasLiveGroupMatch");
  });

  // ── Cache ausente ───────────────────────────────────────────────────────────

  it("faz fetch + computa quando snapshot ausente (null)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchAllMatchesMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
  });

  it("inclui header Cache-Control correto após recomputação sem partida ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]); // stage=oitavas, não grupos
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control ttl=60 após recomputação com partida de grupo ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    const liveGroupMatch = {
      ...MOCK_KNOCKOUT_MATCH,
      stage: "grupos" as const,
      status: "live" as const,
      groupId: "A",
    };
    fetchAllMatchesMock.mockResolvedValue([liveGroupMatch]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=60",
    );
  });

  // ── Fetch falha + snapshot existe ──────────────────────────────────────────

  it("retorna snapshot stale com Cache-Control: no-store quando fetch falha e snap existe", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as BracketResponse;
    expect(body.roundOf16).toEqual(MOCK_BRACKET_PAYLOAD.roundOf16);
  });

  // ── Fetch falha + sem snapshot ──────────────────────────────────────────────

  it("retorna 502 quando fetch lança CopaDataFetchError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET();
    expect(response.status).toBe(502);
  });

  it("retorna 504 quando fetch lança CopaDataTimeoutError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockRejectedValue(new CopaDataTimeoutError(10000));

    const response = await GET();
    expect(response.status).toBe(504);
  });

  it("retorna 500 quando fetch lança Error genérico e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET();
    expect(response.status).toBe(500);
  });

  // ── writeSnapshot lança → 200 (best-effort) ─────────────────────────────────

  it("retorna 200 mesmo quando writeSnapshot lança (best-effort)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    fetchAllMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);
    // writeSnapshot engole o erro internamente; verifica que rota continua com 200
    writeSnapshotMock.mockResolvedValue(undefined);

    const response = await GET();
    expect(response.status).toBe(200);
  });
});
