/**
 * Testes do Route Handler GET /api/standings.
 * Sucesso (grupos derivados, ordenados) e erro de parse (500).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CopaDataParseError,
} from "@/server/copaData/client";

const { fetchAllTeamsMock } = vi.hoisted(() => ({
  fetchAllTeamsMock: vi.fn(),
}));

vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
    fetchAllMatches: vi.fn(),
    fetchAllTeams: fetchAllTeamsMock,
    CopaDataTimeoutError: client.CopaDataTimeoutError,
    CopaDataFetchError: client.CopaDataFetchError,
    CopaDataParseError: client.CopaDataParseError,
  };
});

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/standings/route";

interface StandingsBody {
  groups: Array<{ groupId: string; teams: Array<{ id: string; name: string }> }>;
  ungrouped: Array<{ id: string; name: string }>;
}

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
  {
    id: "BRA",
    code: "BRA",
    name: "Brasil",
    flagUrl: "https://flagcdn.com/h40/br.png",
    groupId: "C",
  },
  {
    id: "MAR",
    code: "MAR",
    name: "Marrocos",
    flagUrl: "https://flagcdn.com/h40/ma.png",
    groupId: "C",
  },
];

describe("GET /api/standings", () => {
  beforeEach(() => {
    fetchAllTeamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 agrupando seleções por grupo, ordenado por groupId", async () => {
    fetchAllTeamsMock.mockResolvedValue(MOCK_TEAMS);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as StandingsBody;
    // Tem grupos A e C
    expect(body.groups.map((g) => g.groupId)).toEqual(["A", "C"]);
    expect(body.ungrouped).toEqual([]);

    const grupoA = body.groups.find((g) => g.groupId === "A");
    expect(grupoA?.teams).toHaveLength(2);
    // ordenado por nome (África do Sul < México em pt-BR localeCompare)
    const names = grupoA?.teams.map((t) => t.name) ?? [];
    expect(names).toHaveLength(2);
  });

  it("responde 500 em CopaDataParseError", async () => {
    fetchAllTeamsMock.mockRejectedValue(new CopaDataParseError("campo ausente"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
