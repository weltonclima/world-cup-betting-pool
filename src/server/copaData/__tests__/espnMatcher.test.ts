/**
 * Testes do matcher ESPN event ↔ matchId openfootball (TASK-05).
 * MT-01..MT-18
 *
 * O matcher consome `EspnEvent[]` JÁ VALIDADOS (pós-parse do schema TASK-02) +
 * a lista base `MatchWithId[]` (openfootball). Por isso parseamos os fixtures
 * (`espnEvent`) via `espnScoreboardSchema` antes de passar ao matcher — espelha
 * o fluxo real (client → schema → matcher).
 *
 * Invariante crítica: matching errado NUNCA pode escrever em jogo errado.
 * Preferir falso-negativo (ignora, null) a falso-positivo.
 */

import { describe, it, expect } from "vitest";
import { espnScoreboardSchema, type EspnEvent, type EspnCompetition } from "../espnTypes";
import { matchEspnEvent, buildEspnPatchMap } from "../espnMatcher";
import type { MatchWithId } from "@/types/matches";
import { espnEvent, ESPN_SCOREBOARD_REAL } from "./fixtures/espnFixtures";

/** Constrói um EspnEvent validado (pós-parse) a partir de opções cruas. */
function event(opts: {
  date: string;
  state: "pre" | "in" | "post";
  detail?: string;
  home: { abbr: string; score: string; winner?: boolean };
  away: { abbr: string; score: string; winner?: boolean };
}): EspnEvent {
  const sb = espnScoreboardSchema.parse({
    events: [
      espnEvent({
        date: opts.date,
        state: opts.state,
        detail: opts.detail ?? "FT",
        home: opts.home,
        away: opts.away,
      }),
    ],
  });
  const ev = sb.events[0];
  if (!ev) throw new Error("no event");
  return ev;
}

/** Constrói um MatchWithId base mínimo (campos consumidos pelo matcher). */
function match(opts: {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
}): MatchWithId {
  return {
    id: opts.id,
    homeTeamId: opts.homeTeamId,
    awayTeamId: opts.awayTeamId,
    kickoffAt: opts.kickoffAt,
    stage: "grupos",
    groupId: "A",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

describe("matchEspnEvent — resolução de times", () => {
  it("MT-01: time não resolvível (placeholder mata-mata) → null", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "1A", score: "1" },
      away: { abbr: "2B", score: "0" },
    });
    const base = [
      match({
        id: "x",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toBeNull();
  });

  it("MT-02: apenas um lado irreconhecível → null", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "RD16 W1", score: "0" },
    });
    const base = [
      match({
        id: "x",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toBeNull();
  });
});

describe("matchEspnEvent — casamento por par + data", () => {
  it("MT-03: par + data exata (fase de grupos) → casa com patch live", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "0" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toEqual({
      matchId: "BRA-MAR-2026-06-14",
      patch: { status: "live", homeScore: 1, awayScore: 0 },
    });
  });

  it("MT-04: janela ±1 dia — kickoff UTC no dia anterior → casa", () => {
    const ev = event({
      date: "2026-06-14T01:00Z",
      state: "in",
      home: { abbr: "BRA", score: "2" },
      away: { abbr: "MAR", score: "1" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-13",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-13T23:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toEqual({
      matchId: "BRA-MAR-2026-06-13",
      patch: { status: "live", homeScore: 2, awayScore: 1 },
    });
  });

  it("MT-05: par resolvível mas ausente da base → null", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "ARG", score: "1" },
      away: { abbr: "BRA", score: "0" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toBeNull();
  });

  it("MT-06: par fora da janela de data (>1 dia) → null", () => {
    const ev = event({
      date: "2026-06-20T16:00Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "0" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toBeNull();
  });

  it("MT-07: par invertido (home/away trocados) → null (não simétrico)", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "MAR", score: "0" },
      away: { abbr: "BRA", score: "1" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toBeNull();
  });
});

describe("matchEspnEvent — patch por estado", () => {
  it("MT-08: state 'pre' → patch scheduled scores null", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "pre",
      detail: "Sun, June 14th at 1:00 PM EDT",
      home: { abbr: "BRA", score: "0" },
      away: { abbr: "MAR", score: "0" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toEqual({
      matchId: "BRA-MAR-2026-06-14",
      patch: { status: "scheduled", homeScore: null, awayScore: null },
    });
  });

  it("MT-09: state 'post' → patch finished com scores", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "post",
      home: { abbr: "BRA", score: "2" },
      away: { abbr: "MAR", score: "1" },
    });
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(ev, base)).toEqual({
      matchId: "BRA-MAR-2026-06-14",
      patch: { status: "finished", homeScore: 2, awayScore: 1 },
    });
  });
});

describe("buildEspnPatchMap", () => {
  it("MT-10: mix casável/não-casável → Map só com os casados", () => {
    const events = [
      // não resolve time
      event({
        date: "2026-06-14T16:00Z",
        state: "in",
        home: { abbr: "1A", score: "1" },
        away: { abbr: "2B", score: "0" },
      }),
      // par válido mas ausente da base
      event({
        date: "2026-06-14T16:00Z",
        state: "in",
        home: { abbr: "ARG", score: "1" },
        away: { abbr: "USA", score: "0" },
      }),
      // casa
      event({
        date: "2026-06-14T16:00Z",
        state: "post",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "MAR", score: "1" },
      }),
    ];
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    const map = buildEspnPatchMap(events, base);
    expect(map.size).toBe(1);
    expect(map.get("BRA-MAR-2026-06-14")).toEqual({
      status: "finished",
      homeScore: 1,
      awayScore: 1,
    });
  });

  it("MT-11: events vazio → Map vazio", () => {
    const map = buildEspnPatchMap([], [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ]);
    expect(map.size).toBe(0);
  });

  it("MT-13: dois eventos casando o mesmo matchId → último vence (R6)", () => {
    const events = [
      event({
        date: "2026-06-14T16:00Z",
        state: "in",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "MAR", score: "0" },
      }),
      event({
        date: "2026-06-14T16:00Z",
        state: "post",
        home: { abbr: "BRA", score: "2" },
        away: { abbr: "MAR", score: "1" },
      }),
    ];
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    const map = buildEspnPatchMap(events, base);
    expect(map.size).toBe(1);
    expect(map.get("BRA-MAR-2026-06-14")).toEqual({
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    });
  });

  it("MT-12: múltiplos casáveis → Map com todas as entradas", () => {
    const events = [
      event({
        date: "2026-06-14T16:00Z",
        state: "post",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "MAR", score: "1" },
      }),
      event({
        date: "2026-06-14T19:00Z",
        state: "in",
        home: { abbr: "ARG", score: "2" },
        away: { abbr: "USA", score: "0" },
      }),
    ];
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
      match({
        id: "ARG-USA-2026-06-14",
        homeTeamId: "ARG",
        awayTeamId: "USA",
        kickoffAt: "2026-06-14T19:00:00Z",
      }),
    ];
    const map = buildEspnPatchMap(events, base);
    expect(map.size).toBe(2);
    expect(map.get("BRA-MAR-2026-06-14")).toEqual({
      status: "finished",
      homeScore: 1,
      awayScore: 1,
    });
    expect(map.get("ARG-USA-2026-06-14")).toEqual({
      status: "live",
      homeScore: 2,
      awayScore: 0,
    });
  });
});

describe("matchEspnEvent — payload real TASK-00", () => {
  it("MT-14: scoreboard real (QAT/SUI, BRA/MAR, HAI/SCO) casa os 3 contra a base", () => {
    const sb = espnScoreboardSchema.parse(ESPN_SCOREBOARD_REAL);
    const base = [
      match({
        id: "QAT-SUI",
        homeTeamId: "QAT",
        awayTeamId: "SUI",
        kickoffAt: "2026-06-13T19:00:00Z",
      }),
      match({
        id: "BRA-MAR",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-13T22:00:00Z",
      }),
      match({
        id: "HAI-SCO",
        homeTeamId: "HAI",
        awayTeamId: "SCO",
        kickoffAt: "2026-06-14T01:00:00Z",
      }),
    ];
    const map = buildEspnPatchMap(sb.events, base);
    expect(map.size).toBe(3);
    expect(map.get("QAT-SUI")).toEqual({ status: "finished", homeScore: 1, awayScore: 1 });
    expect(map.get("BRA-MAR")).toEqual({ status: "finished", homeScore: 1, awayScore: 1 });
    expect(map.get("HAI-SCO")).toEqual({ status: "finished", homeScore: 0, awayScore: 1 });
  });
});

describe("matchEspnEvent — robustez defensiva", () => {
  it("MT-15: event.date malformada → null (NaN-safe, nunca casa errado)", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "0" },
    });
    const malformed: EspnEvent = { ...ev, date: "not-a-date" };
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(malformed, base)).toBeNull();
  });

  it("MT-17: dois jogos com MESMO par dentro da janela → null (ambiguidade, R3/R5)", () => {
    // Mesmas seleções se reencontram: último jogo de grupo + mata-mata próximos.
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "post",
      home: { abbr: "BRA", score: "2" },
      away: { abbr: "MAR", score: "1" },
    });
    const base = [
      match({
        id: "BRA-MAR-grupo",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
      match({
        id: "BRA-MAR-mata",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-15T16:00:00Z", // +1 dia → também na janela
      }),
    ];
    // Falso-positivo seria escrever em um dos dois. Correto: ignorar.
    expect(matchEspnEvent(ev, base)).toBeNull();
  });

  it("MT-18: boundary — event 23:59Z vs kickoff +1 dia 00:01Z → casa (1 dia exato)", () => {
    const ev = event({
      date: "2026-06-14T23:59Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "0" },
    });
    const base = [
      match({
        id: "BRA-MAR-boundary",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-15T00:01:00Z", // dia seguinte → 1 dia de diferença
      }),
    ];
    expect(matchEspnEvent(ev, base)?.matchId).toBe("BRA-MAR-boundary");
  });

  it("MT-16: competition sem competitor 'home' (ambos away) → null", () => {
    const ev = event({
      date: "2026-06-14T16:00Z",
      state: "in",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "0" },
    });
    const comp = ev.competitions[0]!;
    const bothAway: EspnCompetition = {
      ...comp,
      competitors: [
        { ...comp.competitors[0]!, homeAway: "away" },
        { ...comp.competitors[1]!, homeAway: "away" },
      ],
    };
    const broken: EspnEvent = { ...ev, competitions: [bothAway] };
    const base = [
      match({
        id: "BRA-MAR-2026-06-14",
        homeTeamId: "BRA",
        awayTeamId: "MAR",
        kickoffAt: "2026-06-14T16:00:00Z",
      }),
    ];
    expect(matchEspnEvent(broken, base)).toBeNull();
  });
});
