import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lança fora de um Server Component; no-op sob vitest.
vi.mock("server-only", () => ({}));

/**
 * Config WebAuthn (TASK-04) — resolução por ambiente + validação rpID⊆origin.
 * O módulo resolve a config na carga (top-level), então cada cenário limpa o
 * cache de módulos e ajusta env antes do import dinâmico.
 */

beforeEach(() => {
  vi.resetModules();
  // Limpa overrides herdados do ambiente de teste.
  vi.stubEnv("WEBAUTHN_RP_ID", undefined as unknown as string);
  vi.stubEnv("WEBAUTHN_RP_NAME", undefined as unknown as string);
  vi.stubEnv("WEBAUTHN_ORIGIN", undefined as unknown as string);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webauthnConfig — defaults por ambiente", () => {
  it("dev: rpID=localhost, origin=http://localhost:3000", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { webauthnConfig } = await import("@/server/auth/webauthnConfig");

    expect(webauthnConfig.rpID).toBe("localhost");
    expect(webauthnConfig.origin).toBe("http://localhost:3000");
    expect(webauthnConfig.rpName).toBe("Bolão dos Parças");
  });

  it("prod: rpID e origin do domínio Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { webauthnConfig } = await import("@/server/auth/webauthnConfig");

    expect(webauthnConfig.rpID).toBe("bolaodosparcas.vercel.app");
    expect(webauthnConfig.origin).toBe("https://bolaodosparcas.vercel.app");
  });
});

describe("webauthnConfig — override por env", () => {
  it("usa rpID/origin consistentes do env", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEBAUTHN_RP_ID", "exemplo.com");
    vi.stubEnv("WEBAUTHN_ORIGIN", "https://app.exemplo.com");
    const { webauthnConfig } = await import("@/server/auth/webauthnConfig");

    // origin é subdomínio de rpID → válido.
    expect(webauthnConfig.rpID).toBe("exemplo.com");
    expect(webauthnConfig.origin).toBe("https://app.exemplo.com");
  });

  it("normaliza origin (remove barra/caminho final)", async () => {
    vi.stubEnv("WEBAUTHN_RP_ID", "localhost");
    vi.stubEnv("WEBAUTHN_ORIGIN", "http://localhost:3000/");
    const { webauthnConfig } = await import("@/server/auth/webauthnConfig");

    expect(webauthnConfig.origin).toBe("http://localhost:3000");
  });
});

describe("webauthnConfig — validação rpID ⊆ origin", () => {
  it("falha na carga quando origin não casa com rpID", async () => {
    vi.stubEnv("WEBAUTHN_RP_ID", "exemplo.com");
    vi.stubEnv("WEBAUTHN_ORIGIN", "https://outrodominio.org");

    await expect(import("@/server/auth/webauthnConfig")).rejects.toThrow();
  });

  it("rejeita rpID que é um sufixo público de hosting (ex.: vercel.app)", async () => {
    // Passaria no check rpID⊆origin (host termina em .vercel.app), mas é um
    // rpID inválido → deve falhar pelo guard de Public Suffix.
    vi.stubEnv("WEBAUTHN_RP_ID", "vercel.app");
    vi.stubEnv("WEBAUTHN_ORIGIN", "https://bolaodosparcas.vercel.app");

    await expect(import("@/server/auth/webauthnConfig")).rejects.toThrow();
  });

  it("falha com WEBAUTHN_ORIGIN malformado (erro amigável)", async () => {
    vi.stubEnv("WEBAUTHN_ORIGIN", "nao-e-url");

    await expect(import("@/server/auth/webauthnConfig")).rejects.toThrow(
      /WEBAUTHN_ORIGIN/,
    );
  });
});

describe("webauthnConfig — defaults de autenticador/algoritmos", () => {
  it("exige platform + userVerification/residentKey required", async () => {
    const { webauthnAuthenticatorSelection, webauthnSupportedAlgorithmIDs } =
      await import("@/server/auth/webauthnConfig");

    expect(webauthnAuthenticatorSelection.authenticatorAttachment).toBe(
      "platform",
    );
    expect(webauthnAuthenticatorSelection.userVerification).toBe("required");
    expect(webauthnAuthenticatorSelection.residentKey).toBe("required");
    expect(webauthnSupportedAlgorithmIDs).toEqual([-7, -257]);
  });
});
