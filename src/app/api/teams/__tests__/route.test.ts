/**
 * Testes do Route Handler GET /api/teams (TASK-04).
 * Sucesso (TeamWithId[]) e erro de auth (502).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_TEAMS } from "@/server/apiFootball/mock";
import { ApiFootballAuthError } from "@/server/apiFootball/client";

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

import { GET } from "@/app/api/teams/route";

describe("GET /api/teams", () => {
  beforeEach(() => {
    getClientMock.mockReturnValue({ getTeamsByTournament: getTeamsMock });
    getTeamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com array de TeamWithId (id = String(team.id))", async () => {
    getTeamsMock.mockResolvedValue(MOCK_TEAMS);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ id: string; code: string }>;
    expect(body).toHaveLength(MOCK_TEAMS.length);
    expect(body[0]?.id).toBe(String(MOCK_TEAMS[0]?.team.id));
    expect(body[0]?.code).toBe(MOCK_TEAMS[0]?.team.code);
  });

  it("responde 502 em ApiFootballAuthError", async () => {
    getTeamsMock.mockRejectedValue(new ApiFootballAuthError());

    const response = await GET();
    expect(response.status).toBe(502);
  });
});
