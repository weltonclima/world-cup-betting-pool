import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  passwordMeetsRules,
  passwordRules,
} from "@/features/profile/schemas";

describe("passwordRules (PRD06-04)", () => {
  it("length: rejeita < 6 caracteres", () => {
    const rule = passwordRules.find((r) => r.id === "length")!;
    expect(rule.test("Ab@1")).toBe(false);
    expect(rule.test("Abc@12")).toBe(true);
  });

  it("case: exige maiúscula E minúscula", () => {
    const rule = passwordRules.find((r) => r.id === "case")!;
    expect(rule.test("senha@1")).toBe(false); // só minúscula
    expect(rule.test("SENHA@1")).toBe(false); // só maiúscula
    expect(rule.test("Senha@1")).toBe(true);
  });

  it("numberSpecial: exige número E caractere especial", () => {
    const rule = passwordRules.find((r) => r.id === "numberSpecial")!;
    expect(rule.test("Senha12")).toBe(false); // sem especial
    expect(rule.test("Senha@@")).toBe(false); // sem número
    expect(rule.test("Senha@1")).toBe(true);
  });

  it("passwordMeetsRules: válida só quando todas passam", () => {
    expect(passwordMeetsRules("Senha@1")).toBe(true);
    expect(passwordMeetsRules("senha")).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "Antiga@1",
    newPassword: "Senha@123",
    confirmPassword: "Senha@123",
  };

  it("aceita entrada válida", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita senha atual vazia", () => {
    const r = changePasswordSchema.safeParse({ ...valid, currentPassword: "" });
    expect(r.success).toBe(false);
  });

  it("rejeita nova senha fraca", () => {
    const r = changePasswordSchema.safeParse({
      ...valid,
      newPassword: "fraca",
      confirmPassword: "fraca",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita confirmação divergente", () => {
    const r = changePasswordSchema.safeParse({
      ...valid,
      confirmPassword: "Outra@123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(
        true,
      );
    }
  });

  it("rejeita nova senha igual à atual", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "Senha@123",
      newPassword: "Senha@123",
      confirmPassword: "Senha@123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("newPassword"))).toBe(
        true,
      );
    }
  });
});
