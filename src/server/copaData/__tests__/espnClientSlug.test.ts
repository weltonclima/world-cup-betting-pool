import { afterEach, describe, expect, it, vi } from "vitest";

import { EspnScoreClient } from "../espnClient";
import { espnEvent } from "./fixtures/espnFixtures";

function mockFetchOk() {
  const spy = vi.fn(
    async (_url: string, _init?: unknown) =>
      new Response(JSON.stringify({ events: [] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EspnScoreClient › parametrização por slug", () => {
  it("usa fifa.world por default (compat)", async () => {
    const spy = mockFetchOk();
    await new EspnScoreClient().fetchScoreboard("20260614");
    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain("/soccer/fifa.world/scoreboard");
    expect(url).toContain("?dates=20260614");
  });

  it("usa o slug informado", async () => {
    const spy = mockFetchOk();
    await new EspnScoreClient("bra.1").fetchScoreboard("20260410");
    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain("/soccer/bra.1/scoreboard");
  });
});

describe("EspnScoreClient › guarda de cap (truncamento)", () => {
  it("range com >= 100 eventos lança (falha ruidosa, não trunca em silêncio)", async () => {
    const events = Array.from({ length: 100 }, (_v, i) =>
      espnEvent({
        id: `evt-${i}`,
        date: "2026-04-10T19:00Z",
        state: "pre",
        detail: "Scheduled",
        home: { abbr: "AAA", score: "0" },
        away: { abbr: "BBB", score: "0" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, _init?: unknown) =>
          new Response(JSON.stringify({ events }), { status: 200 }),
      ),
    );
    await expect(
      new EspnScoreClient("bra.1").fetchSchedule(["20260401-20260430"]),
    ).rejects.toThrow(/cap/i);
  });
});
