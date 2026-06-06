import { describe, expect, expectTypeOf, it } from "vitest";

import { matchSchema } from "@/schemas/matches";
import type { Match } from "@/types/matches";

const scheduled = {
  homeTeamId: "bra",
  awayTeamId: "arg",
  kickoffAt: "2026-06-11T20:00:00Z",
  stage: "grupos",
  groupId: "A",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
} as const;

const finished = {
  homeTeamId: "bra",
  awayTeamId: "arg",
  kickoffAt: "2026-06-11T20:00:00Z",
  stage: "grupos",
  groupId: "A",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
} as const;

describe("matches", () => {
  it("faz parse de partida agendada (placares null)", () => {
    expect(matchSchema.safeParse(scheduled).success).toBe(true);
  });

  it("faz parse de partida finalizada (placares inteiros ≥ 0)", () => {
    expect(matchSchema.safeParse(finished).success).toBe(true);
  });

  it("aceita groupId null no mata-mata", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        stage: "final",
        groupId: null,
      }).success,
    ).toBe(true);
  });

  it("rejeita stage fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, stage: "terceiro_lugar" }).success,
    ).toBe(false);
  });

  it("rejeita status fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, status: "paused" }).success,
    ).toBe(false);
  });

  it("rejeita kickoffAt não-ISO", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, kickoffAt: "ontem" }).success,
    ).toBe(false);
  });

  it("rejeita placar negativo quando finalizado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: -1 }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro quando finalizado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: 1.5 }).success,
    ).toBe(false);
  });

  it("refinement: finished com homeScore null é rejeitado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: null }).success,
    ).toBe(false);
  });

  it("refinement: finished sem ambos os placares é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...finished,
        homeScore: null,
        awayScore: null,
      }).success,
    ).toBe(false);
  });

  it("refinement: scheduled com placar preenchido é rejeitado", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, homeScore: 2, awayScore: 0 })
        .success,
    ).toBe(false);
  });

  it("refinement: live com ambos os placares preenchidos é válido (placar parcial real)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(true);
  });

  it("refinement: live com ambos null é válido (início do tempo)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: null,
        awayScore: null,
      }).success,
    ).toBe(true);
  });

  it("refinement: live com placar assimétrico é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: 1,
        awayScore: null,
      }).success,
    ).toBe(false);
  });

  it("refinement: postponed com placares preenchidos é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "postponed",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  it("refinement: canceled com placares preenchidos é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "canceled",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Match["stage"]>().toEqualTypeOf<
      "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
    expectTypeOf<Match["homeScore"]>().toEqualTypeOf<number | null>();
  });
});
