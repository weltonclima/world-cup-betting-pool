/**
 * Testes TDD do mapper openfootball → matchSchema.
 * MAP-01..MAP-46
 *
 * Importa diretamente de ../mapper (não do barrel ../index),
 * pois o barrel inclui `import "server-only"` que lança fora de RSC (vitest).
 */

import { describe, it, expect } from "vitest";
import {
  mapRoundToStage,
  parseKickoffAt,
  buildMatchId,
  resolveTeamId,
  mapStatus,
  mapOpenFootballMatch,
} from "../mapper";
import {
  groupMatchBasic,
  groupMatchFinished,
  groupMatchNoTime,
  knockoutMatchRound32,
  knockoutMatchThirdPlace,
  knockoutMatchFinal,
  knockoutMatch1E,
} from "./fixtures/openfootballFixtures";
import { matchSchema } from "@/schemas/matches";

// ─── MAP-01..MAP-09: mapRoundToStage ─────────────────────────────────────────

describe("mapRoundToStage", () => {
  it("MAP-01: Matchday 1 → grupos", () => {
    expect(mapRoundToStage("Matchday 1")).toBe("grupos");
  });

  it("MAP-02: Matchday 17 → grupos", () => {
    expect(mapRoundToStage("Matchday 17")).toBe("grupos");
  });

  it("MAP-03: Round of 32 → dezesseis-avos", () => {
    expect(mapRoundToStage("Round of 32")).toBe("dezesseis-avos");
  });

  it("MAP-04: Round of 16 → oitavas", () => {
    expect(mapRoundToStage("Round of 16")).toBe("oitavas");
  });

  it("MAP-05: Quarter-final → quartas", () => {
    expect(mapRoundToStage("Quarter-final")).toBe("quartas");
  });

  it("MAP-06: Semi-final → semifinal", () => {
    expect(mapRoundToStage("Semi-final")).toBe("semifinal");
  });

  it("MAP-07: Match for third place → terceiro", () => {
    expect(mapRoundToStage("Match for third place")).toBe("terceiro");
  });

  it("MAP-08: Final → final", () => {
    expect(mapRoundToStage("Final")).toBe("final");
  });

  it("MAP-09: round não reconhecido lança Error", () => {
    expect(() => mapRoundToStage("Unknown Round")).toThrow(Error);
  });
});

// ─── MAP-10..MAP-14: parseKickoffAt ──────────────────────────────────────────

describe("parseKickoffAt", () => {
  it("MAP-10: 2026-06-11, 13:00 UTC-6 → 2026-06-11T13:00:00-06:00", () => {
    expect(parseKickoffAt("2026-06-11", "13:00 UTC-6")).toBe("2026-06-11T13:00:00-06:00");
  });

  it("MAP-11: 2026-07-19, 16:00 UTC-4 → 2026-07-19T16:00:00-04:00", () => {
    expect(parseKickoffAt("2026-07-19", "16:00 UTC-4")).toBe("2026-07-19T16:00:00-04:00");
  });

  it("MAP-12: 2026-06-11, 18:00 UTC+1 → 2026-06-11T18:00:00+01:00", () => {
    expect(parseKickoffAt("2026-06-11", "18:00 UTC+1")).toBe("2026-06-11T18:00:00+01:00");
  });

  it("MAP-13: time undefined → 2026-06-20T00:00:00+00:00", () => {
    expect(parseKickoffAt("2026-06-20", undefined)).toBe("2026-06-20T00:00:00+00:00");
  });

  it("MAP-14: formato inválido lança Error", () => {
    expect(() => parseKickoffAt("2026-06-11", "horário inválido")).toThrow(Error);
  });
});

// ─── MAP-15..MAP-18: buildMatchId ────────────────────────────────────────────

describe("buildMatchId", () => {
  it("MAP-15: num=73 → m73", () => {
    expect(buildMatchId({ ...knockoutMatchRound32, num: 73 })).toBe("m73");
  });

  it("MAP-16: num=104 → m104", () => {
    expect(buildMatchId({ ...knockoutMatchFinal, num: 104 })).toBe("m104");
  });

  it("MAP-17: grupo Mexico × South Africa 2026-06-11 → 2026-06-11-mexico-south-africa", () => {
    expect(buildMatchId(groupMatchBasic)).toBe("2026-06-11-mexico-south-africa");
  });

  it("MAP-18: grupo Brazil × Egypt 2026-06-20 → 2026-06-20-brazil-egypt", () => {
    expect(buildMatchId(groupMatchNoTime)).toBe("2026-06-20-brazil-egypt");
  });
});

// ─── MAP-19..MAP-25: resolveTeamId ───────────────────────────────────────────

describe("resolveTeamId", () => {
  it("MAP-19: Mexico → MEX", () => {
    expect(resolveTeamId("Mexico")).toBe("MEX");
  });

  it("MAP-20: Brazil → BRA", () => {
    expect(resolveTeamId("Brazil")).toBe("BRA");
  });

  it("MAP-21: 2A → 2A (placeholder preservado)", () => {
    expect(resolveTeamId("2A")).toBe("2A");
  });

  it("MAP-22: W74 → W74 (placeholder preservado)", () => {
    expect(resolveTeamId("W74")).toBe("W74");
  });

  it("MAP-23: L101 → L101 (placeholder preservado)", () => {
    expect(resolveTeamId("L101")).toBe("L101");
  });

  it("MAP-24: 1E → 1E (placeholder preservado)", () => {
    expect(resolveTeamId("1E")).toBe("1E");
  });

  it("MAP-25: nome desconhecido lança Error", () => {
    expect(() => resolveTeamId("Time Desconhecido")).toThrow(Error);
  });
});

// ─── MAP-26..MAP-46: mapOpenFootballMatch ────────────────────────────────────

describe("mapOpenFootballMatch — jogo de grupo básico (groupMatchBasic)", () => {
  it("MAP-26: retorna MatchWithId válido por matchSchema", () => {
    expect(() => mapOpenFootballMatch(groupMatchBasic)).not.toThrow();
    const result = mapOpenFootballMatch(groupMatchBasic);
    expect(result).toHaveProperty("id");
    // Stripa o `id` antes de parsear pois matchSchema é strict (id não é campo do schema).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...doc } = result;
    expect(() => matchSchema.parse(doc)).not.toThrow();
  });

  it("MAP-27: stage === grupos", () => {
    expect(mapOpenFootballMatch(groupMatchBasic).stage).toBe("grupos");
  });

  it("MAP-28: groupId === A", () => {
    expect(mapOpenFootballMatch(groupMatchBasic).groupId).toBe("A");
  });

  it("MAP-29: round === 1", () => {
    expect(mapOpenFootballMatch(groupMatchBasic).round).toBe(1);
  });

  it("MAP-30: status === scheduled", () => {
    expect(mapOpenFootballMatch(groupMatchBasic).status).toBe("scheduled");
  });

  it("MAP-31: homeScore === null", () => {
    expect(mapOpenFootballMatch(groupMatchBasic).homeScore).toBeNull();
  });
});

describe("mapOpenFootballMatch — jogo finalizado (groupMatchFinished)", () => {
  it("MAP-32: status === finished", () => {
    expect(mapOpenFootballMatch(groupMatchFinished).status).toBe("finished");
  });

  it("MAP-33: homeScore === 2", () => {
    expect(mapOpenFootballMatch(groupMatchFinished).homeScore).toBe(2);
  });

  it("MAP-34: awayScore === 1", () => {
    expect(mapOpenFootballMatch(groupMatchFinished).awayScore).toBe(1);
  });

  it("MAP-35: id contém slug com data+times", () => {
    const result = mapOpenFootballMatch(groupMatchFinished);
    expect(result.id).toMatch(/^2026-06-15-/);
  });
});

describe("mapOpenFootballMatch — mata-mata Round of 32 (knockoutMatchRound32)", () => {
  it("MAP-36: id === m73", () => {
    expect(mapOpenFootballMatch(knockoutMatchRound32).id).toBe("m73");
  });

  it("MAP-37: stage === dezesseis-avos", () => {
    expect(mapOpenFootballMatch(knockoutMatchRound32).stage).toBe("dezesseis-avos");
  });

  it("MAP-38: homeTeamId === 2A", () => {
    expect(mapOpenFootballMatch(knockoutMatchRound32).homeTeamId).toBe("2A");
  });

  it("MAP-39: awayTeamId === 2B", () => {
    expect(mapOpenFootballMatch(knockoutMatchRound32).awayTeamId).toBe("2B");
  });

  it("MAP-40: groupId === null", () => {
    expect(mapOpenFootballMatch(knockoutMatchRound32).groupId).toBeNull();
  });
});

describe("mapOpenFootballMatch — fases finais do torneio", () => {
  it("MAP-41: Final → stage === final", () => {
    expect(mapOpenFootballMatch(knockoutMatchFinal).stage).toBe("final");
  });

  it("MAP-42: Match for third place → stage === terceiro", () => {
    expect(mapOpenFootballMatch(knockoutMatchThirdPlace).stage).toBe("terceiro");
  });

  it("MAP-43: knockoutMatch1E → homeTeamId === 1E", () => {
    expect(mapOpenFootballMatch(knockoutMatch1E).homeTeamId).toBe("1E");
  });
});

describe("mapOpenFootballMatch — caso sem horário (groupMatchNoTime)", () => {
  it("MAP-44: kickoffAt === 2026-06-20T00:00:00+00:00", () => {
    expect(mapOpenFootballMatch(groupMatchNoTime).kickoffAt).toBe("2026-06-20T00:00:00+00:00");
  });
});

describe("mapOpenFootballMatch — validação matchSchema", () => {
  it("MAP-45: output para jogo de grupo passa em matchSchema.parse()", () => {
    const result = mapOpenFootballMatch(groupMatchBasic);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...doc } = result;
    expect(() => matchSchema.parse(doc)).not.toThrow();
  });

  it("MAP-46: output para mata-mata passa em matchSchema.parse()", () => {
    const result = mapOpenFootballMatch(knockoutMatchRound32);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...doc } = result;
    expect(() => matchSchema.parse(doc)).not.toThrow();
  });
});

// ─── mapStatus (testes adicionais de unidade) ─────────────────────────────────

describe("mapStatus", () => {
  it("sem score → scheduled", () => {
    expect(mapStatus(undefined)).toBe("scheduled");
  });

  it("score sem ft → scheduled", () => {
    expect(mapStatus({ ht: [1, 0] })).toBe("scheduled");
  });

  it("score com ft → finished", () => {
    expect(mapStatus({ ft: [2, 1], ht: [1, 0] })).toBe("finished");
  });
});
