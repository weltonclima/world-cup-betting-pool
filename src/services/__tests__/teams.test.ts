import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAllTeams } from "@/services/teams";

/**
 * Testes da camada de serviço de seleções (integracao-api-football, TASK-05).
 *
 * Agora consome `GET /api/teams` via `fetch` (não mais Firestore). Mockamos
 * `global.fetch`. Cobrimos: sucesso, vazio, erro HTTP e parse Zod inválido.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

/** Seleção com `id` embutido (formato da resposta de /api/teams). */
function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "6",
    name: "Brasil",
    code: "BRA",
    flagUrl: "https://media.api-sports.io/flags/br.svg",
    groupId: "Group D",
    ...overrides,
  };
}

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
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

describe("listAllTeams", () => {
  it("faz GET /api/teams e retorna TeamWithId[] validado", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        makeTeam({ id: "6", name: "Brasil", code: "BRA" }),
        makeTeam({ id: "26", name: "Argentina", code: "ARG", groupId: "Group A" }),
      ]),
    );

    const result = await listAllTeams();

    expect(fetchMock).toHaveBeenCalledWith("/api/teams");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "6", name: "Brasil", code: "BRA" });
    expect(result[1]).toMatchObject({ id: "26", name: "Argentina", code: "ARG" });
  });

  it("retorna array vazio quando a API responde []", async () => {
    fetchMock.mockResolvedValueOnce(okJson([]));

    await expect(listAllTeams()).resolves.toEqual([]);
  });

  it("lança Error com status e detalhe em falha HTTP", async () => {
    // persistente: as duas asserções de rejeição disparam dois fetches.
    fetchMock.mockResolvedValue(errorJson(503, "Cota esgotada."));

    await expect(listAllTeams()).rejects.toThrow(/HTTP 503/);
    await expect(listAllTeams()).rejects.toThrow(/Cota esgotada\./);
  });

  it("lança Error mesmo sem corpo JSON no erro HTTP", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(listAllTeams()).rejects.toThrow(/HTTP 500/);
  });

  it("código inválido (2 letras) faz rejeitar (ZodError)", async () => {
    fetchMock.mockResolvedValueOnce(okJson([makeTeam({ code: "BR" })]));

    await expect(listAllTeams()).rejects.toThrow();
  });

  it("item sem id faz rejeitar (ZodError)", async () => {
    const { id: _omit, ...semId } = makeTeam();
    void _omit;
    fetchMock.mockResolvedValueOnce(okJson([semId]));

    await expect(listAllTeams()).rejects.toThrow();
  });
});
