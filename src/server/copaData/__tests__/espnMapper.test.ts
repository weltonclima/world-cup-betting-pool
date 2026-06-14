/**
 * Testes do mapper ESPN event → patch de status/placar (TASK-04).
 * EM-01..EM-18
 *
 * O mapper consome `EspnCompetition` JÁ VALIDADA (pós-parse do schema TASK-02,
 * score já coercido para number). Por isso construímos as competitions
 * parseando os fixtures (`espnEvent`) via `espnScoreboardSchema` antes de
 * passar ao mapper — espelha o fluxo real (client → schema → mapper).
 */

import { describe, it, expect } from "vitest";
import { espnScoreboardSchema, type EspnCompetition } from "../espnTypes";
import { mapEspnState, mapEspnCompetition } from "../espnMapper";
import { matchSchema } from "@/schemas/matches";
import { espnEvent } from "./fixtures/espnFixtures";

/** Constrói uma EspnCompetition validada (pós-parse) a partir de um evento cru. */
function competition(opts: {
  state: "pre" | "in" | "post";
  detail?: string;
  home: { abbr: string; score: string; winner?: boolean };
  away: { abbr: string; score: string; winner?: boolean };
}): EspnCompetition {
  const sb = {
    events: [
      espnEvent({
        date: "2026-06-14T19:00Z",
        state: opts.state,
        detail: opts.detail ?? "FT",
        home: opts.home,
        away: opts.away,
      }),
    ],
  };
  const parsed = espnScoreboardSchema.parse(sb);
  const ev = parsed.events[0];
  if (!ev) throw new Error("no event");
  const comp = ev.competitions[0];
  if (!comp) throw new Error("no competition");
  return comp;
}

describe("mapEspnState", () => {
  it("EM-01: 'pre' → 'scheduled'", () => {
    expect(mapEspnState("pre")).toBe("scheduled");
  });

  it("EM-02: 'in' → 'live'", () => {
    expect(mapEspnState("in")).toBe("live");
  });

  it("EM-03: 'post' → 'finished'", () => {
    expect(mapEspnState("post")).toBe("finished");
  });
});

describe("mapEspnCompetition — status", () => {
  it("EM-04: state 'pre' → status 'scheduled'", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "pre",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(patch.status).toBe("scheduled");
  });

  it("EM-05: state 'in' → status 'live'", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "in",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(patch.status).toBe("live");
  });

  it("EM-06: state 'post' → status 'finished'", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        home: { abbr: "BRA", score: "2" },
        away: { abbr: "ARG", score: "1" },
      }),
    );
    expect(patch.status).toBe("finished");
  });
});

describe("mapEspnCompetition — scores em 'scheduled'", () => {
  it("EM-07: state 'pre' → scores null (ignora score ESPN de pré-jogo)", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "pre",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(patch.homeScore).toBeNull();
    expect(patch.awayScore).toBeNull();
  });
});

describe("mapEspnCompetition — scores em 'live'", () => {
  it("EM-08: state 'in' 1×0 → scores numéricos", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "in",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(patch.homeScore).toBe(1);
    expect(patch.awayScore).toBe(0);
  });

  it("EM-09: state 'in' 0×0 → ambos zero (não null)", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "in",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(patch.homeScore).toBe(0);
    expect(patch.awayScore).toBe(0);
  });
});

describe("mapEspnCompetition — scores em 'finished'", () => {
  it("EM-10: state 'post' 1×1 → scores numéricos", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        home: { abbr: "QAT", score: "1" },
        away: { abbr: "SUI", score: "1" },
      }),
    );
    expect(patch.homeScore).toBe(1);
    expect(patch.awayScore).toBe(1);
  });

  it("EM-11: state 'post' 0×3 → scores numéricos assimétricos", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        home: { abbr: "HAI", score: "0" },
        away: { abbr: "SCO", score: "3" },
      }),
    );
    expect(patch.homeScore).toBe(0);
    expect(patch.awayScore).toBe(3);
  });
});

describe("mapEspnCompetition — extração por homeAway", () => {
  it("EM-12: competitors em ordem [away, home] → extrai por homeAway, não por índice", () => {
    // Constrói competition validada e inverte a ordem dos competitors.
    const comp = competition({
      state: "post",
      home: { abbr: "BRA", score: "2" },
      away: { abbr: "ARG", score: "1" },
    });
    const reversed: EspnCompetition = {
      ...comp,
      competitors: [comp.competitors[1]!, comp.competitors[0]!],
    };
    const patch = mapEspnCompetition(reversed);
    expect(patch.homeScore).toBe(2); // BRA (home) mantém 2 mesmo invertido
    expect(patch.awayScore).toBe(1); // ARG (away) mantém 1
  });
});

describe("mapEspnCompetition — lado homeAway ausente (defensivo)", () => {
  it("EM-19: competição sem competitor 'home' → homeScore null (nunca dado errado)", () => {
    // Schema garante 2 competitors mas não 1 home + 1 away; força ambos 'away'.
    const comp = competition({
      state: "post",
      home: { abbr: "BRA", score: "2" },
      away: { abbr: "ARG", score: "1" },
    });
    const bothAway: EspnCompetition = {
      ...comp,
      competitors: [
        { ...comp.competitors[0]!, homeAway: "away" },
        { ...comp.competitors[1]!, homeAway: "away" },
      ],
    };
    const patch = mapEspnCompetition(bothAway);
    expect(patch.homeScore).toBeNull();
    expect(patch.awayScore).toBe(2); // primeiro 'away' encontrado
  });
});

describe("mapEspnCompetition — detail é ignorado", () => {
  it("EM-13: mesmo state, detail diferente → patches idênticos", () => {
    const a = mapEspnCompetition(
      competition({
        state: "in",
        detail: "31'",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    const b = mapEspnCompetition(
      competition({
        state: "in",
        detail: "HT",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(a).toEqual(b);
  });
});

describe("mapEspnCompetition — integridade com matchSchema", () => {
  /** Compõe o patch num match base completo e valida pelo refine do matchSchema. */
  function buildMatch(patch: {
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  }) {
    return matchSchema.safeParse({
      homeTeamId: "bra",
      awayTeamId: "arg",
      kickoffAt: "2026-06-14T19:00:00Z",
      stage: "grupos",
      groupId: "A",
      status: patch.status,
      homeScore: patch.homeScore,
      awayScore: patch.awayScore,
    });
  }

  it("EM-14: patch 'scheduled' (null/null) passa no refine do matchSchema", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "pre",
        home: { abbr: "BRA", score: "0" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(buildMatch(patch).success).toBe(true);
  });

  it("EM-15: patch 'live' (num/num) passa no refine do matchSchema", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "in",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "ARG", score: "0" },
      }),
    );
    expect(buildMatch(patch).success).toBe(true);
  });

  it("EM-16: patch 'finished' (num/num) passa no refine do matchSchema", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        home: { abbr: "BRA", score: "2" },
        away: { abbr: "ARG", score: "1" },
      }),
    );
    expect(buildMatch(patch).success).toBe(true);
  });
});

describe("mapEspnCompetition — payload real TASK-00", () => {
  it("EM-17: QAT 1×1 SUI (post) → finished 1×1", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        detail: "FT",
        home: { abbr: "QAT", score: "1" },
        away: { abbr: "SUI", score: "1" },
      }),
    );
    expect(patch).toEqual({ status: "finished", homeScore: 1, awayScore: 1 });
  });

  it("EM-18: HAI 0×1 SCO (post) → finished 0×1", () => {
    const patch = mapEspnCompetition(
      competition({
        state: "post",
        detail: "FT",
        home: { abbr: "HAI", score: "0" },
        away: { abbr: "SCO", score: "1", winner: true },
      }),
    );
    expect(patch).toEqual({ status: "finished", homeScore: 0, awayScore: 1 });
  });
});
