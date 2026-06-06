/**
 * Testes de validação de envelope do HttpApiFootballClient.
 * Cobre BL-01: o cliente deve rejeitar envelopes malformados via Zod.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HttpApiFootballClient,
  ApiFootballQuotaError,
  ApiFootballAuthError,
  ApiFootballTimeoutError,
} from "../apiFootball/client";

/** Cria uma Response fake com o body JSON fornecido */
function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpApiFootballClient — validação de envelope (BL-01)", () => {
  it("BL-01a: retorna o array response quando o envelope é válido", async () => {
    const envelopeValido = { results: 2, response: [{ team: { id: 1 } }, { team: { id: 2 } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(envelopeValido)));

    const client = new HttpApiFootballClient("chave-fake");
    // getTeamsByTournament usa fetchJson internamente; o resultado bruto é T[]
    // (a validação individual de cada item fica nos mappers)
    const result = await client.getTeamsByTournament(1, 2026);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("BL-01b: lança Error quando `response` está ausente no envelope", async () => {
    const envelopeInvalido = { results: 0, data: [] }; // sem campo `response`
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(envelopeInvalido)));

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      /envelope inválido/i,
    );
  });

  it("BL-01c: lança Error quando `response` não é array", async () => {
    const envelopeInvalido = { results: 0, response: "não é array" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(envelopeInvalido)));

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      /envelope inválido/i,
    );
  });

  it("BL-01d: lança Error quando o body não é objeto (ex.: string)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('"resposta inesperada"', { status: 200 })),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      /envelope inválido/i,
    );
  });

  it("BL-01e: mensagem de erro inclui campo `errors` quando presente", async () => {
    const envelopeComErros = { errors: { token: "Error/Missing application key" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(envelopeComErros)));

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      /token/i,
    );
  });
});

describe("HttpApiFootballClient — erros HTTP", () => {
  it("lança ApiFootballQuotaError em 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      ApiFootballQuotaError,
    );
  });

  it("lança ApiFootballAuthError em 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      ApiFootballAuthError,
    );
  });

  it("lança ApiFootballAuthError em 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      ApiFootballAuthError,
    );
  });

  it("lança ApiFootballTimeoutError em AbortError", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const client = new HttpApiFootballClient("chave-fake", 100);
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      ApiFootballTimeoutError,
    );
  });

  it("lança Error genérico para outros erros de rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(
      /erro de rede/i,
    );
  });

  it("lança Error para status HTTP inesperado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const client = new HttpApiFootballClient("chave-fake");
    await expect(client.getTeamsByTournament(1, 2026)).rejects.toThrow(/503/);
  });
});
