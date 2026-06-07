/**
 * Testes do Route Handler GET /api/matches (TASK-04).
 *
 * `@/server/apiFootball` é MOCKADO para (a) evitar o `import "server-only"` do
 * barrel sob vitest e (b) controlar o client retornado por getApiFootballClient.
 * Mappers/tiers/schemas reais rodam de verdade (integração leve).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_TEAMS } from "@/server/apiFootball/mock";
import {
  ApiFootballAuthError,
  ApiFootballQuotaError,
} from "@/server/apiFootball/client";
import { VALID_FIXTURES } from "../../_lib/__tests__/validFixtures";

const { getClientMock, getFixturesMock, getTeamsMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  getFixturesMock: vi.fn(),
  getTeamsMock: vi.fn(),
}));

vi.mock("@/server/apiFootball", async () => {
  // Reaproveita os erros reais para que `instanceof` no helper funcione.
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

import { GET } from "@/app/api/matches/route";

describe("GET /api/matches", () => {
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

  it("responde 200 com array de MatchWithId (id = String(fixture.id))", async () => {
    getTeamsMock.mockResolvedValue(MOCK_TEAMS);
    getFixturesMock.mockResolvedValue(VALID_FIXTURES);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{
      id: string;
      groupId: string | null;
      stage: string;
    }>;
    expect(body).toHaveLength(VALID_FIXTURES.length);
    expect(body[0]?.id).toBe(String(VALID_FIXTURES[0]?.fixture.id));

    // Jogo de grupo do mandante 6 (Brasil, grupo A) → groupId "A".
    const grupo = body.find((m) => m.id === "1001");
    expect(grupo?.groupId).toBe("A");

    // Jogo de mata-mata → sem groupId.
    const mata = body.find((m) => m.id === "1004");
    expect(mata?.groupId).toBeNull();
  });

  it("responde 503 quando o client lança ApiFootballQuotaError", async () => {
    getTeamsMock.mockRejectedValue(new ApiFootballQuotaError());

    const response = await GET();
    expect(response.status).toBe(503);
  });

  it("responde 502 quando o client lança ApiFootballAuthError", async () => {
    getTeamsMock.mockRejectedValue(new ApiFootballAuthError());

    const response = await GET();
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    // Não vaza o nome da env var.
    expect(body.error).not.toContain("API_FOOTBALL_KEY");
  });
});
