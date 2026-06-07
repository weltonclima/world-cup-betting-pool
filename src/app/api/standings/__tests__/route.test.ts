/**
 * Testes do Route Handler GET /api/standings (TASK-04, A1).
 * Sucesso (grupos derivados, ordenados) e erro de quota (503).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_TEAMS } from "@/server/apiFootball/mock";
import { ApiFootballQuotaError } from "@/server/apiFootball/client";

const { getClientMock, getTeamsMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  getTeamsMock: vi.fn(),
}));

vi.mock("@/server/apiFootball", async () => {
  const client = await vi.importActual<typeof import("@/server/apiFootball/client")>(
    "@/server/apiFootball/client",
  );
  return {
    getApiFootballClient: getClientMock,
    COPA_2026_CONFIG: { leagueId: 1, season: 2026 },
    ApiFootballQuotaError: client.ApiFootballQuotaError,
    ApiFootballAuthError: client.ApiFootballAuthError,
    ApiFootballTimeoutError: client.ApiFootballTimeoutError,
  };
});

import { GET } from "@/app/api/standings/route";

interface StandingsBody {
  groups: Array<{ groupId: string; teams: Array<{ id: string; name: string }> }>;
  ungrouped: Array<{ id: string; name: string }>;
}

describe("GET /api/standings", () => {
  beforeEach(() => {
    getClientMock.mockReturnValue({ getTeamsByTournament: getTeamsMock });
    getTeamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 agrupando seleções por grupo, ordenado por groupId (A1)", async () => {
    getTeamsMock.mockResolvedValue(MOCK_TEAMS);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as StandingsBody;
    // MOCK_TEAMS tem grupos A e C.
    expect(body.groups.map((g) => g.groupId)).toEqual(["A", "C"]);
    expect(body.ungrouped).toEqual([]);

    const grupoA = body.groups.find((g) => g.groupId === "A");
    expect(grupoA?.teams).toHaveLength(2);
    // ordenado por nome: Brasil antes de Espanha.
    expect(grupoA?.teams.map((t) => t.name)).toEqual(["Brasil", "Espanha"]);
  });

  it("responde 503 em ApiFootballQuotaError", async () => {
    getTeamsMock.mockRejectedValue(new ApiFootballQuotaError());

    const response = await GET();
    expect(response.status).toBe(503);
  });
});
