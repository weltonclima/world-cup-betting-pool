/**
 * Testes do Route Handler GET /api/matches/[id].
 * Sucesso (id existente), 404 (id inexistente) e erro de timeout.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CopaDataTimeoutError,
} from "@/server/copaData/client";

const { fetchAllMatchesMock } = vi.hoisted(() => ({
  fetchAllMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData", async () => {
  const client = await vi.importActual<typeof import("@/server/copaData/client")>(
    "@/server/copaData/client",
  );
  return {
    fetchAllMatches: fetchAllMatchesMock,
    fetchAllTeams: vi.fn(),
    CopaDataTimeoutError: client.CopaDataTimeoutError,
    CopaDataFetchError: client.CopaDataFetchError,
    CopaDataParseError: client.CopaDataParseError,
  };
});

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/matches/[id]/route";

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

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/matches/[id]", () => {
  beforeEach(() => {
    fetchAllMatchesMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com a partida quando o id existe", async () => {
    fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH]);

    const response = await GET(new Request("http://localhost"), ctx(MOCK_MATCH.id));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { id: string };
    expect(body.id).toBe(MOCK_MATCH.id);
  });

  it("responde 404 quando o id não existe", async () => {
    fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH]);

    const response = await GET(new Request("http://localhost"), ctx("m999"));
    expect(response.status).toBe(404);
  });

  it("responde 504 em CopaDataTimeoutError", async () => {
    fetchAllMatchesMock.mockRejectedValue(new CopaDataTimeoutError(10000));

    const response = await GET(new Request("http://localhost"), ctx(MOCK_MATCH.id));
    expect(response.status).toBe(504);
  });
});
