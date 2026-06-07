import { describe, expect, expectTypeOf, it } from "vitest";

import { systemSettingsSchema } from "@/schemas/systemSettings";
import type { SystemSettings } from "@/types/systemSettings";

const valid = {
  registrationOpen: true,
  predictionsLocked: false,
} as const;

describe("system_settings", () => {
  it("faz parse de configuração válida (mínima)", () => {
    expect(systemSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita campos opcionais", () => {
    expect(
      systemSettingsSchema.safeParse({
        ...valid,
        currentStage: "grupos",
        updatedAt: "2026-06-05T12:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejeita currentStage fora do enum", () => {
    expect(
      systemSettingsSchema.safeParse({ ...valid, currentStage: "geral" })
        .success,
    ).toBe(false);
  });

  it("rejeita registrationOpen não booleano", () => {
    expect(
      systemSettingsSchema.safeParse({ ...valid, registrationOpen: "yes" })
        .success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      systemSettingsSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<SystemSettings["registrationOpen"]>().toEqualTypeOf<boolean>();
    expectTypeOf<
      SystemSettings["currentStage"]
    >().toEqualTypeOf<
      "grupos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final" | undefined
    >();
  });
});
