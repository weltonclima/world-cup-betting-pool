/**
 * Testes do Route Handler GET /api/teams.
 * Sucesso (TeamWithId[]) e erro de fetch (502).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EspnFetchError,
} from "@/server/copaData/espnClient";

const { fetchAllTeamsMock } = vi.hoisted(() => ({
  fetchAllTeamsMock: vi.fn(),
}));

vi.mock("@/server/copaData", () => ({
  fetchAllTeams: fetchAllTeamsMock,
}));

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/teams/route";

const MOCK_TEAMS = [
  {
    id: "MEX",
    code: "MEX",
    name: "México",
    flagUrl: "https://flagcdn.com/h40/mx.png",
    groupId: "A",
  },
  {
    id: "RSA",
    code: "RSA",
    name: "África do Sul",
    flagUrl: "https://flagcdn.com/h40/za.png",
    groupId: "A",
  },
];

describe("GET /api/teams", () => {
  beforeEach(() => {
    fetchAllTeamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com array de TeamWithId", async () => {
    fetchAllTeamsMock.mockResolvedValue(MOCK_TEAMS);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ id: string; code: string }>;
    expect(body).toHaveLength(MOCK_TEAMS.length);
    expect(body[0]?.id).toBe("MEX");
    expect(body[0]?.code).toBe("MEX");
  });

  it("responde 502 em EspnFetchError", async () => {
    fetchAllTeamsMock.mockRejectedValue(new EspnFetchError(404));

    const response = await GET();
    expect(response.status).toBe(502);
  });
});
