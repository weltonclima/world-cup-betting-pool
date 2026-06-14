/**
 * Testes do Route Handler GET /api/matches/[id].
 *
 * Regressão D1: a rota deve ler de `getEffectiveMatches` (openfootball + overrides
 * manuais, PRD-11) — NÃO de `fetchAllMatches` (base crua). Sem o overlay, o
 * detalhe do jogo renderizava sempre o openfootball, ignorando a edição manual do
 * super_admin.
 *
 * `@/server/copaData/matchSource` é mockado para controlar a fonte efetiva.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CopaDataTimeoutError,
  CopaDataFetchError,
} from "@/server/copaData/client";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

// server-only é importado pela cadeia de copaData
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/matches/[id]/route";

type GetParams = Parameters<typeof GET>;

function ctx(id: string): GetParams[1] {
  return { params: Promise.resolve({ id }) } as unknown as GetParams[1];
}

/** Partida com override manual aplicado (placar corrigido pelo super_admin). */
const OVERRIDE_MATCH = {
  id: "m73",
  homeTeamId: "BRA",
  awayTeamId: "ARG",
  kickoffAt: "2026-07-01T20:00:00Z",
  stage: "oitavas" as const,
  round: null,
  groupId: null,
  venue: null,
  status: "finished" as const,
  homeScore: 2,
  awayScore: 1,
  isManualOverride: true,
  editedBy: "admin-1",
  editedAt: "2026-07-01T22:30:00Z",
};

describe("GET /api/matches/[id]", () => {
  beforeEach(() => {
    getEffectiveMatchesMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a partida com override manual aplicado (D1)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([OVERRIDE_MATCH]);

    const response = await GET(new Request("http://x/api/matches/m73"), ctx("m73"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      id: string;
      homeScore: number;
      isManualOverride: boolean;
    };
    expect(body.id).toBe("m73");
    // Placar e flag vêm do override, não do openfootball cru.
    expect(body.homeScore).toBe(2);
    expect(body.isManualOverride).toBe(true);
    // Lê da fonte efetiva (overlay), não da base crua.
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
  });

  it("404 quando o id não existe na fonte efetiva", async () => {
    getEffectiveMatchesMock.mockResolvedValue([OVERRIDE_MATCH]);

    const response = await GET(new Request("http://x/api/matches/ghost"), ctx("ghost"));
    expect(response.status).toBe(404);
  });

  it("504 quando getEffectiveMatches lança CopaDataTimeoutError", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new CopaDataTimeoutError(10000));

    const response = await GET(new Request("http://x/api/matches/m73"), ctx("m73"));
    expect(response.status).toBe(504);
  });

  it("502 quando getEffectiveMatches lança CopaDataFetchError", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new CopaDataFetchError(503));

    const response = await GET(new Request("http://x/api/matches/m73"), ctx("m73"));
    expect(response.status).toBe(502);
  });

  it("500 em erro inesperado", async () => {
    getEffectiveMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET(new Request("http://x/api/matches/m73"), ctx("m73"));
    expect(response.status).toBe(500);
  });
});
