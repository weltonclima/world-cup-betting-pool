/**
 * Testes do Route Handler GET /api/matches.
 *
 * `@/server/copaData/matchSource` é mockado para controlar `getEffectiveMatches`
 * (fonte efetiva = ESPN + overlay do banco, PRD-11). Verifica sucesso
 * (MatchWithId[]) e erros (EspnTimeoutError → 504, etc.).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EspnTimeoutError,
  EspnFetchError,
} from "@/server/copaData/espnClient";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

// server-only é importado pela cadeia de copaData
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
    getEffectiveMatchesMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 com array de MatchWithId", async () => {
    getEffectiveMatchesMock.mockResolvedValue([MOCK_MATCH]);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ id: string; stage: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(MOCK_MATCH.id);
    expect(body[0]?.stage).toBe("grupos");
  });

  it("responde 504 quando getEffectiveMatches lança EspnTimeoutError", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new EspnTimeoutError(10000));

    const response = await GET();
    expect(response.status).toBe(504);
  });

  it("responde 502 quando getEffectiveMatches lança EspnFetchError", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new EspnFetchError(503));

    const response = await GET();
    expect(response.status).toBe(502);
  });

  it("responde 500 em erro inesperado", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
