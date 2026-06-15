/**
 * Testes do EspnScoreClient.
 * EC-01..EC-09 (fetchScoreboard, TASK-03) · FS-01..FS-10 (fetchSchedule, TASK-04)
 *
 * Importa diretamente de ../espnClient (módulo sem `server-only`).
 * NUNCA faz chamadas reais de rede — usa vi.stubGlobal("fetch", ...).
 *
 * EC-02 / FS-05 (revalidate: 300) são critério de aceite explícito do plano.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  EspnScoreClient,
  EspnTimeoutError,
  EspnFetchError,
  EspnParseError,
  ESPN_TOURNAMENT_RANGES,
} from "../espnClient";
import { ESPN_SCOREBOARD_REAL, espnEvent } from "./fixtures/espnFixtures";

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

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ next: { revalidate: 300 } });
    expect(init).toHaveProperty("signal");
  });

  it("EC-03: URL contém ?dates=<dateUtc> e a liga fifa.world", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(ESPN_SCOREBOARD_REAL));
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchScoreboard(DATE);

    const [url] = fetchMock.mock.calls[0]!;
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

// ─── fetchSchedule — FS-01..FS-10 ──────────────────────────────────────────

/** Scoreboard com eventos de ids dados (state pre, sem placar relevante). */
function scoreboardWithIds(ids: string[]): unknown {
  return {
    events: ids.map((id) =>
      espnEvent({
        date: "2026-06-14T19:00Z",
        state: "pre",
        detail: "Scheduled",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "ARG", score: "0" },
        id,
      }),
    ),
  };
}

describe("EspnScoreClient.fetchSchedule — FS-01..FS-10", () => {
  it("FS-01: sem args → 2 chamadas com os ranges do torneio", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => mockJsonResponse({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchSchedule();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("?dates=20260611-20260627"))).toBe(true);
    expect(urls.some((u) => u.includes("?dates=20260628-20260719"))).toBe(true);
    expect(ESPN_TOURNAMENT_RANGES).toEqual([
      "20260611-20260627",
      "20260628-20260719",
    ]);
  });

  it("FS-02: retorna array flat com eventos de ambos os ranges", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["1", "2"])))
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["3", "4", "5"])));
    vi.stubGlobal("fetch", fetchMock);

    const events = await new EspnScoreClient().fetchSchedule();

    expect(events).toHaveLength(5);
    expect(events.map((e) => e.id).sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("FS-03: range único → 1 chamada com esse range", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse(scoreboardWithIds(["1", "2"])));
    vi.stubGlobal("fetch", fetchMock);

    const events = await new EspnScoreClient().fetchSchedule(["20260611-20260627"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain("?dates=20260611-20260627");
    expect(events).toHaveLength(2);
  });

  it("FS-04: dedup por event.id (mesmo id em dois ranges → 1 vez)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["1", "2"])))
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["2", "3"])));
    vi.stubGlobal("fetch", fetchMock);

    const events = await new EspnScoreClient().fetchSchedule();

    expect(events.map((e) => e.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("FS-05: cada chamada usa next.revalidate=300", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => mockJsonResponse({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchSchedule();

    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ next: { revalidate: 300 } });
    }
  });

  it("FS-06: EspnFetchError em um range → rejeita com EspnFetchError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["1"])))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new EspnScoreClient().fetchSchedule()).rejects.toThrow(EspnFetchError);
  });

  it("FS-07: EspnTimeoutError em um range → rejeita com EspnTimeoutError", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["1"])))
      .mockRejectedValueOnce(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(new EspnScoreClient(100).fetchSchedule()).rejects.toThrow(
      EspnTimeoutError,
    );
  });

  it("FS-08: shape inválido em um range → rejeita com EspnParseError", async () => {
    const invalid = {
      events: [{ date: "x", competitions: [{ status: { type: { state: "??" } } }] }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(scoreboardWithIds(["1"])))
      .mockResolvedValueOnce(mockJsonResponse(invalid));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new EspnScoreClient().fetchSchedule()).rejects.toThrow(EspnParseError);
  });

  it("FS-09: ranges vazio ([]) → [] sem nenhum fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const events = await new EspnScoreClient().fetchSchedule([]);

    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FS-10: chamadas dos ranges são paralelas (ambas pendentes simultaneamente)", async () => {
    let pending = 0;
    let maxConcurrent = 0;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pending += 1;
          maxConcurrent = Math.max(maxConcurrent, pending);
          setTimeout(() => {
            pending -= 1;
            resolve(mockJsonResponse({ events: [] }));
          }, 10);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await new EspnScoreClient().fetchSchedule();

    expect(maxConcurrent).toBe(2);
  });
});
