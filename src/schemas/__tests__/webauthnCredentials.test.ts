import { describe, expect, it } from "vitest";

import { webauthnCredentialSchema } from "@/schemas/webauthnCredentials";

/**
 * Contrato do doc `webauthn_credentials/{credentialId}` (TASK-03).
 * Credencial de passkey gravada pelo Admin SDK após verificação WebAuthn.
 */

const valid = {
  credentialId: "cred_abc123",
  uid: "uid-1",
  publicKey: "cHVibGljLWtleS1iYXNlNjR1cmw",
  counter: 0,
  createdAt: "2026-06-09T12:00:00.000Z",
};

describe("webauthnCredentialSchema", () => {
  it("aceita o doc mínimo válido (sem opcionais)", () => {
    expect(webauthnCredentialSchema.parse(valid)).toEqual(valid);
  });

  it("aceita os campos opcionais (transports, deviceLabel, lastUsedAt)", () => {
    const full = {
      ...valid,
      transports: ["internal", "hybrid"],
      deviceLabel: "iPhone do Welton",
      lastUsedAt: "2026-06-10T08:00:00.000Z",
    };
    expect(webauthnCredentialSchema.parse(full)).toEqual(full);
  });

  it.each(["credentialId", "uid", "publicKey", "counter", "createdAt"])(
    "rejeita doc sem o campo obrigatório %s",
    (field) => {
      const doc: Record<string, unknown> = { ...valid };
      delete doc[field];
      expect(webauthnCredentialSchema.safeParse(doc).success).toBe(false);
    },
  );

  it("rejeita counter negativo", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, counter: -1 }).success,
    ).toBe(false);
  });

  it("rejeita counter não-inteiro", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, counter: 1.5 }).success,
    ).toBe(false);
  });

  it.each(["credentialId", "uid", "publicKey"])(
    "rejeita %s vazio",
    (field) => {
      expect(
        webauthnCredentialSchema.safeParse({ ...valid, [field]: "" }).success,
      ).toBe(false);
    },
  );

  it("rejeita campo extra (.strict)", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, hacked: true }).success,
    ).toBe(false);
  });

  it("rejeita createdAt sem formato ISO", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, createdAt: "ontem" })
        .success,
    ).toBe(false);
  });

  it("rejeita lastUsedAt com formato inválido", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, lastUsedAt: "agora" })
        .success,
    ).toBe(false);
  });

  it("rejeita transports não-array (sem coerção)", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, transports: "internal" })
        .success,
    ).toBe(false);
  });

  it("rejeita counter como string (sem coerção de tipo)", () => {
    expect(
      webauthnCredentialSchema.safeParse({ ...valid, counter: "0" }).success,
    ).toBe(false);
  });
});
