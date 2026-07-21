import { describe, expect, expectTypeOf, it } from "vitest";

import {
  championshipSchema,
  championshipStatusSchema,
  championshipTypeSchema,
} from "@/schemas/championships";
import type {
  Championship,
  ChampionshipStatus,
  ChampionshipType,
} from "@/types/championships";

const valid = {
  id: "bra.1-2026",
  espnSlug: "bra.1",
  name: "Brasileirão Série A",
  season: "2026",
  type: "league",
  status: "live",
  needsPagination: true,
} as const;

describe("championships › championshipSchema", () => {
  it("faz parse de um campeonato válido completo", () => {
    expect(championshipSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita legacyMatchId opcional", () => {
    expect(
      championshipSchema.safeParse({ ...valid, legacyMatchId: true }).success,
    ).toBe(true);
    // ausente também é válido
    expect(championshipSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita type fora do enum", () => {
    expect(
      championshipSchema.safeParse({ ...valid, type: "friendly" }).success,
    ).toBe(false);
  });

  it("rejeita status fora do enum", () => {
    expect(
      championshipSchema.safeParse({ ...valid, status: "finished" }).success,
    ).toBe(false);
  });

  it("é strict: rejeita campos extras", () => {
    expect(
      championshipSchema.safeParse({ ...valid, extra: "x" }).success,
    ).toBe(false);
  });

  it("rejeita id/espnSlug/name/season vazios", () => {
    for (const field of ["id", "espnSlug", "name", "season"] as const) {
      expect(
        championshipSchema.safeParse({ ...valid, [field]: "" }).success,
      ).toBe(false);
    }
  });

  it("exige needsPagination booleano", () => {
    expect(
      championshipSchema.safeParse({ ...valid, needsPagination: undefined })
        .success,
    ).toBe(false);
  });
});

describe("championships › enums", () => {
  it("championshipTypeSchema aceita league|cup", () => {
    expect(championshipTypeSchema.safeParse("league").success).toBe(true);
    expect(championshipTypeSchema.safeParse("cup").success).toBe(true);
    expect(championshipTypeSchema.safeParse("x").success).toBe(false);
  });

  it("championshipStatusSchema aceita upcoming|live|archived", () => {
    for (const s of ["upcoming", "live", "archived"]) {
      expect(championshipStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(championshipStatusSchema.safeParse("done").success).toBe(false);
  });
});

describe("championships › types", () => {
  it("deriva Championship do schema", () => {
    expectTypeOf<Championship>().toMatchTypeOf<{
      id: string;
      espnSlug: string;
      type: ChampionshipType;
      status: ChampionshipStatus;
    }>();
  });
});
