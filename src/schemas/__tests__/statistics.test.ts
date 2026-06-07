import { describe, expect, expectTypeOf, it } from "vitest";

import {
  positionHistoryEntrySchema,
  statisticsSchema,
} from "@/schemas/statistics";
import type { PositionHistoryEntry, Statistics } from "@/types/statistics";

const validHistory = {
  at: "2026-06-05T12:00:00Z",
  scope: "geral",
  position: 3,
} as const;

const valid = {
  uid: "abc123",
  totalCorrect: 12,
  accuracy: 75,
  longestStreak: 4,
  correctByStage: { grupos: 8, oitavas: 4 },
  positionHistory: [validHistory],
} as const;

describe("statistics", () => {
  it("faz parse de estatística válida", () => {
    expect(statisticsSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita correctByStage parcial", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, correctByStage: { grupos: 8 } })
        .success,
    ).toBe(true);
  });

  it("aceita correctByStage vazio", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, correctByStage: {} }).success,
    ).toBe(true);
  });

  it("rejeita accuracy > 100", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, accuracy: 101 }).success,
    ).toBe(false);
  });

  it("rejeita accuracy < 0", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, accuracy: -1 }).success,
    ).toBe(false);
  });

  it("rejeita totalCorrect negativo", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, totalCorrect: -1 }).success,
    ).toBe(false);
  });

  it("rejeita chave inválida em correctByStage", () => {
    expect(
      statisticsSchema.safeParse({
        ...valid,
        correctByStage: { geral: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejeita position < 1 no histórico", () => {
    expect(
      positionHistoryEntrySchema.safeParse({ ...validHistory, position: 0 })
        .success,
    ).toBe(false);
  });

  it("rejeita scope inválido no histórico", () => {
    expect(
      positionHistoryEntrySchema.safeParse({
        ...validHistory,
        scope: "repescagem",
      }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Statistics["accuracy"]>().toEqualTypeOf<number>();
    expectTypeOf<PositionHistoryEntry["scope"]>().toEqualTypeOf<
      "geral" | "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
  });
});
