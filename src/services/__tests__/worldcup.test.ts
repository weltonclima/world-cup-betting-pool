import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { getBracket, getGroups, WorldcupServiceError } from "@/services/worldcup";

/**
 * Testes da camada de serviço da Copa — grupos e chaveamento
 * (grupos-eliminatorias, TASK-05).
 *
 * Consome `/api/worldcup/*` via `fetch` (mockado — sem rede). Cobre: sucesso +
 * parse Zod, erro HTTP → `WorldcupServiceError` (status preservado), e corpo
 * fora do contrato → ZodError.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

/** Resposta válida de /api/worldcup/groups (GroupsResponse). */
function makeGroupsResponse() {
  return {
    hasLiveGroupMatch: false,
    groups: [
      {
        groupId: "A",
        standings: [
          {
            position: 1,
            team: { id: "bra", name: "Brasil", code: "BRA" },
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            qualification: "indefinido",
          },
        ],
      },
    ],
  };
}

/** Resposta válida de /api/worldcup/bracket (BracketResponse). */
function makeBracketResponse() {
  return {
    roundOf32: [
      {
        id: "73",
        phase: "dezesseis-avos",
        homeTeam: { name: "1º Grupo A", defined: false },
        awayTeam: { name: "2º Grupo B", defined: false },
        status: "aguardando",
      },
    ],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };
}

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function errorJson(status: number, error?: string): Response {
  return {
    ok: false,
    status,
    json: async () => (error === undefined ? {} : { error }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getGroups", () => {
  it("T1: 2xx → parseia e retorna GroupsResponse", async () => {
    fetchMock.mockResolvedValueOnce(okJson(makeGroupsResponse()));

    const result = await getGroups();

    expect(fetchMock).toHaveBeenCalledWith("/api/worldcup/groups");
    expect(result.hasLiveGroupMatch).toBe(false);
    expect(result.groups[0]?.groupId).toBe("A");
  });

  it("T2: erro HTTP → WorldcupServiceError com status preservado", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(502, "openfootball fora"));

    const error = await getGroups().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorldcupServiceError);
    expect((error as WorldcupServiceError).status).toBe(502);
    // WR-04: o detalhe do corpo `{ error }` é anexado à mensagem.
    expect((error as WorldcupServiceError).message).toContain("openfootball fora");
  });

  it("T2b: corpo não-JSON → fallback pt-BR sem mascarar status (WR-04)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    const error = await getGroups().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorldcupServiceError);
    expect((error as WorldcupServiceError).status).toBe(500);
    expect((error as WorldcupServiceError).message).toBe(
      "Não foi possível carregar a classificação dos grupos.",
    );
  });

  it("T3: corpo fora do contrato → ZodError", async () => {
    fetchMock.mockResolvedValue(okJson({ groups: "nope" }));

    await expect(getGroups()).rejects.toBeInstanceOf(ZodError);
  });
});

describe("getBracket", () => {
  it("T4: 2xx → parseia e retorna BracketResponse", async () => {
    fetchMock.mockResolvedValueOnce(okJson(makeBracketResponse()));

    const result = await getBracket();

    expect(fetchMock).toHaveBeenCalledWith("/api/worldcup/bracket");
    expect(result.roundOf32[0]?.phase).toBe("dezesseis-avos");
    expect(result.final).toEqual([]);
  });

  it("T5: erro HTTP → WorldcupServiceError", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(500));

    await expect(getBracket()).rejects.toMatchObject({
      name: "WorldcupServiceError",
      status: 500,
    });
  });

  it("T6: corpo fora do contrato → ZodError", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ roundOf32: [{ bogus: true }] }));

    await expect(getBracket()).rejects.toBeInstanceOf(ZodError);
  });
});
