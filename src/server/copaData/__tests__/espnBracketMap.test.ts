/**
 * Testes do espnBracketMap (TASK-07) — ingestão do matchNumber (core API) → slot.
 * BM-01..BM-16
 *
 * O slot de bracket vem do `matchNumber` oficial FIFA, exposto SÓ pelo core API
 * (`sports.core.api.espn.com/.../events/{id}/competitions/{id}`), não pelo
 * scoreboard. Offsets confirmados com coleta real (2026-06-30, eventos
 * 760486–760517 = mn 73–104):
 *   R32 73–88 off72 · R16 89–96 off88 · QF 97–100 off96 · SF 101–102 off100 ·
 *   3º 103 off102 · Final 104 off103.
 * Confronto-prova: evento 760504 (mn91) = R16 slot3, alimentado por R32 slot4
 * (760487, mn76, Brasil×Japão) + R32 slot6 (760490, mn78, Marfim×Noruega).
 *
 * NUNCA faz chamadas reais de rede — usa vi.stubGlobal("fetch", ...).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  deriveSlotInRound,
  fetchEspnMatchNumber,
  fetchEspnBracketMap,
} from "../espnBracketMap";
import {
  EspnFetchError,
  EspnParseError,
  EspnTimeoutError,
} from "../espnClient";
import { espnKnockoutEvent, espnGroupEvent } from "./fixtures/espnFixtures";

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

// ─── deriveSlotInRound (pura) — BM-01..BM-06 ───────────────────────────────

describe("deriveSlotInRound — BM-01..BM-06", () => {
  it("BM-01: round-of-32 mapeia mn 73→slot1 e mn 88→slot16 (off 72)", () => {
    expect(deriveSlotInRound("round-of-32", 73)).toEqual({
      round: "round-of-32",
      slotInRound: 1,
    });
    expect(deriveSlotInRound("round-of-32", 88)).toEqual({
      round: "round-of-32",
      slotInRound: 16,
    });
  });

  it("BM-02: round-of-16 mapeia mn 89→1, mn 91→3 (âncora 760504), mn 96→8 (off 88)", () => {
    expect(deriveSlotInRound("round-of-16", 89)).toEqual({
      round: "round-of-16",
      slotInRound: 1,
    });
    expect(deriveSlotInRound("round-of-16", 91)).toEqual({
      round: "round-of-16",
      slotInRound: 3,
    });
    expect(deriveSlotInRound("round-of-16", 96)).toEqual({
      round: "round-of-16",
      slotInRound: 8,
    });
  });

  it("BM-03: QF/SF/3º/Final mapeiam pelos offsets reais", () => {
    expect(deriveSlotInRound("quarterfinals", 97)?.slotInRound).toBe(1);
    expect(deriveSlotInRound("quarterfinals", 100)?.slotInRound).toBe(4);
    expect(deriveSlotInRound("semifinals", 101)?.slotInRound).toBe(1);
    expect(deriveSlotInRound("semifinals", 102)?.slotInRound).toBe(2);
    expect(deriveSlotInRound("3rd-place-match", 103)?.slotInRound).toBe(1);
    expect(deriveSlotInRound("final", 104)?.slotInRound).toBe(1);
  });

  it("BM-04: matchNumber fora da faixa da fase → null", () => {
    expect(deriveSlotInRound("round-of-32", 89)).toBeNull(); // já é R16
    expect(deriveSlotInRound("round-of-32", 72)).toBeNull();
    expect(deriveSlotInRound("final", 103)).toBeNull(); // é 3º lugar
    expect(deriveSlotInRound("round-of-16", 97)).toBeNull(); // já é QF
  });

  it("BM-05: slug de fase desconhecido → null", () => {
    expect(deriveSlotInRound("group-stage", 10)).toBeNull();
    expect(deriveSlotInRound("", 73)).toBeNull();
  });

  it("BM-06: matchNumber não-inteiro → null", () => {
    expect(deriveSlotInRound("round-of-32", Number.NaN)).toBeNull();
    expect(deriveSlotInRound("round-of-32", 73.5)).toBeNull();
  });
});

// ─── fetchEspnMatchNumber (HTTP 1 evento) — BM-07..BM-11 ────────────────────

const EVENT_ID = "760504";

describe("fetchEspnMatchNumber — BM-07..BM-11", () => {
  it("BM-07: sucesso extrai matchNumber; URL core API + eventId; revalidate 24h", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ id: EVENT_ID, matchNumber: 91 }));
    vi.stubGlobal("fetch", fetchMock);

    const mn = await fetchEspnMatchNumber(EVENT_ID);

    expect(mn).toBe(91);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("sports.core.api.espn.com");
    expect(url).toContain(`/events/${EVENT_ID}/competitions/${EVENT_ID}`);
    expect(init).toMatchObject({ next: { revalidate: 86_400 } });
    expect(init).toHaveProperty("signal");
  });

  it("BM-08: HTTP !ok → EspnFetchError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    await expect(fetchEspnMatchNumber(EVENT_ID)).rejects.toThrow(EspnFetchError);
  });

  it("BM-09: body não-JSON → EspnParseError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>nope</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    await expect(fetchEspnMatchNumber(EVENT_ID)).rejects.toThrow(EspnParseError);
  });

  it("BM-10: matchNumber ausente → EspnParseError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockJsonResponse({ id: EVENT_ID })),
    );
    await expect(fetchEspnMatchNumber(EVENT_ID)).rejects.toThrow(EspnParseError);
  });

  it("BM-11: AbortError → EspnTimeoutError", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    await expect(fetchEspnMatchNumber(EVENT_ID, 100)).rejects.toThrow(
      EspnTimeoutError,
    );
  });
});

// ─── fetchEspnBracketMap (agregador) — BM-12..BM-16 ─────────────────────────

/**
 * Mock de fetch que discrimina scoreboard vs core API por URL.
 * @param scoreboard payload retornado para QUALQUER chamada de scoreboard.
 * @param matchNumberById matchNumber por event.id (core API). undefined → body
 *        sem matchNumber (dispara EspnParseError naquele evento).
 */
function stubScheduleAndCore(
  scoreboard: unknown,
  matchNumberById: Record<string, number | undefined>,
) {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("/scoreboard")) {
      return mockJsonResponse(scoreboard);
    }
    const m = url.match(/events\/(\d+)\/competitions/);
    const id = m?.[1] ?? "";
    const mn = matchNumberById[id];
    return mockJsonResponse(mn === undefined ? { id } : { id, matchNumber: mn });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchEspnBracketMap — BM-12..BM-16", () => {
  it("BM-12: agrega — chaves são matchIds do domínio (m73+) e slots corretos", async () => {
    // 3 jogos KO em ordem de data → m73, m74, m75 (sequência de mapEspnEventsToMatches).
    const scoreboard = {
      events: [
        espnKnockoutEvent({
          id: "760487",
          date: "2026-06-29T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
        espnKnockoutEvent({
          id: "760490",
          date: "2026-06-30T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
        espnKnockoutEvent({
          id: "760504",
          date: "2026-07-05T20:00Z",
          state: "pre",
          detail: "Scheduled",
          slug: "round-of-16",
        }),
      ],
    };
    stubScheduleAndCore(scoreboard, {
      "760487": 76, // R32 slot4
      "760490": 78, // R32 slot6
      "760504": 91, // R16 slot3 (âncora)
    });

    const map = await fetchEspnBracketMap();

    expect(map.get("m73")).toEqual({ round: "round-of-32", slotInRound: 4 });
    expect(map.get("m74")).toEqual({ round: "round-of-32", slotInRound: 6 });
    expect(map.get("m75")).toEqual({ round: "round-of-16", slotInRound: 3 });
  });

  it("BM-13: degrada — 1 evento sem matchNumber é omitido; os demais permanecem", async () => {
    const scoreboard = {
      events: [
        espnKnockoutEvent({
          id: "760487",
          date: "2026-06-29T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
        espnKnockoutEvent({
          id: "760490",
          date: "2026-06-30T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
      ],
    };
    stubScheduleAndCore(scoreboard, {
      "760487": 76,
      "760490": undefined, // core API sem matchNumber → omitido
    });

    const map = await fetchEspnBracketMap();

    expect(map.get("m73")).toEqual({ round: "round-of-32", slotInRound: 4 });
    expect(map.has("m74")).toBe(false);
    expect(map.size).toBe(1);
  });

  it("BM-14: falha total do schedule → mapa vazio (sem throw)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    const map = await fetchEspnBracketMap();

    expect(map.size).toBe(0);
  });

  it("BM-15: jogos de fase de grupos são excluídos do mapa", async () => {
    const scoreboard = {
      events: [
        espnGroupEvent({
          id: "g1",
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "BRA", score: "2" },
          away: { abbr: "MAR", score: "0" },
        }),
        espnKnockoutEvent({
          id: "760487",
          date: "2026-06-29T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
      ],
    };
    stubScheduleAndCore(scoreboard, { "760487": 76 });

    const map = await fetchEspnBracketMap();

    // só o KO (m73); nenhum id de grupo; nenhuma chamada core API para grupo.
    expect(map.size).toBe(1);
    expect(map.get("m73")).toEqual({ round: "round-of-32", slotInRound: 4 });
  });

  it("BM-16: chamadas ao core API usam revalidate 24h (não o tier live)", async () => {
    const scoreboard = {
      events: [
        espnKnockoutEvent({
          id: "760487",
          date: "2026-06-29T19:00Z",
          state: "post",
          detail: "FT",
          slug: "round-of-32",
        }),
      ],
    };
    const fetchMock = stubScheduleAndCore(scoreboard, { "760487": 76 });

    await fetchEspnBracketMap();

    const coreCalls = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("core.api"),
    );
    expect(coreCalls.length).toBeGreaterThan(0);
    for (const [, init] of coreCalls) {
      expect(init).toMatchObject({ next: { revalidate: 86_400 } });
    }
  });
});
