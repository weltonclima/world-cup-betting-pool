/**
 * Testes TDD do HttpCopaDataClient.
 * CLI-01..CLI-07
 *
 * Importa diretamente de ../client (não do barrel ../index),
 * pois o barrel inclui `import "server-only"` que lança fora de RSC (vitest).
 *
 * NUNCA faz chamadas reais de rede — usa vi.stubGlobal("fetch", ...).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HttpCopaDataClient,
  CopaDataTimeoutError,
  CopaDataFetchError,
  CopaDataParseError,
} from "../client";
import { MOCK_COPA_DATA } from "./fixtures/openfootballFixtures";

/** Cria uma Response fake com o body JSON fornecido */
function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpCopaDataClient — CLI-01..CLI-07", () => {
  it("CLI-01: retorna OpenFootballData válido quando fetch retorna JSON bem-formado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(MOCK_COPA_DATA)));

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    const data = await client.getData();

    expect(Array.isArray(data.matches)).toBe(true);
    expect(data.matches.length).toBeGreaterThan(0);
  });

  it("CLI-02: lança CopaDataTimeoutError em AbortError (timeout)", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const client = new HttpCopaDataClient("https://fake-url.example.com", 100);
    await expect(client.getData()).rejects.toThrow(CopaDataTimeoutError);
  });

  it("CLI-03: lança CopaDataFetchError em HTTP 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    await expect(client.getData()).rejects.toThrow(CopaDataFetchError);
  });

  it("CLI-04: lança CopaDataFetchError em HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    await expect(client.getData()).rejects.toThrow(CopaDataFetchError);
  });

  it("CLI-05: lança CopaDataParseError quando JSON não tem campo matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockJsonResponse({ name: "World Cup 2026" })),
    );

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    await expect(client.getData()).rejects.toThrow(CopaDataParseError);
  });

  it("CLI-06: lança CopaDataParseError quando matches não é array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockJsonResponse({ name: "World Cup 2026", matches: "não é array" })),
    );

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    await expect(client.getData()).rejects.toThrow(CopaDataParseError);
  });

  it("CLI-07: lança erro de rede genérico (não AbortError) para falha de rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const client = new HttpCopaDataClient("https://fake-url.example.com");
    await expect(client.getData()).rejects.toThrow(/rede/i);
  });
});
