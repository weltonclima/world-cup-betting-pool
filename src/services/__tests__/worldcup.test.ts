import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGroups, getBracket } from "@/services/worldcup";

/**
 * Testes da camada de serviço worldcup (TASK-05).
 *
 * Mockamos `global.fetch` — sem rede real. Cobrimos: sucesso com objeto parseado,
 * shape inválido → ZodError, falha HTTP com `{error}` → Error com msg+status.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ── fixtures ─────────────────────────────────────────────────────────────────

/** Resposta válida de /api/worldcup/groups */
function makeGroupsResponse(overrides: Record<string, unknown> = {}) {
  return {
    groups: [
      {
        groupId: "A",
        standings: [
          {
            position: 1,
            team: { id: "bra", name: "Brasil", code: "BRA", flagUrl: "https://flags/bra.png" },
            played: 3,
            wins: 3,
            draws: 0,
            losses: 0,
            goalsFor: 9,
            goalsAgainst: 1,
            goalDifference: 8,
            points: 9,
            qualification: "classificado",
          },
        ],
      },
    ],
    hasLiveGroupMatch: false,
    ...overrides,
  };
}

/** Resposta válida de /api/worldcup/bracket */
function makeBracketResponse(overrides: Record<string, unknown> = {}) {
  return {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
    ...overrides,
  };
}

/** Resposta `ok` 200 com corpo JSON. */
function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/** Resposta de erro com status arbitrário e corpo `{ error }` opcional. */
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
  vi.restoreAllMocks();
});

// ── getGroups ─────────────────────────────────────────────────────────────────

describe("getGroups", () => {
  it("faz GET /api/worldcup/groups e retorna GroupsResponse validada", async () => {
    fetchMock.mockResolvedValueOnce(okJson(makeGroupsResponse()));

    const result = await getGroups();

    expect(fetchMock).toHaveBeenCalledWith("/api/worldcup/groups");
    expect(result).toMatchObject({ hasLiveGroupMatch: false });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ groupId: "A" });
  });

  it("hasLiveGroupMatch:true é preservado na resposta", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson(makeGroupsResponse({ hasLiveGroupMatch: true })),
    );

    const result = await getGroups();

    expect(result.hasLiveGroupMatch).toBe(true);
  });

  it("shape inválido (groups não é array) → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ groups: "x", hasLiveGroupMatch: false }));

    await expect(getGroups()).rejects.toThrow();
  });

  it("shape inválido (hasLiveGroupMatch ausente) → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ groups: [] }));

    await expect(getGroups()).rejects.toThrow();
  });

  it("non-2xx com {error} → lança Error contendo msg e status", async () => {
    fetchMock.mockResolvedValue(errorJson(503, "Cota esgotada."));

    await expect(getGroups()).rejects.toThrow(/HTTP 503/);
    await expect(getGroups()).rejects.toThrow(/Cota esgotada\./);
  });

  it("non-2xx sem body JSON → lança Error com status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);

    await expect(getGroups()).rejects.toThrow(/HTTP 500/);
  });

  it("mensagem de erro contém 'classificação dos grupos'", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(404));

    await expect(getGroups()).rejects.toThrow(/classificação dos grupos/);
  });
});

// ── getBracket ────────────────────────────────────────────────────────────────

describe("getBracket", () => {
  it("faz GET /api/worldcup/bracket e retorna BracketResponse validada", async () => {
    fetchMock.mockResolvedValueOnce(okJson(makeBracketResponse()));

    const result = await getBracket();

    expect(fetchMock).toHaveBeenCalledWith("/api/worldcup/bracket");
    expect(result).toMatchObject({
      roundOf32: [],
      roundOf16: [],
      quarterFinals: [],
      semiFinals: [],
      thirdPlace: [],
      final: [],
    });
  });

  it("shape inválido (campo ausente) → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ roundOf32: [], roundOf16: [] }));

    await expect(getBracket()).rejects.toThrow();
  });

  it("shape inválido (campo não-array) → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ ...makeBracketResponse(), roundOf32: "x" }),
    );

    await expect(getBracket()).rejects.toThrow();
  });

  it("non-2xx com {error} → lança Error contendo msg e status", async () => {
    fetchMock.mockResolvedValue(errorJson(503, "Serviço indisponível."));

    await expect(getBracket()).rejects.toThrow(/HTTP 503/);
    await expect(getBracket()).rejects.toThrow(/Serviço indisponível\./);
  });

  it("non-2xx sem body JSON → lança Error com status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);

    await expect(getBracket()).rejects.toThrow(/HTTP 502/);
  });

  it("mensagem de erro contém 'chaveamento'", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(404));

    await expect(getBracket()).rejects.toThrow(/chaveamento/);
  });
});
