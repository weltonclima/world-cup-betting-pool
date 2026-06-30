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
import {
  mapEspnState,
  mapEspnCompetition,
  mapEspnEventToMatch,
  mapEspnEventsToMatches,
  parseBracketSlot,
  mapOutcome,
} from "../espnMapper";
import { matchSchema } from "@/schemas/matches";
import {
  espnEvent,
  espnKnockoutRichEvent,
  espnGroupEvent,
} from "./fixtures/espnFixtures";

/** Parseia um evento cru pelo schema e devolve o EspnEvent validado. */
function parseEvent(raw: unknown) {
  const sb = espnScoreboardSchema.parse({ events: [raw] });
  const ev = sb.events[0];
  if (!ev) throw new Error("no event");
  return ev;
}

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

// ─── TASK-02: parseBracketSlot ───────────────────────────────────────────────

describe("parseBracketSlot", () => {
  it("PBS-01: 'Round of 32 3 Winner' → round-of-32 jogo 3", () => {
    expect(parseBracketSlot("Round of 32 3 Winner")).toEqual({
      round: "round-of-32",
      game: 3,
      label: "Vencedor R32 jogo 3",
    });
  });

  it("PBS-02: 'Round of 16 2 Winner' → round-of-16 jogo 2", () => {
    expect(parseBracketSlot("Round of 16 2 Winner")).toEqual({
      round: "round-of-16",
      game: 2,
      label: "Vencedor R16 jogo 2",
    });
  });

  it("PBS-03: 'Quarterfinal 1 Winner' → quarterfinals jogo 1", () => {
    expect(parseBracketSlot("Quarterfinal 1 Winner")).toEqual({
      round: "quarterfinals",
      game: 1,
      label: "Vencedor QF jogo 1",
    });
  });

  it("PBS-04: 'Semifinal 1 Winner' → semifinals jogo 1 (Vencedor)", () => {
    expect(parseBracketSlot("Semifinal 1 Winner")).toEqual({
      round: "semifinals",
      game: 1,
      label: "Vencedor SF jogo 1",
    });
  });

  it("PBS-05: 'Semifinal 2 Loser' → semifinals jogo 2 (Perdedor)", () => {
    expect(parseBracketSlot("Semifinal 2 Loser")).toEqual({
      round: "semifinals",
      game: 2,
      label: "Perdedor SF jogo 2",
    });
  });

  it("PBS-06: time real ('Brazil') → null", () => {
    expect(parseBracketSlot("Brazil")).toBeNull();
  });

  it("PBS-07: string vazia → null", () => {
    expect(parseBracketSlot("")).toBeNull();
  });

  it("PBS-08: jogo-fonte 0 ('Round of 32 0 Winner') → null (degrada, não lança)", () => {
    expect(parseBracketSlot("Round of 32 0 Winner")).toBeNull();
  });
});

// ─── TASK-02: mapOutcome ─────────────────────────────────────────────────────

describe("mapOutcome", () => {
  it("MO-01: STATUS_FINAL_PEN (post) → 'penalties'", () => {
    expect(mapOutcome("STATUS_FINAL_PEN", "post")).toBe("penalties");
  });

  it("MO-02: STATUS_OVERTIME (post) → 'overtime'", () => {
    expect(mapOutcome("STATUS_OVERTIME", "post")).toBe("overtime");
  });

  it("MO-03: STATUS_FULL_TIME (post) → 'normal'", () => {
    expect(mapOutcome("STATUS_FULL_TIME", "post")).toBe("normal");
  });

  it("MO-04: name ausente (post) → 'normal'", () => {
    expect(mapOutcome(undefined, "post")).toBe("normal");
  });

  it("MO-05: name ausente (pre) → undefined (sem outcome antes do fim)", () => {
    expect(mapOutcome(undefined, "pre")).toBeUndefined();
  });

  it("MO-06: STATUS_FINAL_PEN (in) → undefined (não finalizado)", () => {
    expect(mapOutcome("STATUS_FINAL_PEN", "in")).toBeUndefined();
  });
});

// ─── TASK-02: mapEspnEventToMatch — placeholder / pênaltis / regressão ────────

describe("mapEspnEventToMatch — TASK-02 placeholder de slot (por-lado)", () => {
  it("MEM-01: ambos lados placeholder R32 → slot+label por-lado", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-16",
        home: {
          abbr: "RD32",
          score: "0",
          displayName: "Round of 32 3 Winner",
          isActive: false,
        },
        away: {
          abbr: "RD32",
          score: "0",
          displayName: "Round of 32 4 Winner",
          isActive: false,
        },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.homeBracketSlot).toEqual({ round: "round-of-32", game: 3 });
    expect(match.awayBracketSlot).toEqual({ round: "round-of-32", game: 4 });
    expect(match.homePlaceholderLabel).toBe("Vencedor R32 jogo 3");
    expect(match.awayPlaceholderLabel).toBe("Vencedor R32 jogo 4");
  });

  it("MEM-05: lado resolvido (isActive:true) → sem slot/label naquele lado", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-16",
        home: {
          abbr: "BRA",
          score: "0",
          displayName: "Brazil",
          isActive: true,
        },
        away: {
          abbr: "RD32",
          score: "0",
          displayName: "Round of 32 4 Winner",
          isActive: false,
        },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.homeBracketSlot).toBeUndefined();
    expect(match.homePlaceholderLabel).toBeUndefined();
    expect(match.awayBracketSlot).toEqual({ round: "round-of-32", game: 4 });
    expect(match.awayPlaceholderLabel).toBe("Vencedor R32 jogo 4");
  });

  it("MEM-09: placeholder SEM flag isActive ainda deriva slot (WR-01: gateia por displayName, não por isActive)", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-16",
        // isActive omitido de propósito — ESPN pode não enviar a flag.
        home: { abbr: "RD32", score: "0", displayName: "Round of 16 3 Winner" },
        away: { abbr: "ARG", score: "0", displayName: "Argentina", isActive: true },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.homeBracketSlot).toEqual({ round: "round-of-16", game: 3 });
    expect(match.homePlaceholderLabel).toBe("Vencedor R16 jogo 3");
    expect(match.awayBracketSlot).toBeUndefined();
  });
});

describe("mapEspnEventToMatch — TASK-02 pênaltis (invariante)", () => {
  it("MEM-02: GER 1×1 PAR decidido nos pênaltis → outcome+shootout corretos, score sem pênaltis", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "post",
        detail: "FT (Pens)",
        slug: "round-of-16",
        statusName: "STATUS_FINAL_PEN",
        home: { abbr: "GER", score: "1", shootoutScore: 3 },
        away: { abbr: "PAR", score: "1", shootoutScore: 4, advance: true },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.outcome).toBe("penalties");
    expect(match.homeShootout).toBe(3);
    expect(match.awayShootout).toBe(4);
    expect(match.advanceSide).toBe("away");
    // INVARIANTE: placar de tempo normal NÃO inclui pênaltis.
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(1);
    // mapEspnEventToMatch valida via matchSchema.parse internamente (refine de
    // pênaltis): ter retornado sem lançar já prova a saída válida.
  });

  it("MEM-03: mata-mata decidido no tempo normal → outcome 'normal', sem shootout", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "post",
        detail: "FT",
        slug: "round-of-16",
        statusName: "STATUS_FULL_TIME",
        home: { abbr: "BRA", score: "2", advance: true },
        away: { abbr: "ARG", score: "1" },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.outcome).toBe("normal");
    expect(match.homeShootout ?? null).toBeNull();
    expect(match.awayShootout ?? null).toBeNull();
    expect(match.advanceSide).toBe("home");
  });
});

describe("mapEspnEventToMatch — TASK-02 regressão fase de grupos", () => {
  it("MEM-04: evento de grupo → nenhum campo novo presente", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-14T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "BRA", score: "2" },
        away: { abbr: "MEX", score: "0" },
        group: "A",
      }),
    );
    const match = mapEspnEventToMatch(ev);
    expect(match.homeBracketSlot).toBeUndefined();
    expect(match.awayBracketSlot).toBeUndefined();
    expect(match.homePlaceholderLabel).toBeUndefined();
    expect(match.awayPlaceholderLabel).toBeUndefined();
    expect(match.homeShootout).toBeUndefined();
    expect(match.awayShootout).toBeUndefined();
    expect(match.advanceSide).toBeUndefined();
    expect(match.outcome).toBeUndefined();
  });
});

describe("mapEspnEventToMatch — TASK-02 prorrogação", () => {
  it("MEM-06: mata-mata decidido na prorrogação → outcome 'overtime', sem shootout", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "post",
        detail: "AET",
        slug: "round-of-16",
        statusName: "STATUS_OVERTIME",
        home: { abbr: "FRA", score: "2", advance: true },
        away: { abbr: "POR", score: "1" },
      }),
    );
    const match = mapEspnEventToMatch(ev, 89);
    expect(match.outcome).toBe("overtime");
    expect(match.homeShootout ?? null).toBeNull();
    expect(match.awayShootout ?? null).toBeNull();
    expect(match.advanceSide).toBe("home");
    // Placar de tempo+prorrogação fica em home/awayScore; sem pênaltis.
    expect(match.homeScore).toBe(2);
    expect(match.awayScore).toBe(1);
  });
});

describe("mapEspnEventToMatch — TASK-02 falha ruidosa (invariante de pênaltis)", () => {
  it("MEM-07: outcome pênaltis sem shootoutScore na fonte → lança (ID/dado errado é pior)", () => {
    const ev = parseEvent(
      espnKnockoutRichEvent({
        date: "2026-07-05T19:00Z",
        state: "post",
        detail: "FT (Pens)",
        slug: "round-of-16",
        statusName: "STATUS_FINAL_PEN",
        // Sem shootoutScore em nenhum lado → refine de pênaltis deve barrar.
        home: { abbr: "GER", score: "1" },
        away: { abbr: "PAR", score: "1", advance: true },
      }),
    );
    expect(() => mapEspnEventToMatch(ev, 89)).toThrow();
  });
});

describe("mapEspnEventsToMatches — TASK-02 integração (array misto)", () => {
  it("MEM-08: grupos + mata-mata enriquecido processam sem throw, knockoutNum sequencial", () => {
    const sb = espnScoreboardSchema.parse({
      events: [
        espnGroupEvent({
          date: "2026-06-14T19:00Z",
          state: "post",
          detail: "FT",
          home: { abbr: "BRA", score: "2" },
          away: { abbr: "MEX", score: "0" },
          group: "A",
        }),
        espnKnockoutRichEvent({
          date: "2026-07-04T19:00Z",
          state: "post",
          detail: "FT (Pens)",
          slug: "round-of-32",
          statusName: "STATUS_FINAL_PEN",
          home: { abbr: "GER", score: "1", shootoutScore: 3 },
          away: { abbr: "PAR", score: "1", shootoutScore: 4, advance: true },
        }),
        espnKnockoutRichEvent({
          date: "2026-07-05T19:00Z",
          state: "pre",
          detail: "Scheduled",
          slug: "round-of-16",
          home: {
            abbr: "RD32",
            score: "0",
            displayName: "Round of 32 3 Winner",
            isActive: false,
          },
          away: {
            abbr: "RD32",
            score: "0",
            displayName: "Round of 32 4 Winner",
            isActive: false,
          },
        }),
      ],
    });
    const matches = mapEspnEventsToMatches(sb.events);
    expect(matches).toHaveLength(3);

    // Mata-mata recebe knockoutNum sequencial em ordem de data (73, 74, …).
    const ko = matches.filter((m) => m.id.startsWith("m"));
    expect(ko.map((m) => m.id)).toEqual(["m73", "m74"]);

    // Jogo de pênaltis carrega desempate + advance; placar de tempo normal intacto.
    const pens = matches.find((m) => m.outcome === "penalties");
    expect(pens?.homeShootout).toBe(3);
    expect(pens?.awayShootout).toBe(4);
    expect(pens?.advanceSide).toBe("away");
    expect(pens?.homeScore).toBe(1);
    expect(pens?.awayScore).toBe(1);

    // Jogo agendado com ambos placeholders carrega slot/label por-lado.
    const placeholder = matches.find((m) => m.homeBracketSlot !== undefined);
    expect(placeholder?.homePlaceholderLabel).toBe("Vencedor R32 jogo 3");
    expect(placeholder?.awayPlaceholderLabel).toBe("Vencedor R32 jogo 4");
  });
});
