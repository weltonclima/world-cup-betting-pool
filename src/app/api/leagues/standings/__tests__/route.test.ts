/**
 * Testes do Route Handler GET /api/leagues/standings (TASK-20).
 *
 * Mocks: @/server/leagues/standingsSource (getLeagueStandingsData — fetch ESPN
 * único → matches + display), @/server/worldcup/cache (snapshot). O domínio
 * `computeLeagueStandings` roda REAL (não mockado) — integração de verdade.
 *
 * Cobre: gate league-only (cup/Copa/id inválido → 400 sem tocar cache/fonte),
 * liga válida → tabela computada, cache fresco servido sem recomputar, snapshot
 * corrompido → recomputa, ESPN down + snapshot → stale (no-store), ESPN down +
 * sem snapshot → erro (502/504/500), headers Cache-Control conforme hasLiveMatch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  getLeagueStandingsDataMock,
  readSnapshotMock,
  writeSnapshotMock,
  isFreshMock,
} = vi.hoisted(() => ({
  getLeagueStandingsDataMock: vi.fn(),
  readSnapshotMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  isFreshMock: vi.fn(),
}));

vi.mock("@/server/leagues/standingsSource", () => ({
  getLeagueStandingsData: getLeagueStandingsDataMock,
}));

vi.mock("@/server/worldcup/cache", () => ({
  readSnapshot: readSnapshotMock,
  writeSnapshot: writeSnapshotMock,
  isFresh: isFreshMock,
}));

// Executa o callback de after() sincronamente no ambiente de teste.
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => { void fn(); } };
});

vi.mock("server-only", () => ({}));

import { EspnFetchError, EspnTimeoutError } from "@/server/copaData/espnClient";
import { GET } from "@/app/api/leagues/standings/route";
import type { LeagueStandingsResponse } from "@/types/leagues";
import type { MatchWithId } from "@/types/matches";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LEAGUE = "bra.1-2026";
const url = (id?: string) =>
  `http://x/api/leagues/standings${id === undefined ? "" : `?championship=${id}`}`;

function ligaMatch(
  partial: Partial<MatchWithId> & Pick<MatchWithId, "id" | "homeTeamId" | "awayTeamId">,
): MatchWithId {
  return {
    championshipId: LEAGUE,
    kickoffAt: "2026-03-01T20:00:00.000Z",
    stage: "liga",
    round: 1,
    status: "finished",
    homeScore: null,
    awayScore: null,
    ...partial,
  } as MatchWithId;
}

const FINISHED_MATCH = ligaMatch({
  id: `${LEAGUE}-1`,
  homeTeamId: "FLA",
  awayTeamId: "PAL",
  homeScore: 2,
  awayScore: 1,
});

const DISPLAY = new Map<string, { name: string; crestUrl?: string }>([
  ["FLA", { name: "Flamengo", crestUrl: "https://espn/fla.png" }],
  ["PAL", { name: "Palmeiras", crestUrl: "https://espn/pal.png" }],
]);

/** Snapshot pré-computado válido (contrato leagueStandingsResponseSchema). */
const SNAPSHOT_PAYLOAD: LeagueStandingsResponse = {
  table: [
    {
      position: 1,
      team: { id: "FLA", name: "Flamengo", crestUrl: "https://espn/fla.png" },
      played: 1, wins: 1, draws: 0, losses: 0,
      goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3,
    },
    {
      position: 2,
      team: { id: "PAL", name: "Palmeiras", crestUrl: "https://espn/pal.png" },
      played: 1, wins: 0, draws: 0, losses: 1,
      goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 0,
    },
  ],
  hasLiveMatch: false,
};

const SNAPSHOT = {
  payload: SNAPSHOT_PAYLOAD,
  computedAt: Date.now() - 100,
  hasLiveGroupMatch: false,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/leagues/standings", () => {
  beforeEach(() => {
    getLeagueStandingsDataMock.mockReset();
    readSnapshotMock.mockReset();
    writeSnapshotMock.mockReset();
    isFreshMock.mockReset();
    writeSnapshotMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Gate league-only ─────────────────────────────────────────────────────────

  it("400 para Copa (default sem championship), sem tocar cache nem fonte", async () => {
    const response = await GET(new Request(url()));
    expect(response.status).toBe(400);
    expect(readSnapshotMock).not.toHaveBeenCalled();
    expect(getLeagueStandingsDataMock).not.toHaveBeenCalled();
  });

  it("400 para type: cup explícito (fifa.world), sem tocar cache nem fonte", async () => {
    const response = await GET(new Request(url("fifa.world")));
    expect(response.status).toBe(400);
    expect(readSnapshotMock).not.toHaveBeenCalled();
    expect(getLeagueStandingsDataMock).not.toHaveBeenCalled();
  });

  it("400 para id fora do catálogo, sem tocar cache", async () => {
    const response = await GET(new Request(url("nao.existe")));
    expect(response.status).toBe(400);
    expect(readSnapshotMock).not.toHaveBeenCalled();
  });

  // ── Liga válida: computa ─────────────────────────────────────────────────────

  it("liga válida sem cache → computa tabela real a partir da fonte ESPN", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH],
      teams: DISPLAY,
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    expect(getLeagueStandingsDataMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();

    const body = (await response.json()) as LeagueStandingsResponse;
    expect(body.hasLiveMatch).toBe(false);
    expect(body.table.map((r) => r.team.id)).toEqual(["FLA", "PAL"]);
    expect(body.table[0]).toMatchObject({ position: 1, points: 3, goalDifference: 1 });
    expect(body.table[1]).toMatchObject({ position: 2, points: 0 });
  });

  it("header Cache-Control idle (24h) quando sem partida ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH],
      teams: DISPLAY,
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("header Cache-Control live (60s) + hasLiveMatch=true quando há jogo ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    const liveMatch = ligaMatch({
      id: `${LEAGUE}-2`,
      homeTeamId: "SAO",
      awayTeamId: "COR",
      status: "live",
      homeScore: 0,
      awayScore: 0,
    });
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH, liveMatch],
      teams: DISPLAY,
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
    const body = (await response.json()) as LeagueStandingsResponse;
    expect(body.hasLiveMatch).toBe(true);
  });

  // ── Cache fresco ─────────────────────────────────────────────────────────────

  it("serve snapshot fresco sem recomputar (não chama a fonte)", async () => {
    readSnapshotMock.mockResolvedValue(SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    expect(getLeagueStandingsDataMock).not.toHaveBeenCalled();

    const body = (await response.json()) as LeagueStandingsResponse;
    expect(body.table).toEqual(SNAPSHOT_PAYLOAD.table);
  });

  // ── Snapshot corrompido → recomputa ──────────────────────────────────────────

  it("snapshot fresco corrompido → fallthrough para recomputo", async () => {
    readSnapshotMock.mockResolvedValue({
      payload: { table: "not-an-array" },
      computedAt: Date.now() - 100,
      hasLiveGroupMatch: false,
    });
    isFreshMock.mockReturnValue(true);
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH],
      teams: DISPLAY,
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    expect(getLeagueStandingsDataMock).toHaveBeenCalledOnce();
    const body = (await response.json()) as LeagueStandingsResponse;
    expect(Array.isArray(body.table)).toBe(true);
  });

  // ── ESPN down + snapshot → stale ─────────────────────────────────────────────

  it("ESPN down + snapshot presente → serve stale com Cache-Control: no-store", async () => {
    readSnapshotMock.mockResolvedValue(SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockRejectedValue(new EspnFetchError(503));

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as LeagueStandingsResponse;
    expect(body.table).toEqual(SNAPSHOT_PAYLOAD.table);
  });

  // ── ESPN down + sem snapshot → erro ──────────────────────────────────────────

  it("ESPN down (fetch error) + sem snapshot → 502", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockRejectedValue(new EspnFetchError(503));

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(502);
  });

  it("ESPN timeout + sem snapshot → 504", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockRejectedValue(new EspnTimeoutError(10000));

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(504);
  });

  it("erro genérico + sem snapshot → 500", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockRejectedValue(new Error("inesperado"));

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(500);
  });

  // ── H-1 (review): crestUrl inválido é sanitizado na EXTRAÇÃO ──────────────────
  // A rota valida o payload com `z.url()` throwing. O display já chega limpo do
  // extractLeagueTeamDisplay (sanitizeCrestUrl); um crestUrl válido passa a
  // validação e é servido normalmente — a fonte nunca injeta URL inválida.

  it("crestUrl http(s) válido no display → payload validado e servido", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH],
      teams: new Map([
        ["FLA", { name: "Flamengo", crestUrl: "https://espn/fla.png" }],
        ["PAL", { name: "Palmeiras" }], // sem crest → fallback, sem quebrar z.url
      ]),
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    const body = (await response.json()) as LeagueStandingsResponse;
    expect(body.table.find((r) => r.team.id === "FLA")?.team.crestUrl).toBe(
      "https://espn/fla.png",
    );
    expect(body.table.find((r) => r.team.id === "PAL")?.team.crestUrl).toBeUndefined();
  });

  // ── best-effort write ────────────────────────────────────────────────────────

  it("200 mesmo com writeSnapshot resolvendo normal (escrita desacoplada)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getLeagueStandingsDataMock.mockResolvedValue({
      matches: [FINISHED_MATCH],
      teams: DISPLAY,
    });

    const response = await GET(new Request(url(LEAGUE)));
    expect(response.status).toBe(200);
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
  });
});
