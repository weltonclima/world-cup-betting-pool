/**
 * TASK-20 — schemas de classificação de liga (`leagueStandingSchema`,
 * `leagueStandingsResponseSchema`).
 *
 * Defesa em profundidade: o cliente revalida a resposta da API. Cobre parse
 * válido, `.strict()` (rejeita chave extra), crestUrl não-URL, goalDifference
 * negativo aceito, e contadores negativos rejeitados.
 */

import { describe, expect, it } from "vitest";

import {
  leagueStandingSchema,
  leagueStandingsResponseSchema,
} from "@/schemas/leagues";

const VALID_ROW = {
  position: 1,
  team: { id: "83", name: "Flamengo", crestUrl: "https://espn/fla.png" },
  played: 1,
  wins: 1,
  draws: 0,
  losses: 0,
  goalsFor: 2,
  goalsAgainst: 1,
  goalDifference: 1,
  points: 3,
};

describe("leagueStandingSchema", () => {
  it("aceita linha válida completa", () => {
    expect(leagueStandingSchema.parse(VALID_ROW)).toEqual(VALID_ROW);
  });

  it("crestUrl é opcional (time sem escudo)", () => {
    const row = { ...VALID_ROW, team: { id: "83", name: "Flamengo" } };
    expect(leagueStandingSchema.parse(row)).toEqual(row);
  });

  it("goalDifference negativo é aceito", () => {
    const row = { ...VALID_ROW, goalDifference: -3, goalsFor: 1, goalsAgainst: 4 };
    expect(() => leagueStandingSchema.parse(row)).not.toThrow();
  });

  it("rejeita crestUrl que não é URL", () => {
    const row = { ...VALID_ROW, team: { ...VALID_ROW.team, crestUrl: "nao-e-url" } };
    expect(leagueStandingSchema.safeParse(row).success).toBe(false);
  });

  it("rejeita position < 1", () => {
    expect(leagueStandingSchema.safeParse({ ...VALID_ROW, position: 0 }).success).toBe(false);
  });

  it("rejeita contador negativo (points)", () => {
    expect(leagueStandingSchema.safeParse({ ...VALID_ROW, points: -1 }).success).toBe(false);
  });

  it(".strict() rejeita chave extra na linha", () => {
    expect(
      leagueStandingSchema.safeParse({ ...VALID_ROW, extra: true }).success,
    ).toBe(false);
  });

  it(".strict() rejeita chave extra no team", () => {
    const row = { ...VALID_ROW, team: { ...VALID_ROW.team, fifaCode: "BRA" } };
    expect(leagueStandingSchema.safeParse(row).success).toBe(false);
  });

  it("rejeita name vazio (nonEmptyString)", () => {
    const row = { ...VALID_ROW, team: { ...VALID_ROW.team, name: "" } };
    expect(leagueStandingSchema.safeParse(row).success).toBe(false);
  });
});

describe("leagueStandingsResponseSchema", () => {
  it("aceita resposta válida com tabela e hasLiveMatch", () => {
    const res = { table: [VALID_ROW], hasLiveMatch: false };
    expect(leagueStandingsResponseSchema.parse(res)).toEqual(res);
  });

  it("aceita tabela vazia", () => {
    expect(
      leagueStandingsResponseSchema.parse({ table: [], hasLiveMatch: true }),
    ).toEqual({ table: [], hasLiveMatch: true });
  });

  it("rejeita quando falta hasLiveMatch", () => {
    expect(leagueStandingsResponseSchema.safeParse({ table: [] }).success).toBe(false);
  });

  it(".strict() rejeita chave extra na resposta", () => {
    expect(
      leagueStandingsResponseSchema.safeParse({
        table: [],
        hasLiveMatch: false,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});
