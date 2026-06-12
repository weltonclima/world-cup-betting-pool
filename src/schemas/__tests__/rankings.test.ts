import { describe, expect, expectTypeOf, it } from "vitest";

import {
  groupRankingSchema,
  rankingEntrySchema,
  rankingSchema,
} from "@/schemas/rankings";
import type { GroupRanking, Ranking, RankingEntry } from "@/types/rankings";

const validEntry = {
  uid: "abc123",
  nickname: "Joãozinho",
  position: 1,
  points: 10,
} as const;

// Entrada completa: campos de exibição (name/wrong/accuracy) preenchidos pelo recalc.
const fullEntry = {
  uid: "abc123",
  nickname: "Joãozinho",
  name: "João Silva",
  position: 1,
  points: 10,
  wrong: 5,
  accuracy: 66.7,
} as const;

const valid = {
  scope: "geral",
  updatedAt: "2026-06-05T12:00:00Z",
  entries: [validEntry],
} as const;

const validGroupRanking = {
  groupId: "A",
  updatedAt: "2026-06-05T12:00:00Z",
  entries: [fullEntry],
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

  // ── Compat retroativa + campos de exibição (TASK-01) ──────────────────────
  it("aceita entrada no formato antigo (compat retroativa)", () => {
    // name/wrong/accuracy ausentes — docs já gravados continuam válidos.
    expect(rankingEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("aceita entrada completa com name/wrong/accuracy", () => {
    expect(rankingEntrySchema.safeParse(fullEntry).success).toBe(true);
  });

  it("rejeita accuracy > 100 na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...fullEntry, accuracy: 101 }).success,
    ).toBe(false);
  });

  it("rejeita accuracy < 0 na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...fullEntry, accuracy: -1 }).success,
    ).toBe(false);
  });

  it("rejeita wrong negativo na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...fullEntry, wrong: -1 }).success,
    ).toBe(false);
  });

  it("rejeita wrong não inteiro na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...fullEntry, wrong: 2.5 }).success,
    ).toBe(false);
  });

  it("rejeita name vazio na entrada", () => {
    expect(
      rankingEntrySchema.safeParse({ ...fullEntry, name: "" }).success,
    ).toBe(false);
  });

  // ── avatarUrl (TASK-05) — aditivo/opcional, retrocompatível ───────────────
  it("aceita entrada com avatarUrl (data URL base64)", () => {
    expect(
      rankingEntrySchema.safeParse({
        ...fullEntry,
        avatarUrl: "data:image/jpeg;base64,QUJD",
      }).success,
    ).toBe(true);
  });

  it("aceita entrada sem avatarUrl (retrocompat)", () => {
    expect(rankingEntrySchema.safeParse(fullEntry).success).toBe(true);
  });

  it("expõe avatarUrl opcional no tipo inferido", () => {
    expectTypeOf<RankingEntry["avatarUrl"]>().toEqualTypeOf<
      string | undefined
    >();
  });

  // ── groupRankingSchema (TASK-01) ──────────────────────────────────────────
  it("faz parse de ranking por grupo válido", () => {
    expect(groupRankingSchema.safeParse(validGroupRanking).success).toBe(true);
  });

  it("rejeita ranking por grupo sem groupId", () => {
    const { groupId: _omit, ...withoutGroupId } = validGroupRanking;
    expect(groupRankingSchema.safeParse(withoutGroupId).success).toBe(false);
  });

  it("rejeita groupId vazio no ranking por grupo", () => {
    expect(
      groupRankingSchema.safeParse({ ...validGroupRanking, groupId: "" })
        .success,
    ).toBe(false);
  });

  it("aceita entries vazio no ranking por grupo", () => {
    expect(
      groupRankingSchema.safeParse({ ...validGroupRanking, entries: [] })
        .success,
    ).toBe(true);
  });

  it("rejeita campo extra (.strict) no ranking por grupo", () => {
    expect(
      groupRankingSchema.safeParse({ ...validGroupRanking, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Ranking["scope"]>().toEqualTypeOf<
      "geral" | "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
    >();
    expectTypeOf<RankingEntry["position"]>().toEqualTypeOf<number>();
    expectTypeOf<Ranking["entries"]>().toEqualTypeOf<RankingEntry[]>();
    expectTypeOf<GroupRanking["groupId"]>().toEqualTypeOf<string>();
    expectTypeOf<GroupRanking["entries"]>().toEqualTypeOf<RankingEntry[]>();
  });
});
