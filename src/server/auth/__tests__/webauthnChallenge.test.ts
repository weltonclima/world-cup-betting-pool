import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` lança fora de um Server Component; no-op sob vitest.
vi.mock("server-only", () => ({}));

import {
  CHALLENGE_COOKIE_NAME,
  challengeCookieOptions,
  createChallengeCookieValue,
  readChallenge,
} from "@/server/auth/webauthnChallenge";

/**
 * Challenge cookie assinado (TASK-04) — segurança: round-trip, anti-tamper,
 * expiração e ausência. Sem env de segredo → usa o fallback dev determinístico
 * (mesmo segredo em sign e verify).
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("webauthnChallenge — round-trip", () => {
  it("recupera o challenge e os auxiliares (uid) do token assinado", async () => {
    const token = await createChallengeCookieValue({
      challenge: "chal-abc",
      uid: "user-1",
    });
    const payload = await readChallenge(token);

    expect(payload).not.toBeNull();
    expect(payload?.challenge).toBe("chal-abc");
    expect(payload?.uid).toBe("user-1");
  });
});

describe("webauthnChallenge — jti single-use (HR-01)", () => {
  it("embute um jti e o recupera no readChallenge", async () => {
    const token = await createChallengeCookieValue({ challenge: "chal-abc" });
    const payload = await readChallenge(token);
    expect(typeof payload?.jti).toBe("string");
    expect((payload?.jti as string).length).toBeGreaterThan(0);
  });

  it("gera jti distinto a cada emissão (anti-replay)", async () => {
    const a = await readChallenge(
      await createChallengeCookieValue({ challenge: "c1" }),
    );
    const b = await readChallenge(
      await createChallengeCookieValue({ challenge: "c2" }),
    );
    expect(a?.jti).not.toBe(b?.jti);
  });
});

describe("webauthnChallenge — rejeição", () => {
  it("token forjado/alterado → null", async () => {
    const token = await createChallengeCookieValue({ challenge: "chal-abc" });
    // Corrompe a assinatura (cauda do JWT).
    const tampered = `${token.slice(0, -3)}zzz`;

    expect(await readChallenge(tampered)).toBeNull();
  });

  it("string que não é JWT → null", async () => {
    expect(await readChallenge("isto-nao-e-um-jwt")).toBeNull();
  });

  it("token ausente/vazio → null", async () => {
    expect(await readChallenge(undefined)).toBeNull();
    expect(await readChallenge(null)).toBeNull();
    expect(await readChallenge("")).toBeNull();
  });

  it("token expirado → null", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00.000Z"));

    const token = await createChallengeCookieValue({ challenge: "chal-exp" });

    // Avança além do TTL (5 min) → expira.
    vi.setSystemTime(new Date("2026-06-09T12:06:00.000Z"));

    expect(await readChallenge(token)).toBeNull();
  });
});

describe("webauthnChallenge — cookie options", () => {
  it("usa o nome padrão e atributos httpOnly/lax/path", () => {
    const opts = challengeCookieOptions(120);
    expect(opts.name).toBe(CHALLENGE_COOKIE_NAME);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(120);
    // Em test/dev (não-prod) secure=false; em prod seria true.
    expect(opts.secure).toBe(false);
  });
});

describe("webauthnChallenge — segredo obrigatório em produção", () => {
  it("prod sem WEBAUTHN_CHALLENGE_SECRET → lança ao assinar", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEBAUTHN_CHALLENGE_SECRET", undefined as unknown as string);

    const mod = await import("@/server/auth/webauthnChallenge");
    await expect(
      mod.createChallengeCookieValue({ challenge: "x" }),
    ).rejects.toThrow();

    vi.unstubAllEnvs();
  });
});
