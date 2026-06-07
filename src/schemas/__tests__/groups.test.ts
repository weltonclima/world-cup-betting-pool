import { describe, expect, expectTypeOf, it } from "vitest";

import { groupSchema } from "@/schemas/groups";
import type { Group } from "@/types/groups";

const valid = {
  name: "A",
  teamIds: ["bra", "arg", "fra", "ger"],
} as const;

describe("groups", () => {
  it("faz parse de grupo válido", () => {
    expect(groupSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita array vazio de teamIds", () => {
    expect(groupSchema.safeParse({ name: "B", teamIds: [] }).success).toBe(
      true,
    );
  });

  it("rejeita name vazio", () => {
    expect(groupSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejeita teamId vazio dentro do array", () => {
    expect(
      groupSchema.safeParse({ ...valid, teamIds: ["bra", ""] }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(groupSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Group["teamIds"]>().toEqualTypeOf<string[]>();
  });
});
