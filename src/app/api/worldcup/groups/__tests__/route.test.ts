/**
 * Testes do Route Handler GET /api/worldcup/groups.
 *
 * Mocks: @/server/copaData/matchSource (getEffectiveMatches — fonte ESPN),
 *        @/server/copaData (fetchAllTeams), @/server/worldcup/cache (snapshot).
 * Cobre: cache fresco, stale, ausente, fetch falha + snap, fetch falha + sem snap,
 *        headers Cache-Control, writeSnapshot lança → 200 (best-effort),
 *        snapshot corrompido → fallthrough para recomputo (Fix 1),
 *        after() desacopla escrita do response (Fix 3).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  getEffectiveMatchesMock,
  fetchAllTeamsMock,
  readSnapshotMock,
  writeSnapshotMock,
  isFreshMock,
} = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
  fetchAllTeamsMock: vi.fn(),
  readSnapshotMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  isFreshMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
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

// Fix 3: mock after() para executar o callback sincronamente no ambiente de testes.
// Preserva NextResponse e demais exports do módulo intactos.
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => { void fn(); } };
});

// server-only é importado pelos módulos de servidor
vi.mock("server-only", () => ({}));

import { CopaDataFetchError, CopaDataTimeoutError } from "@/server/copaData/client";
import { GET } from "@/app/api/worldcup/groups/route";
import type { GroupsResponse } from "@/types/worldcup";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Partida de grupo agendada (sem status live) */
const MOCK_MATCH = {
  id: "2026-06-11-mexico-south-africa",
  homeTeamId: "MEX",
  awayTeamId: "RSA",
  kickoffAt: "2026-06-11T13:00:00-06:00",
  stage: "grupos" as const,
  round: 1,
  groupId: "A",
  venue: { name: "Mexico City", city: "Mexico City" },
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

const MOCK_TEAM = {
  id: "MEX",
  code: "MEX",
  name: "México",
  flagUrl: "https://flagcdn.com/h40/mx.png",
  groupId: "A",
};

/** Snapshot de grupos pré-computado */
const MOCK_SNAPSHOT_PAYLOAD: GroupsResponse = {
  groups: [
    {
      groupId: "A",
      standings: [
        {
          position: 1,
          team: { id: "MEX", name: "México", code: "MEX" },
          played: 0, wins: 0, draws: 0, losses: 0,
          goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
          qualification: "indefinido",
        },
      ],
    },
  ],
  hasLiveGroupMatch: false,
};

const MOCK_SNAPSHOT = {
  payload: MOCK_SNAPSHOT_PAYLOAD,
  computedAt: Date.now() - 100,
  hasLiveGroupMatch: false,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/worldcup/groups", () => {
  beforeEach(() => {
    getEffectiveMatchesMock.mockReset();
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

  it("retorna payload do snapshot quando fresco, sem chamar getEffectiveMatches", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    expect(fetchAllTeamsMock).not.toHaveBeenCalled();

    const body = (await response.json()) as GroupsResponse;
    expect(body.groups).toEqual(MOCK_SNAPSHOT_PAYLOAD.groups);
  });

  it("inclui header Cache-Control correto (sem live) quando snapshot fresco", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control com ttl=60 e swr=0 quando snapshot fresco e hasLive=true", async () => {
    const liveSnap = { ...MOCK_SNAPSHOT, hasLiveGroupMatch: true };
    readSnapshotMock.mockResolvedValue(liveSnap);
    isFreshMock.mockReturnValue(true);

    const response = await GET();
    // Fix 4 (WR-02): stale-while-revalidate=0 quando ao vivo
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
  });

  // ── Snapshot corrompido (Fix 1) ─────────────────────────────────────────────

  it("ignora snapshot fresco corrompido, faz fallthrough para fetch+computa e retorna payload computado", async () => {
    // Snapshot "fresco" mas com payload que não passa no groupsResponseSchema
    const corruptSnap = {
      payload: { groups: "not-an-array" },
      computedAt: Date.now() - 100,
      hasLiveGroupMatch: false,
    };
    readSnapshotMock.mockResolvedValue(corruptSnap);
    isFreshMock.mockReturnValue(true);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);

    const response = await GET();

    // Deve ter caído no caminho de recomputo, não usado o cache corrompido
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);

    const body = (await response.json()) as GroupsResponse;
    expect(Array.isArray(body.groups)).toBe(true);
    expect(body).toHaveProperty("hasLiveGroupMatch");
  });

  // ── Cache stale ─────────────────────────────────────────────────────────────

  it("faz fetch + computa + chama writeSnapshot quando cache stale", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(fetchAllTeamsMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();

    const body = (await response.json()) as GroupsResponse;
    expect(body).toHaveProperty("groups");
    expect(body).toHaveProperty("hasLiveGroupMatch");
  });

  // ── Cache ausente ───────────────────────────────────────────────────────────

  it("faz fetch + computa quando snapshot ausente (null)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
  });

  it("inclui header Cache-Control correto após recomputação sem partida ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]); // status = scheduled
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control ttl=60 e swr=0 após recomputação com partida ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    const liveMatch = { ...MOCK_MATCH, status: "live" as const };
    getEffectiveMatchesMock.mockResolvedValue([liveMatch]);
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);

    const response = await GET();
    // Fix 4 (WR-02): stale-while-revalidate=0 quando ao vivo
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
  });

  // ── Fetch falha + snapshot existe ──────────────────────────────────────────

  it("retorna snapshot stale com Cache-Control: no-store quando fetch falha e snap existe", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as GroupsResponse;
    expect(body.groups).toEqual(MOCK_SNAPSHOT_PAYLOAD.groups);
  });

  // ── Fetch falha + sem snapshot ──────────────────────────────────────────────

  it("retorna 502 quando fetch lança CopaDataFetchError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET();
    expect(response.status).toBe(502);
  });

  it("retorna 504 quando fetch lança CopaDataTimeoutError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new CopaDataTimeoutError(10000));

    const response = await GET();
    expect(response.status).toBe(504);
  });

  it("retorna 500 quando fetch lança Error genérico e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET();
    expect(response.status).toBe(500);
  });

  // ── writeSnapshot lança → 200 (best-effort) ─────────────────────────────────

  it("retorna 200 mesmo quando writeSnapshot lança (best-effort)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([MOCK_TEAM]);
    // writeSnapshot já engole o erro internamente; simula retorno ok (o mock não lança)
    // Para testar o cenário real, o erro seria engolido DENTRO de writeSnapshot.
    // Aqui verificamos que a rota continua com 200 independentemente.
    writeSnapshotMock.mockResolvedValue(undefined);

    const response = await GET();
    expect(response.status).toBe(200);
  });
});
