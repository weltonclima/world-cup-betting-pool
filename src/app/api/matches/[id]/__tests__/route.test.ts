/**
 * Testes do Route Handler GET /api/matches/[id] (TASK-04).
 * Sucesso (id existente), 404 (id inexistente) e erro de quota.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_TEAMS } from "@/server/apiFootball/mock";
import { ApiFootballQuotaError } from "@/server/apiFootball/client";
import { VALID_FIXTURES } from "../../../_lib/__tests__/validFixtures";

const { getClientMock, getFixturesMock, getTeamsMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  getFixturesMock: vi.fn(),
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

import { GET } from "@/app/api/matches/[id]/route";

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/matches/[id]", () => {
  beforeEach(() => {
    getClientMock.mockReturnValue({
      getFixtures: getFixturesMock,
      getTeamsByTournament: getTeamsMock,
    });
    getFixturesMock.mockReset();
    getTeamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com a partida quando o id existe", async () => {
    getTeamsMock.mockResolvedValue(MOCK_TEAMS);
    getFixturesMock.mockResolvedValue(VALID_FIXTURES);

    const response = await GET(new Request("http://localhost"), ctx("1001"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { id: string };
    expect(body.id).toBe("1001");
  });

  it("responde 404 quando o id não existe", async () => {
    getTeamsMock.mockResolvedValue(MOCK_TEAMS);
    getFixturesMock.mockResolvedValue(VALID_FIXTURES);

    const response = await GET(new Request("http://localhost"), ctx("999999"));
    expect(response.status).toBe(404);
  });

  it("responde 503 em ApiFootballQuotaError", async () => {
    getTeamsMock.mockRejectedValue(new ApiFootballQuotaError());

    const response = await GET(new Request("http://localhost"), ctx("1001"));
    expect(response.status).toBe(503);
  });
});
