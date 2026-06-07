import { describe, expect, expectTypeOf, it } from "vitest";

import { teamSchema } from "@/schemas/teams";
import type { Team } from "@/types/teams";

const valid = {
  name: "Brasil",
  code: "BRA",
} as const;

describe("teams", () => {
  it("faz parse de seleção válida (mínima)", () => {
    expect(teamSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita campos opcionais", () => {
    expect(
      teamSchema.safeParse({
        ...valid,
        flagUrl: "https://example.com/bra.png",
        groupId: "A",
      }).success,
    ).toBe(true);
  });

  it("rejeita code com tamanho diferente de 3", () => {
    expect(teamSchema.safeParse({ ...valid, code: "BR" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...valid, code: "BRAS" }).success).toBe(
      false,
    );
  });

  it("rejeita code com letras minúsculas (código FIFA exige maiúsculas)", () => {
    expect(teamSchema.safeParse({ ...valid, code: "bra" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...valid, code: "Bra" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...valid, code: "bRA" }).success).toBe(false);
  });

  it("rejeita code com dígitos ou caracteres não-alfabéticos", () => {
    expect(teamSchema.safeParse({ ...valid, code: "BR1" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...valid, code: "B A" }).success).toBe(false);
  });

  it("rejeita name vazio", () => {
    expect(teamSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejeita flagUrl inválida", () => {
    expect(
      teamSchema.safeParse({ ...valid, flagUrl: "não-é-url" }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(teamSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Team["code"]>().toEqualTypeOf<string>();
    expectTypeOf<Team["flagUrl"]>().toEqualTypeOf<string | undefined>();
  });
});
