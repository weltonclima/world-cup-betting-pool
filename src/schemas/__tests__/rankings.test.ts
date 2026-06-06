import { describe, expect, expectTypeOf, it } from "vitest";

import { rankingEntrySchema, rankingSchema } from "@/schemas/rankings";
import type { Ranking, RankingEntry } from "@/types/rankings";

const validEntry = {
  uid: "abc123",
  nickname: "Joãozinho",
  position: 1,
  points: 10,
} as const;

const valid = {
  scope: "geral",
  updatedAt: "2026-06-05T12:00:00Z",
  entries: [validEntry],
} as const;

describe("rankings", () => {
  it("faz parse de ranking válido", () => {
    expect(rankingSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita entries vazio", () => {
    expect(rankingSchema.safeParse({ ...valid, entries: [] }).success).toBe(
      true,
    );
  });

  it("rejeita scope fora do enum", () => {
    expect(
      rankingSchema.safeParse({ ...valid, scope: "repescagem" }).success,
    ).toBe(false);
  });

  it("rejeita updatedAt não-ISO", () => {
    expect(
      rankingSchema.safeParse({ ...valid, updatedAt: "hoje" }).success,
    ).toBe(false);
  });

  it("rejeita position < 1 na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...validEntry, position: 0 }).success,
    ).toBe(false);
  });

  it("rejeita points negativo na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...validEntry, points: -1 }).success,
    ).toBe(false);
  });

  it("rejeita points não inteiro na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...validEntry, points: 1.5 }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict) na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...validEntry, extra: 1 }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict) no ranking", () => {
    expect(rankingSchema.safeParse({ ...valid, extra: 1 }).success).toBe(
      false,
    );
  });

  it("inferência de tipo", () => {
    expectTypeOf<Ranking["scope"]>().toEqualTypeOf<
      "geral" | "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
    expectTypeOf<RankingEntry["position"]>().toEqualTypeOf<number>();
    expectTypeOf<Ranking["entries"]>().toEqualTypeOf<RankingEntry[]>();
  });
});
