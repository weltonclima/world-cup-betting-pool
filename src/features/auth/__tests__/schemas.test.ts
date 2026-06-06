import { describe, expect, expectTypeOf, it } from "vitest";

import {
  loginFormSchema,
  signupFormSchema,
  type LoginFormValues,
  type SignupFormValues,
} from "@/features/auth/schemas";

const validLogin = {
  email: "joao@example.com",
  password: "senha123",
} as const;

const validSignup = {
  name: "João da Silva",
  nickname: "Joãozinho",
  email: "joao@example.com",
  password: "senha123",
  confirmPassword: "senha123",
} as const;

describe("auth › loginFormSchema", () => {
  it("faz parse de um login válido", () => {
    const result = loginFormSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginFormSchema.safeParse({
      ...validLogin,
      email: "não-é-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha curta (< 6)", () => {
    const result = loginFormSchema.safeParse({
      ...validLogin,
      password: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    const result = loginFormSchema.safeParse({
      ...validLogin,
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("auth › signupFormSchema", () => {
  it("faz parse de um cadastro válido", () => {
    const result = signupFormSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      email: "não-é-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha curta (< 6)", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      password: "123",
      confirmPassword: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const result = signupFormSchema.safeParse({ ...validSignup, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita nome só com espaços com uma única mensagem pt-BR", () => {
    const result = signupFormSchema.safeParse({ ...validSignup, name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssues = result.error.issues.filter(
        (issue) => issue.path.join(".") === "name",
      );
      expect(nameIssues).toHaveLength(1);
      expect(nameIssues[0]?.message).toBe("Informe seu nome completo.");
    }
  });

  it("normaliza e-mail com espaços e maiúsculas (trim + lowercase)", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      email: "  Joao@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("joao@example.com");
    }
  });

  it("rejeita apelido vazio", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      nickname: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita quando password !== confirmPassword (issue no path confirmPassword)", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      confirmPassword: "outra-senha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });

  it("mensagens de validação em pt-BR", () => {
    const result = signupFormSchema.safeParse({
      ...validSignup,
      confirmPassword: "outra-senha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const matchIssue = result.error.issues.find(
        (issue) => issue.path.join(".") === "confirmPassword",
      );
      expect(matchIssue?.message).toMatch(/não coincidem/i);
    }
  });
});

describe("auth › inferência de tipos", () => {
  it("LoginFormValues bate com o schema", () => {
    expectTypeOf<LoginFormValues>().toEqualTypeOf<{
      email: string;
      password: string;
    }>();
  });

  it("SignupFormValues bate com o schema", () => {
    expectTypeOf<SignupFormValues>().toEqualTypeOf<{
      name: string;
      nickname: string;
      email: string;
      password: string;
      confirmPassword: string;
    }>();
  });
});
