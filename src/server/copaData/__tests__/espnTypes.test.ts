/**
 * Testes do schema Zod do scoreboard ESPN (TASK-02).
 * ES-01..ES-20
 *
 * Importa diretamente de ../espnTypes (módulo de schema puro, sem `server-only`).
 *
 * `noUncheckedIndexedAccess` está ligado: acesso por índice a array retorna
 * `T | undefined`. Para LEITURA usamos `comp()` (narrowing via `at()`); para
 * payloads INVÁLIDOS construímos literais inline passados direto a `safeParse`
 * (que aceita `unknown`), evitando mutação por índice.
 */

import { describe, it, expect } from "vitest";
import {
  espnScoreboardSchema,
  parseEspnScoreboard,
  type EspnScoreboard,
  type EspnCompetitor,
} from "../espnTypes";
import { espnEvent, ESPN_SCOREBOARD_REAL } from "./fixtures/espnFixtures";

/** Acesso por índice com narrowing — lança se fora de faixa. */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of range`);
  return v;
}

/** Competitor `cIdx` da 1ª competition do evento `evIdx` de um scoreboard parseado. */
function comp(sb: EspnScoreboard, evIdx: number, cIdx: number): EspnCompetitor {
  return at(at(at(sb.events, evIdx).competitions, 0).competitors, cIdx);
}

/** Scoreboard válido de 1 evento (post FT, BRA 2×1 ARG). */
function validScoreboard() {
  return {
    events: [
      espnEvent({
        date: "2026-06-14T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "BRA", score: "2" },
        away: { abbr: "ARG", score: "1", winner: false },
      }),
    ],
  };
}

describe("espnScoreboardSchema", () => {
  it("ES-01: payload mínimo válido → success", () => {
    expect(espnScoreboardSchema.safeParse(validScoreboard()).success).toBe(true);
  });

  it("ES-02: score string '2' coercido para number 2", () => {
    const parsed = espnScoreboardSchema.parse(validScoreboard());
    const home = comp(parsed, 0, 0);
    expect(home.score).toBe(2);
    expect(typeof home.score).toBe("number");
  });

  it("ES-03: score '0' coercido para 0", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "HAI", score: "0" },
          away: { abbr: "SCO", score: "1" },
        }),
      ],
    };
    const parsed = espnScoreboardSchema.parse(sb);
    expect(comp(parsed, 0, 0).score).toBe(0);
  });

  it("ES-04: winner true aceito", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "BRA", score: "2", winner: true },
          away: { abbr: "ARG", score: "1" },
        }),
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(true);
  });

  it("ES-05: winner ausente aceito (undefined)", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "in",
          detail: "31'",
          home: { abbr: "BRA", score: "1" },
          away: { abbr: "ARG", score: "0" },
        }),
      ],
    };
    const parsed = espnScoreboardSchema.parse(sb);
    expect(comp(parsed, 0, 0).winner).toBeUndefined();
  });

  it("ES-06: state 'in' aceito", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "in",
          detail: "31'",
          home: { abbr: "BRA", score: "1" },
          away: { abbr: "ARG", score: "0" },
        }),
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(true);
  });

  it("ES-07: state 'pre' aceito", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "pre",
          detail: "Sun, June 14th at 1:00 PM EDT",
          home: { abbr: "BRA", score: "0" },
          away: { abbr: "ARG", score: "0" },
        }),
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(true);
  });

  it("ES-08: state 'post' aceito", () => {
    expect(espnScoreboardSchema.safeParse(validScoreboard()).success).toBe(true);
  });

  it("ES-09: state inválido → failure", () => {
    const sb = {
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
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-10: homeAway 'home' aceito", () => {
    const parsed = espnScoreboardSchema.parse(validScoreboard());
    expect(comp(parsed, 0, 0).homeAway).toBe("home");
  });

  it("ES-11: homeAway 'away' aceito", () => {
    const parsed = espnScoreboardSchema.parse(validScoreboard());
    expect(comp(parsed, 0, 1).homeAway).toBe("away");
  });

  it("ES-12: homeAway 'neutral' → failure", () => {
    const sb = {
      events: [
        {
          date: "2026-06-14T19:00Z",
          competitions: [
            {
              status: { type: { state: "post", detail: "FT" } },
              competitors: [
                { homeAway: "neutral", score: "1", team: { abbreviation: "BRA" } },
                { homeAway: "away", score: "0", team: { abbreviation: "ARG" } },
              ],
            },
          ],
        },
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-13: competitors.length === 1 → failure", () => {
    const sb = {
      events: [
        {
          date: "2026-06-14T19:00Z",
          competitions: [
            {
              status: { type: { state: "post", detail: "FT" } },
              competitors: [
                { homeAway: "home", score: "1", team: { abbreviation: "BRA" } },
              ],
            },
          ],
        },
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-14: competitions.length === 0 → failure", () => {
    const sb = {
      events: [{ date: "2026-06-14T19:00Z", competitions: [] }],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-15: campo extra na raiz → success (passthrough)", () => {
    const sb = { ...validScoreboard(), extra: 123 };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(true);
  });

  it("ES-16: campo extra no competitor → success (passthrough)", () => {
    const sb = {
      events: [
        {
          date: "2026-06-14T19:00Z",
          competitions: [
            {
              status: { type: { state: "post", detail: "FT" } },
              competitors: [
                { homeAway: "home", score: "1", team: { abbreviation: "BRA" }, statistics: [] },
                { homeAway: "away", score: "0", team: { abbreviation: "ARG" } },
              ],
            },
          ],
        },
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(true);
  });

  it("ES-17: events vazio → success (sem jogos no dia)", () => {
    expect(espnScoreboardSchema.safeParse({ events: [] }).success).toBe(true);
  });

  it("ES-18: score '-1' → failure (min 0)", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "BRA", score: "-1" },
          away: { abbr: "ARG", score: "0" },
        }),
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-19: score '1.5' float → failure (int)", () => {
    const sb = {
      events: [
        espnEvent({
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "BRA", score: "1.5" },
          away: { abbr: "ARG", score: "0" },
        }),
      ],
    };
    expect(espnScoreboardSchema.safeParse(sb).success).toBe(false);
  });

  it("ES-20: payload real TASK-00 → success com scores corretos", () => {
    const res = parseEspnScoreboard(ESPN_SCOREBOARD_REAL);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const data: EspnScoreboard = res.data;
    expect(data.events).toHaveLength(3);

    expect(comp(data, 0, 0).score).toBe(1); // QAT
    expect(comp(data, 0, 1).score).toBe(1); // SUI
    expect(comp(data, 1, 0).team.abbreviation).toBe("BRA");
    expect(comp(data, 2, 0).score).toBe(0); // HAI
    expect(comp(data, 2, 1).score).toBe(1); // SCO
    expect(comp(data, 2, 1).winner).toBe(true);
  });
});
