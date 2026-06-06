import { describe, expect, expectTypeOf, it } from "vitest";

import { predictionSchema } from "@/schemas/predictions";
import type { Prediction } from "@/types/predictions";

const valid = {
  uid: "abc123",
  matchId: "match-1",
  homeScore: 2,
  awayScore: 1,
} as const;

describe("predictions", () => {
  it("faz parse de palpite válido", () => {
    expect(predictionSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita placar 0 a 0", () => {
    expect(
      predictionSchema.safeParse({ ...valid, homeScore: 0, awayScore: 0 })
        .success,
    ).toBe(true);
  });

  it("rejeita placar negativo", () => {
    expect(
      predictionSchema.safeParse({ ...valid, homeScore: -1 }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro", () => {
    expect(
      predictionSchema.safeParse({ ...valid, awayScore: 1.5 }).success,
    ).toBe(false);
  });

  it("rejeita uid vazio", () => {
    expect(predictionSchema.safeParse({ ...valid, uid: "" }).success).toBe(
      false,
    );
  });

  it("rejeita matchId ausente", () => {
    const { matchId: _matchId, ...sem } = valid;
    void _matchId;
    expect(predictionSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Prediction["homeScore"]>().toEqualTypeOf<number>();
    expectTypeOf<Prediction["uid"]>().toEqualTypeOf<string>();
  });
});
