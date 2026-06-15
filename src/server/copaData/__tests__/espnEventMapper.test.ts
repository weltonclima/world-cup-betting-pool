/**
 * Testes do mapper completo ESPN event → MatchWithId (TASK-03).
 * EM-01..EM-20
 *
 * `mapEspnEventToMatch(event, knockoutNum?)` converte um `EspnEvent` validado num
 * `MatchWithId` completo (todos os campos do `matchSchema`), distinto do patch
 * parcial de `mapEspnCompetition` (TASK-04, testado em espnMapper.test.ts).
 * `mapEspnEventsToMatches(events)` processa o schedule inteiro atribuindo
 * `knockoutNum` sequencial (73, 74, …) por data ASC.
 *
 * Fixtures construídos pelos helpers passam por `espnEventSchema.parse` antes de
 * mapear (espelha o pipeline real: parse → map). IDs são verificados contra
 * `buildEspnMatchId` (TASK-02) — não reimplementamos a fórmula do slug aqui.
 *
 * `noUncheckedIndexedAccess` ligado: acesso por índice usa o helper `req`.
 */

import { describe, it, expect } from "vitest";
import {
  mapEspnEventToMatch,
  mapEspnEventsToMatches,
} from "../espnMapper";
import { buildEspnMatchId } from "../espnMatchId";
import { espnEventSchema, type EspnEvent } from "../espnTypes";
import { matchSchema } from "@/schemas/matches";
import { espnGroupEvent, espnKnockoutEvent } from "./fixtures/espnFixtures";
import groupRaw from "../__fixtures__/espn-event-group.json";
import koRaw from "../__fixtures__/espn-event-knockout.json";

/** Parse pelo schema TASK-01 — espelha o pipeline real e valida o fixture. */
function parseEvent(raw: unknown): EspnEvent {
  return espnEventSchema.parse(raw);
}

/** Acesso por índice com narrowing (noUncheckedIndexedAccess). */
function req<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of range`);
  return v;
}

describe("mapEspnEventToMatch (grupos)", () => {
  it("EM-01: grupo completo → id (buildEspnMatchId), stage, groupId, kickoffAt, times", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "MEX", score: "2", winner: true },
        away: { abbr: "RSA", score: "0" },
        group: "A",
      }),
    );
    const m = mapEspnEventToMatch(ev);

    expect(m.id).toBe(buildEspnMatchId(ev));
    expect(m.stage).toBe("grupos");
    expect(m.groupId).toBe("A");
    expect(m.kickoffAt).toBe("2026-06-11T19:00Z");
    expect(m.homeTeamId).toBe("MEX");
    expect(m.awayTeamId).toBe("RSA");
  });

  it("EM-02: grupo state=post → status=finished, placares numéricos", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "MEX", score: "2", winner: true },
        away: { abbr: "RSA", score: "0" },
      }),
    );
    const m = mapEspnEventToMatch(ev);
    expect(m.status).toBe("finished");
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(0);
  });

  it("EM-03: grupo state=pre → status=scheduled, placares null", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "pre",
        detail: "Scheduled",
        home: { abbr: "MEX", score: "0" },
        away: { abbr: "RSA", score: "0" },
      }),
    );
    const m = mapEspnEventToMatch(ev);
    expect(m.status).toBe("scheduled");
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
  });

  it("EM-04: grupo state=in → status=live, placares numéricos", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "in",
        detail: "31'",
        home: { abbr: "MEX", score: "1" },
        away: { abbr: "RSA", score: "0" },
      }),
    );
    const m = mapEspnEventToMatch(ev);
    expect(m.status).toBe("live");
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(0);
  });

  it("EM-05: venue com vírgula → name e city (split antes da vírgula)", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "pre",
        detail: "Scheduled",
        home: { abbr: "MEX", score: "0" },
        away: { abbr: "RSA", score: "0" },
        venue: { fullName: "SoFi Stadium", city: "Inglewood, California" },
      }),
    );
    const m = mapEspnEventToMatch(ev);
    expect(m.venue).toEqual({ name: "SoFi Stadium", city: "Inglewood" });
  });

  it("EM-07: saída de grupo válida passa matchSchema.parse", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "MEX", score: "2", winner: true },
        away: { abbr: "RSA", score: "0" },
      }),
    );
    const m = mapEspnEventToMatch(ev);
    const { id: _id, ...rest } = m;
    expect(() => matchSchema.parse(rest)).not.toThrow();
  });
});

describe("mapEspnEventToMatch (mata-mata)", () => {
  it("EM-06: evento sem venue → venue=null", () => {
    const ev = parseEvent(
      espnKnockoutEvent({
        date: "2026-06-28T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-32",
        venue: null,
      }),
    );
    const m = mapEspnEventToMatch(ev, 73);
    expect(m.venue).toBeNull();
  });

  it("EM-08: mata-mata knockoutNum=73 → id='m73', groupId=null, round=null", () => {
    const ev = parseEvent(
      espnKnockoutEvent({
        date: "2026-06-28T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-32",
      }),
    );
    const m = mapEspnEventToMatch(ev, 73);
    expect(m.id).toBe("m73");
    expect(m.groupId ?? null).toBeNull();
    expect(m.round ?? null).toBeNull();
  });

  it("EM-09: slug round-of-32 → stage=dezesseis-avos", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-06-28T19:00Z", state: "pre", detail: "s", slug: "round-of-32" }),
    );
    expect(mapEspnEventToMatch(ev, 73).stage).toBe("dezesseis-avos");
  });

  it("EM-10: slug round-of-16 → stage=oitavas", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-07-04T19:00Z", state: "pre", detail: "s", slug: "round-of-16" }),
    );
    expect(mapEspnEventToMatch(ev, 89).stage).toBe("oitavas");
  });

  it("EM-11: slug quarterfinals → stage=quartas", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-07-09T19:00Z", state: "pre", detail: "s", slug: "quarterfinals" }),
    );
    expect(mapEspnEventToMatch(ev, 97).stage).toBe("quartas");
  });

  it("EM-12: slug semifinals → stage=semifinal", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-07-14T19:00Z", state: "pre", detail: "s", slug: "semifinals" }),
    );
    expect(mapEspnEventToMatch(ev, 101).stage).toBe("semifinal");
  });

  it("EM-13: slug 3rd-place-match → stage=terceiro", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-07-18T19:00Z", state: "pre", detail: "s", slug: "3rd-place-match" }),
    );
    expect(mapEspnEventToMatch(ev, 103).stage).toBe("terceiro");
  });

  it("EM-14: slug final → stage=final", () => {
    const ev = parseEvent(
      espnKnockoutEvent({ date: "2026-07-19T19:00Z", state: "pre", detail: "s", slug: "final" }),
    );
    expect(mapEspnEventToMatch(ev, 104).stage).toBe("final");
  });

  it("EM-15: time não resolúvel em mata-mata → teamId = abbr literal (sem throw)", () => {
    const ev = parseEvent(
      espnKnockoutEvent({
        date: "2026-06-28T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-32",
        home: { abbr: "2A", score: "0" },
        away: { abbr: "2B", score: "0" },
      }),
    );
    const m = mapEspnEventToMatch(ev, 73);
    expect(m.homeTeamId).toBe("2A");
    expect(m.awayTeamId).toBe("2B");
  });
});

describe("mapEspnEventToMatch (erros)", () => {
  it("EM-16: time desconhecido em jogo de grupo → lança Error", () => {
    const ev = parseEvent(
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "pre",
        detail: "Scheduled",
        home: { abbr: "XXX", score: "0" },
        away: { abbr: "YYY", score: "0" },
      }),
    );
    // Mensagem específica: distingue do TypeError "não é função" (RED real).
    expect(() => mapEspnEventToMatch(ev)).toThrow(/time desconhecido/i);
  });

  it("EM-17: season.slug desconhecido → lança Error", () => {
    const ev = parseEvent(
      espnKnockoutEvent({
        date: "2026-06-28T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "weird-stage",
      }),
    );
    // Mensagem específica menciona o slug/stage indeterminado (RED real).
    expect(() => mapEspnEventToMatch(ev, 73)).toThrow(/slug|stage/i);
  });
});

describe("mapEspnEventsToMatches (batch)", () => {
  it("EM-18: [grupo, grupo, ko] → KO recebe knockoutNum=73, array de 3", () => {
    const events = [
      espnGroupEvent({
        date: "2026-06-11T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "MEX", score: "2", winner: true },
        away: { abbr: "RSA", score: "0" },
        group: "A",
      }),
      espnGroupEvent({
        date: "2026-06-12T19:00Z",
        state: "post",
        detail: "FT",
        home: { abbr: "BRA", score: "1" },
        away: { abbr: "MAR", score: "1" },
        group: "C",
      }),
      espnKnockoutEvent({
        date: "2026-06-28T19:00Z",
        state: "pre",
        detail: "Scheduled",
        slug: "round-of-32",
      }),
    ].map(parseEvent);

    const matches = mapEspnEventsToMatches(events);
    expect(matches).toHaveLength(3);

    const ko = matches.filter((m) => m.stage === "dezesseis-avos");
    expect(ko).toHaveLength(1);
    expect(req(ko, 0).id).toBe("m73");
  });

  it("EM-19: ordena KOs por data antes de atribuir números (73, 74)", () => {
    // Array fora de ordem: o jogo mais tardio aparece primeiro.
    const later = espnKnockoutEvent({
      date: "2026-06-29T19:00Z",
      state: "pre",
      detail: "Scheduled",
      slug: "round-of-32",
      home: { abbr: "1C", score: "0" },
      away: { abbr: "1D", score: "0" },
    });
    const earlier = espnKnockoutEvent({
      date: "2026-06-28T19:00Z",
      state: "pre",
      detail: "Scheduled",
      slug: "round-of-32",
      home: { abbr: "2A", score: "0" },
      away: { abbr: "2B", score: "0" },
    });
    const matches = mapEspnEventsToMatches([later, earlier].map(parseEvent));

    expect(matches).toHaveLength(2);
    const first = req(matches, 0);
    const second = req(matches, 1);
    // KO mais cedo → m73; mais tarde → m74.
    expect(first.id).toBe("m73");
    expect(first.kickoffAt).toBe("2026-06-28T19:00Z");
    expect(first.homeTeamId).toBe("2A");
    expect(second.id).toBe("m74");
    expect(second.kickoffAt).toBe("2026-06-29T19:00Z");
    expect(second.homeTeamId).toBe("1C");
  });
});

describe("mapEspnEventToMatch (fixtures reais do spike)", () => {
  it("EM-20a: evento real de grupo → MatchWithId completo e válido", () => {
    const ev = parseEvent(groupRaw);
    const m = mapEspnEventToMatch(ev);

    expect(m.id).toBe(buildEspnMatchId(ev));
    expect(m.stage).toBe("grupos");
    expect(m.groupId).toBe("A");
    expect(m.kickoffAt).toBe("2026-06-11T19:00Z");
    expect(m.homeTeamId).toBe("MEX");
    expect(m.awayTeamId).toBe("RSA");
    expect(m.status).toBe("finished");
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(0);
    expect(m.venue).toEqual({ name: "Estadio Banorte", city: "Mexico City" });

    const { id: _id, ...rest } = m;
    expect(() => matchSchema.parse(rest)).not.toThrow();
  });

  it("EM-20b: evento real de mata-mata → MatchWithId completo e válido", () => {
    const ev = parseEvent(koRaw);
    const m = mapEspnEventToMatch(ev, 73);

    expect(m.id).toBe("m73");
    expect(m.stage).toBe("dezesseis-avos");
    expect(m.groupId ?? null).toBeNull();
    expect(m.kickoffAt).toBe("2026-06-28T19:00Z");
    expect(m.homeTeamId).toBe("2A");
    expect(m.awayTeamId).toBe("2B");
    expect(m.status).toBe("scheduled");
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
    expect(m.venue).toEqual({ name: "SoFi Stadium", city: "Inglewood" });

    const { id: _id, ...rest } = m;
    expect(() => matchSchema.parse(rest)).not.toThrow();
  });
});
