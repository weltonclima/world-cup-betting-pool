import { describe, expect, expectTypeOf, it } from "vitest";

import { bonusPredictionSchema } from "@/schemas/bonusPredictions";
import type { BonusPrediction } from "@/types/bonusPredictions";

const valid = {
  uid: "abc123",
  championTeamId: "bra",
  topScorerName: "Neymar",
} as const;

describe("bonus_predictions", () => {
  it("faz parse de palpite bônus completo", () => {
    expect(bonusPredictionSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita palpite parcial (só uid)", () => {
    expect(bonusPredictionSchema.safeParse({ uid: "abc123" }).success).toBe(
      true,
    );
  });

  it("rejeita uid vazio", () => {
    expect(
      bonusPredictionSchema.safeParse({ ...valid, uid: "" }).success,
    ).toBe(false);
  });

  it("rejeita uid ausente", () => {
    const { uid: _uid, ...sem } = valid;
    void _uid;
    expect(bonusPredictionSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      bonusPredictionSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<BonusPrediction["uid"]>().toEqualTypeOf<string>();
    expectTypeOf<
      BonusPrediction["championTeamId"]
    >().toEqualTypeOf<string | undefined>();
  });
});
