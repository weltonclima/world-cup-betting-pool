import { describe, expect, expectTypeOf, it } from "vitest";

import {
  distributionBucketSchema,
  poolStatsSchema,
  positionHistoryEntrySchema,
  statisticsSchema,
} from "@/schemas/statistics";
import type {
  DistributionBucket,
  PoolStats,
  PositionHistoryEntry,
  Statistics,
} from "@/types/statistics";

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

const validBucket = {
  label: "90-100 pts",
  min: 90,
  max: 100,
  count: 3,
} as const;

const validPoolStats = {
  updatedAt: "2026-06-05T12:00:00Z",
  totalParticipants: 28,
  highestPoints: 98,
  highestPointsName: "João Silva",
  lowestPoints: 12,
  averagePoints: 56.4,
  totalCorrect: 438,
  distribution: [validBucket],
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

  it("aceita correctByStage com dezesseis-avos (TASK-01)", () => {
    expect(
      statisticsSchema.safeParse({
        ...valid,
        correctByStage: { "dezesseis-avos": 3 },
      }).success,
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

  // ── positionHistory.round + totalWrong (TASK-01) ──────────────────────────
  it("aceita histórico sem round (compat retroativa)", () => {
    expect(positionHistoryEntrySchema.safeParse(validHistory).success).toBe(
      true,
    );
  });

  it("aceita histórico com round", () => {
    expect(
      positionHistoryEntrySchema.safeParse({ ...validHistory, round: 5 })
        .success,
    ).toBe(true);
  });

  it("rejeita round < 1 no histórico", () => {
    expect(
      positionHistoryEntrySchema.safeParse({ ...validHistory, round: 0 })
        .success,
    ).toBe(false);
  });

  it("aceita statistics com totalWrong", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, totalWrong: 8 }).success,
    ).toBe(true);
  });

  it("aceita statistics sem totalWrong (compat retroativa)", () => {
    expect(statisticsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita totalWrong negativo", () => {
    expect(
      statisticsSchema.safeParse({ ...valid, totalWrong: -1 }).success,
    ).toBe(false);
  });

  // ── poolStatsSchema + distributionBucketSchema (TASK-01) ──────────────────
  it("faz parse de pool stats válido", () => {
    expect(poolStatsSchema.safeParse(validPoolStats).success).toBe(true);
  });

  it("aceita distribution vazio", () => {
    expect(
      poolStatsSchema.safeParse({ ...validPoolStats, distribution: [] }).success,
    ).toBe(true);
  });

  it("aceita pool stats sem highestPointsName (opcional)", () => {
    const { highestPointsName: _omit, ...withoutName } = validPoolStats;
    expect(poolStatsSchema.safeParse(withoutName).success).toBe(true);
  });

  it("aceita averagePoints fracionário", () => {
    expect(
      poolStatsSchema.safeParse({ ...validPoolStats, averagePoints: 17.4 })
        .success,
    ).toBe(true);
  });

  it("rejeita totalParticipants negativo", () => {
    expect(
      poolStatsSchema.safeParse({ ...validPoolStats, totalParticipants: -1 })
        .success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict) em pool stats", () => {
    expect(
      poolStatsSchema.safeParse({ ...validPoolStats, extra: 1 }).success,
    ).toBe(false);
  });

  it("faz parse de bucket de distribuição válido", () => {
    expect(distributionBucketSchema.safeParse(validBucket).success).toBe(true);
  });

  it("rejeita count negativo no bucket", () => {
    expect(
      distributionBucketSchema.safeParse({ ...validBucket, count: -1 }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict) no bucket", () => {
    expect(
      distributionBucketSchema.safeParse({ ...validBucket, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Statistics["accuracy"]>().toEqualTypeOf<number>();
    expectTypeOf<PositionHistoryEntry["scope"]>().toEqualTypeOf<
      "geral" | "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
    expectTypeOf<PoolStats["totalParticipants"]>().toEqualTypeOf<number>();
    expectTypeOf<PoolStats["distribution"]>().toEqualTypeOf<
      DistributionBucket[]
    >();
    expectTypeOf<DistributionBucket["label"]>().toEqualTypeOf<string>();
  });
});
