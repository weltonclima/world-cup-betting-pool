import { describe, expect, expectTypeOf, it } from "vitest";

import { userSchema } from "@/schemas/users";
import type { User } from "@/types/users";

const valid = {
  uid: "abc123",
  name: "João da Silva",
  nickname: "Joãozinho",
  email: "joao@example.com",
  role: "user",
  status: "approved",
} as const;

describe("users", () => {
  it("faz parse de um usuário válido", () => {
    const result = userSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("aceita campos opcionais de auditoria", () => {
    const result = userSchema.safeParse({
      ...valid,
      createdAt: "2026-06-05T12:00:00Z",
      updatedAt: "2026-06-05T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita role fora do enum", () => {
    expect(userSchema.safeParse({ ...valid, role: "root" }).success).toBe(
      false,
    );
  });

  it("rejeita status fora do enum", () => {
    expect(
      userSchema.safeParse({ ...valid, status: "deleted" }).success,
    ).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    expect(
      userSchema.safeParse({ ...valid, email: "não-é-email" }).success,
    ).toBe(false);
  });

  it("rejeita string vazia em nonEmptyString", () => {
    expect(userSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, uid: "" }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, nickname: "" }).success).toBe(
      false,
    );
  });

  it("rejeita campos obrigatórios ausentes", () => {
    const { email: _email, ...semEmail } = valid;
    void _email;
    expect(userSchema.safeParse(semEmail).success).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      userSchema.safeParse({ ...valid, extra: "x" }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<User["role"]>().toEqualTypeOf<"user" | "admin">();
    expectTypeOf<User["status"]>().toEqualTypeOf<
      "pending" | "approved" | "blocked"
    >();
    expectTypeOf<User["email"]>().toEqualTypeOf<string>();
    expectTypeOf<User["createdAt"]>().toEqualTypeOf<string | undefined>();
  });
});
