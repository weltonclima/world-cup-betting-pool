import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getChampionshipsCatalog } from "@/services/championships";

/**
 * Testes da camada de serviço do catálogo público de campeonatos (multi-champ
 * TASK-08). Consome `GET /api/championships` via `fetch` (mockado). Cobre:
 * sucesso + validação por schema, corpo não-array, item inválido (Zod) e erro
 * HTTP via `buildHttpError`.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeChamp(overrides: Record<string, unknown> = {}) {
  return {
    id: "bra.1-2026",
    name: "Brasileirão Série A",
    season: "2026",
    type: "league",
    status: "upcoming",
    ...overrides,
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
  vi.restoreAllMocks();
});

describe("getChampionshipsCatalog", () => {
  it("faz GET /api/championships e retorna ChampionshipPublic[] validado", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        makeChamp({ id: "fifa.world", name: "Copa", type: "cup", status: "archived" }),
        makeChamp({ id: "bra.1-2026" }),
      ]),
    );

    const result = await getChampionshipsCatalog();

    expect(fetchMock).toHaveBeenCalledWith("/api/championships", {
      method: "GET",
      credentials: "same-origin",
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "fifa.world", type: "cup" });
    expect(result[1]).toMatchObject({ id: "bra.1-2026", type: "league" });
  });

  it("retorna [] quando a API responde []", async () => {
    fetchMock.mockResolvedValueOnce(okJson([]));
    await expect(getChampionshipsCatalog()).resolves.toEqual([]);
  });

  it("lança quando o corpo não é um array", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ items: [] }));
    await expect(getChampionshipsCatalog()).rejects.toThrow(
      /Resposta inválida do catálogo/i,
    );
  });

  it("lança (Zod) quando um item viola o schema — campo faltando", async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: "x", name: "X" }]));
    await expect(getChampionshipsCatalog()).rejects.toThrow();
  });

  it("lança (Zod .strict) quando um item traz campo interno extra", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([makeChamp({ espnSlug: "bra.1" })]),
    );
    await expect(getChampionshipsCatalog()).rejects.toThrow();
  });

  it("lança buildHttpError com status quando a resposta não é ok", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(500, "boom"));
    await expect(getChampionshipsCatalog()).rejects.toThrow(/HTTP 500/);
  });
});
