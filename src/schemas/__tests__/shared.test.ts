import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isGroupAdminRole,
  isParticipantRole,
  isSuperAdminRole,
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
  it("roleSchema aceita os 3 valores canônicos + 2 legados (dupla-compat)", () => {
    // canônicos PRD-09
    expect(roleSchema.safeParse("participant").success).toBe(true);
    expect(roleSchema.safeParse("group_admin").success).toBe(true);
    expect(roleSchema.safeParse("super_admin").success).toBe(true);
    // legados (aceitos durante a transição — removidos na TASK-12)
    expect(roleSchema.safeParse("user").success).toBe(true);
    expect(roleSchema.safeParse("admin").success).toBe(true);
    // inválidos
    expect(roleSchema.safeParse("root").success).toBe(false);
    expect(roleSchema.safeParse("").success).toBe(false);
  });

  it("userStatusSchema aceita válidos e rejeita inválidos", () => {
    expect(userStatusSchema.safeParse("pending").success).toBe(true);
    expect(userStatusSchema.safeParse("approved").success).toBe(true);
    expect(userStatusSchema.safeParse("blocked").success).toBe(true);
    expect(userStatusSchema.safeParse("deleted").success).toBe(false);
  });

  it("stageSchema aceita as 7 fases e rejeita fora do enum", () => {
    for (const s of [
      "grupos",
      "dezesseis-avos",
      "oitavas",
      "quartas",
      "semifinal",
      "terceiro",
      "final",
    ]) {
      expect(stageSchema.safeParse(s).success).toBe(true);
    }
    expect(stageSchema.safeParse("terceiro_lugar").success).toBe(false);
    expect(stageSchema.safeParse("geral").success).toBe(false);
    expect(stageSchema.safeParse("round-of-32").success).toBe(false); // slug inválido
  });

  it("rankingScopeSchema aceita geral + 5 fases + agregado eliminatorias", () => {
    for (const s of [
      "geral",
      "grupos",
      "oitavas",
      "quartas",
      "semifinal",
      "final",
      "eliminatorias",
    ]) {
      expect(rankingScopeSchema.safeParse(s).success).toBe(true);
    }
    expect(rankingScopeSchema.safeParse("repescagem").success).toBe(false);
  });

  it("rankingScopeSchema não inclui dezesseis-avos como scope de fase (entra só no agregado eliminatorias)", () => {
    expect(rankingScopeSchema.safeParse("dezesseis-avos").success).toBe(false);
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

describe("shared › helpers de role (dupla-compat)", () => {
  it("isSuperAdminRole: true para admin (legado) e super_admin", () => {
    expect(isSuperAdminRole("admin")).toBe(true);
    expect(isSuperAdminRole("super_admin")).toBe(true);
    expect(isSuperAdminRole("group_admin")).toBe(false);
    expect(isSuperAdminRole("participant")).toBe(false);
    expect(isSuperAdminRole("user")).toBe(false);
  });

  it("isGroupAdminRole: true só para group_admin (sem equivalente legado)", () => {
    expect(isGroupAdminRole("group_admin")).toBe(true);
    expect(isGroupAdminRole("admin")).toBe(false);
    expect(isGroupAdminRole("super_admin")).toBe(false);
    expect(isGroupAdminRole("participant")).toBe(false);
    expect(isGroupAdminRole("user")).toBe(false);
  });

  it("isParticipantRole: true para user (legado) e participant", () => {
    expect(isParticipantRole("user")).toBe(true);
    expect(isParticipantRole("participant")).toBe(true);
    expect(isParticipantRole("admin")).toBe(false);
    expect(isParticipantRole("super_admin")).toBe(false);
    expect(isParticipantRole("group_admin")).toBe(false);
  });

  it("TODO valor do roleSchema cai em exatamente um helper (partição total)", () => {
    // Itera as opções do schema (não lista hard-coded): adicionar um role novo
    // sem atualizar os helpers quebra este teste (review WR-02).
    const roles = roleSchema.options;
    for (const r of roles) {
      const hits = [
        isSuperAdminRole(r),
        isGroupAdminRole(r),
        isParticipantRole(r),
      ].filter(Boolean).length;
      expect(hits).toBe(1);
    }
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
    // Offset numérico aceito (formato da API-Football: fixture.date com "+00:00").
    expect(isoDateTime.safeParse("2026-06-05T12:00:00+00:00").success).toBe(true);
    expect(isoDateTime.safeParse("2026-06-11T15:00:00-03:00").success).toBe(true);
    expect(isoDateTime.safeParse("não-é-data").success).toBe(false);
  });
});

describe("shared › inferência de tipos", () => {
  it("tipos derivados batem com os enums", () => {
    expectTypeOf<Role>().toEqualTypeOf<
      "participant" | "group_admin" | "super_admin" | "user" | "admin"
    >();
    expectTypeOf<UserStatus>().toEqualTypeOf<
      "pending" | "approved" | "blocked"
    >();
    expectTypeOf<Stage>().toEqualTypeOf<
      | "grupos"
      | "dezesseis-avos"
      | "oitavas"
      | "quartas"
      | "semifinal"
      | "terceiro"
      | "final"
    >();
    expectTypeOf<RankingScope>().toEqualTypeOf<
      | "geral"
      | "grupos"
      | "oitavas"
      | "quartas"
      | "semifinal"
      | "final"
      | "eliminatorias"
    >();
    expectTypeOf<MatchStatus>().toEqualTypeOf<
      "scheduled" | "live" | "finished" | "postponed" | "canceled"
    >();
  });
});
