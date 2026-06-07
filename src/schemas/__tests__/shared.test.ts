import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isoDateTime,
  matchStatusSchema,
  nonEmptyString,
  percentageSchema,
  rankingScopeSchema,
  roleSchema,
  scoreSchema,
  stageSchema,
  userStatusSchema,
} from "@/schemas/shared";
import type {
  MatchStatus,
  RankingScope,
  Role,
  Stage,
  UserStatus,
} from "@/types/shared";

describe("shared › enums", () => {
  it("roleSchema aceita valores válidos e rejeita inválidos", () => {
    expect(roleSchema.safeParse("user").success).toBe(true);
    expect(roleSchema.safeParse("admin").success).toBe(true);
    expect(roleSchema.safeParse("root").success).toBe(false);
  });

  it("userStatusSchema aceita válidos e rejeita inválidos", () => {
    expect(userStatusSchema.safeParse("pending").success).toBe(true);
    expect(userStatusSchema.safeParse("approved").success).toBe(true);
    expect(userStatusSchema.safeParse("blocked").success).toBe(true);
    expect(userStatusSchema.safeParse("deleted").success).toBe(false);
  });

  it("stageSchema aceita as 6 fases e rejeita fora do enum", () => {
    for (const s of ["grupos", "oitavas", "quartas", "semifinal", "terceiro", "final"]) {
      expect(stageSchema.safeParse(s).success).toBe(true);
    }
    expect(stageSchema.safeParse("terceiro_lugar").success).toBe(false);
    expect(stageSchema.safeParse("geral").success).toBe(false);
  });

  it("rankingScopeSchema aceita geral + 5 fases", () => {
    for (const s of [
      "geral",
      "grupos",
      "oitavas",
      "quartas",
      "semifinal",
      "final",
    ]) {
      expect(rankingScopeSchema.safeParse(s).success).toBe(true);
    }
    expect(rankingScopeSchema.safeParse("repescagem").success).toBe(false);
  });

  it("matchStatusSchema aceita válidos e rejeita inválidos", () => {
    for (const s of [
      "scheduled",
      "live",
      "finished",
      "postponed",
      "canceled",
    ]) {
      expect(matchStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(matchStatusSchema.safeParse("paused").success).toBe(false);
  });
});

describe("shared › primitivos", () => {
  it("nonEmptyString rejeita string vazia", () => {
    expect(nonEmptyString.safeParse("x").success).toBe(true);
    expect(nonEmptyString.safeParse("").success).toBe(false);
  });

  it("scoreSchema exige inteiro ≥ 0", () => {
    expect(scoreSchema.safeParse(0).success).toBe(true);
    expect(scoreSchema.safeParse(3).success).toBe(true);
    expect(scoreSchema.safeParse(-1).success).toBe(false);
    expect(scoreSchema.safeParse(1.5).success).toBe(false);
  });

  it("percentageSchema exige 0–100", () => {
    expect(percentageSchema.safeParse(0).success).toBe(true);
    expect(percentageSchema.safeParse(100).success).toBe(true);
    expect(percentageSchema.safeParse(55.5).success).toBe(true);
    expect(percentageSchema.safeParse(-1).success).toBe(false);
    expect(percentageSchema.safeParse(101).success).toBe(false);
  });

  it("isoDateTime valida data ISO 8601", () => {
    expect(isoDateTime.safeParse("2026-06-05T12:00:00Z").success).toBe(true);
    expect(isoDateTime.safeParse("não-é-data").success).toBe(false);
  });
});

describe("shared › inferência de tipos", () => {
  it("tipos derivados batem com os enums", () => {
    expectTypeOf<Role>().toEqualTypeOf<"user" | "admin">();
    expectTypeOf<UserStatus>().toEqualTypeOf<
      "pending" | "approved" | "blocked"
    >();
    expectTypeOf<Stage>().toEqualTypeOf<
      "grupos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"
    >();
    expectTypeOf<RankingScope>().toEqualTypeOf<
      "geral" | "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
    expectTypeOf<MatchStatus>().toEqualTypeOf<
      "scheduled" | "live" | "finished" | "postponed" | "canceled"
    >();
  });
});
