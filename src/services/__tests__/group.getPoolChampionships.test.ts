/**
 * Testes de `getPoolChampionships` (multi-championship TASK-09).
 *
 * Lê `GET /api/group/championships` (rota escopada a membro). Sucesso valida por
 * schema (defesa em profundidade); erro HTTP vira `GroupServiceError` com mensagem
 * pt-BR (via helper compartilhado). Mockamos `global.fetch` — sem rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPoolChampionships, GroupServiceError } from "@/services/group";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

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

describe("getPoolChampionships", () => {
  it("faz GET /api/group/championships e devolve o payload validado", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        enabledChampionships: ["fifa.world", "bra.1-2026"],
        rankingMode: "por-campeonato",
      }),
    );

    const result = await getPoolChampionships();

    expect(fetchMock).toHaveBeenCalledWith("/api/group/championships", {
      method: "GET",
      credentials: "same-origin",
    });
    expect(result).toEqual({
      enabledChampionships: ["fifa.world", "bra.1-2026"],
      rankingMode: "por-campeonato",
    });
  });

  it("lança GroupServiceError em falha HTTP", async () => {
    fetchMock.mockResolvedValue(errorJson(403, "Você não participa de nenhum grupo."));

    await expect(getPoolChampionships()).rejects.toBeInstanceOf(GroupServiceError);
    await expect(getPoolChampionships()).rejects.toThrow(/permissão|participa/i);
  });

  it("rejeita payload fora do contrato (ZodError)", async () => {
    // rankingMode fora do enum viola o schema.
    fetchMock.mockResolvedValueOnce(
      okJson({ enabledChampionships: ["fifa.world"], rankingMode: "invalido" }),
    );

    await expect(getPoolChampionships()).rejects.toThrow();
  });
});
