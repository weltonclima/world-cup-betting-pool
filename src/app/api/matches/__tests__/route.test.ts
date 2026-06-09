/**
 * Testes do Route Handler GET /api/matches.
 *
 * `@/server/copaData` é mockado para controlar fetchAllMatches.
 * Verifica sucesso (MatchWithId[]) e erros (CopaDataTimeoutError → 504, etc.).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CopaDataTimeoutError,
  CopaDataFetchError,
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

// server-only é importado pelo barrel de copaData
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/matches/route";

/** Partida mínima válida para os testes */
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

describe("GET /api/matches", () => {
  beforeEach(() => {
    fetchAllMatchesMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com array de MatchWithId", async () => {
    fetchAllMatchesMock.mockResolvedValue([MOCK_MATCH]);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ id: string; stage: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(MOCK_MATCH.id);
    expect(body[0]?.stage).toBe("grupos");
  });

  it("responde 504 quando fetchAllMatches lança CopaDataTimeoutError", async () => {
    fetchAllMatchesMock.mockRejectedValue(new CopaDataTimeoutError(10000));

    const response = await GET();
    expect(response.status).toBe(504);
  });

  it("responde 502 quando fetchAllMatches lança CopaDataFetchError", async () => {
    fetchAllMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET();
    expect(response.status).toBe(502);
  });

  it("responde 500 em erro inesperado", async () => {
    fetchAllMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
