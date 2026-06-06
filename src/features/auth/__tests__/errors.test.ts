import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/features/auth/errors";

// Mensagens neutras esperadas (privacidade — R6).
const CREDENTIAL_MESSAGE = "E-mail ou senha inválidos.";
const FALLBACK_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

describe("mapAuthError › códigos mapeados", () => {
  it("credenciais inválidas usam mensagem neutra e idêntica (R6)", () => {
    const codes = [
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-credential",
    ];

    for (const code of codes) {
      expect(mapAuthError(code)).toBe(CREDENTIAL_MESSAGE);
    }

    // Privacidade: as três mensagens devem ser exatamente a mesma string.
    const unique = new Set(codes.map((code) => mapAuthError(code)));
    expect(unique.size).toBe(1);
  });

  it("email-already-in-use não confirma a existência de conta (R6)", () => {
    const message = mapAuthError("auth/email-already-in-use");

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe(FALLBACK_MESSAGE);
    // Não pode vazar que o e-mail já existe / já está cadastrado.
    expect(message.toLowerCase()).not.toContain("já cadastrad");
    expect(message.toLowerCase()).not.toContain("já existe");
    expect(message.toLowerCase()).not.toContain("em uso");
  });

  it("weak-password retorna orientação específica de senha", () => {
    const message = mapAuthError("auth/weak-password");
    expect(message.toLowerCase()).toContain("senha");
    expect(message).not.toBe(FALLBACK_MESSAGE);
    expect(message).not.toBe(CREDENTIAL_MESSAGE);
  });

  it("too-many-requests orienta a aguardar", () => {
    const message = mapAuthError("auth/too-many-requests");
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe(FALLBACK_MESSAGE);
    expect(message).not.toBe(CREDENTIAL_MESSAGE);
  });

  it("network-request-failed orienta sobre conexão", () => {
    const message = mapAuthError("auth/network-request-failed");
    expect(message.toLowerCase()).toContain("conex");
    expect(message).not.toBe(FALLBACK_MESSAGE);
  });
});

describe("mapAuthError › fallback", () => {
  it("código desconhecido cai no fallback genérico", () => {
    expect(mapAuthError("auth/some-unknown-code")).toBe(FALLBACK_MESSAGE);
  });

  it("string vazia cai no fallback genérico", () => {
    expect(mapAuthError("")).toBe(FALLBACK_MESSAGE);
  });

  it("código sem prefixo conhecido cai no fallback genérico", () => {
    expect(mapAuthError("random")).toBe(FALLBACK_MESSAGE);
  });
});

describe("mapAuthError › determinismo", () => {
  it("mesma entrada retorna sempre a mesma saída", () => {
    expect(mapAuthError("auth/invalid-credential")).toBe(
      mapAuthError("auth/invalid-credential"),
    );
    expect(mapAuthError("auth/unknown")).toBe(mapAuthError("auth/unknown"));
  });
});
