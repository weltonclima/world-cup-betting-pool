/**
 * Testes do EspnScoreClient (TASK-03).
 * EC-01..EC-08
 *
 * Importa diretamente de ../espnClient (módulo sem `server-only`).
 * NUNCA faz chamadas reais de rede — usa vi.stubGlobal("fetch", ...).
 *
 * EC-02 (revalidate: 300) é critério de aceite explícito do plano.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  EspnScoreClient,
  EspnTimeoutError,
  EspnFetchError,
  EspnParseError,
} from "../espnClient";
import { ESPN_SCOREBOARD_REAL } from "./fixtures/espnFixtures";

const DATE = "20260614";

/** Response fake com body JSON. */
function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EspnScoreClient — EC-01..EC-08", () => {
  it("EC-01: retorna EspnScoreboard quando fetch retorna JSON válido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(ESPN_SCOREBOARD_REAL)));

    const data = await new EspnScoreClient().fetchScoreboard(DATE);

    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events).toHaveLength(3);
  });

  it("EC-02: fetch chamado com next.revalidate=300 (cache 5min)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(ESPN_SCOREBOARD_REAL));
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchScoreboard(DATE);

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ next: { revalidate: 300 } });
    expect(init).toHaveProperty("signal");
  });

  it("EC-03: URL contém ?dates=<dateUtc> e a liga fifa.world", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(ESPN_SCOREBOARD_REAL));
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchScoreboard(DATE);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("?dates=20260614");
    expect(url).toContain("/soccer/fifa.world/scoreboard");
  });

  it("EC-04: lança EspnFetchError em HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(new EspnScoreClient().fetchScoreboard(DATE)).rejects.toThrow(EspnFetchError);
  });

  it("EC-05: lança EspnTimeoutError em AbortError (timeout)", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(new EspnScoreClient(100).fetchScoreboard(DATE)).rejects.toThrow(EspnTimeoutError);
  });

  it("EC-06: lança EspnParseError quando shape inválido (state desconhecido)", async () => {
    const invalid = {
      events: [
        {
          date: "2026-06-14T19:00Z",
          competitions: [
            {
              status: { type: { state: "unknown", detail: "??" } },
              competitors: [
                { homeAway: "home", score: "1", team: { abbreviation: "BRA" } },
                { homeAway: "away", score: "0", team: { abbreviation: "ARG" } },
              ],
            },
          ],
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(invalid)));

    await expect(new EspnScoreClient().fetchScoreboard(DATE)).rejects.toThrow(EspnParseError);
  });

  it("EC-07: lança EspnParseError quando body não é JSON parseable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>not json</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(new EspnScoreClient().fetchScoreboard(DATE)).rejects.toThrow(EspnParseError);
  });

  it("EC-08: events vazio ([]) → retorna sem erro (sem jogos no dia)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse({ events: [] })));

    const data = await new EspnScoreClient().fetchScoreboard(DATE);

    expect(data.events).toHaveLength(0);
  });

  it("EC-09: erro de rede genérico (não AbortError) re-lançado com /rede/", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(new EspnScoreClient().fetchScoreboard(DATE)).rejects.toThrow(/rede/i);
  });
});
