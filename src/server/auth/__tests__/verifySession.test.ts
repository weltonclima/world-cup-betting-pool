/**
 * Testes da verificação de session cookie do Firebase no edge (TASK-10).
 *
 * `verifySession` é PURA o suficiente para teste: o `jose` é mockado
 * (`importX509` / `jwtVerify`) e o fetch dos certificados públicos do Google é
 * injetado via `deps.fetchCerts`. Nada de rede/edge real.
 *
 * Cobertura:
 *  - token ausente/vazio → invalid.
 *  - header sem `kid` → invalid.
 *  - `kid` desconhecido (sem cert correspondente) → invalid.
 *  - assinatura inválida (jwtVerify lança) → invalid.
 *  - iss/aud errados (jwtVerify lança por claim) → invalid.
 *  - token expirado (jwtVerify lança por exp) → invalid.
 *  - válido, role != admin → valid mas role do payload (ex.: "user"/undefined).
 *  - válido, role == admin → valid + role "admin".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks hoisted do `jose`.
const { importX509Mock, jwtVerifyMock, decodeProtectedHeaderMock } = vi.hoisted(
  () => ({
    importX509Mock: vi.fn(),
    jwtVerifyMock: vi.fn(),
    decodeProtectedHeaderMock: vi.fn(),
  }),
);

vi.mock("jose", () => ({
  importX509: importX509Mock,
  jwtVerify: jwtVerifyMock,
  decodeProtectedHeader: decodeProtectedHeaderMock,
}));

import { verifySession, type VerifySessionDeps } from "../verifySession";

const PROJECT_ID = "world-cup-betting-pool-8e93c";
const KID = "abc123";
const PEM = "-----BEGIN CERTIFICATE-----FAKE-----END CERTIFICATE-----";

/** Deps padrão: um cert por `kid` e projectId fixo. */
function makeDeps(
  overrides: Partial<VerifySessionDeps> = {},
): VerifySessionDeps {
  return {
    projectId: PROJECT_ID,
    fetchCerts: vi.fn(async () => ({ [KID]: PEM })),
    ...overrides,
  };
}

describe("verifySession", () => {
  beforeEach(() => {
    importX509Mock.mockReset();
    jwtVerifyMock.mockReset();
    decodeProtectedHeaderMock.mockReset();
    // Defaults felizes; cada teste ajusta o que precisa.
    decodeProtectedHeaderMock.mockReturnValue({ kid: KID, alg: "RS256" });
    importX509Mock.mockResolvedValue({ type: "public" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna invalid quando o token está ausente", async () => {
    const result = await verifySession(undefined, makeDeps());
    expect(result.valid).toBe(false);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it("retorna invalid quando o token é string vazia", async () => {
    const result = await verifySession("", makeDeps());
    expect(result.valid).toBe(false);
    expect(decodeProtectedHeaderMock).not.toHaveBeenCalled();
  });

  it("retorna invalid quando o header não tem kid", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ alg: "RS256" });
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(false);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it("retorna invalid quando o kid não tem cert correspondente", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ kid: "other", alg: "RS256" });
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(false);
    expect(importX509Mock).not.toHaveBeenCalled();
  });

  it("retorna invalid quando a assinatura é inválida (jwtVerify lança)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("signature verification failed"));
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(false);
    expect(jwtVerifyMock).toHaveBeenCalledOnce();
  });

  it("retorna invalid quando iss/aud estão errados (jwtVerify lança por claim)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error('unexpected "iss" claim value'));
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(false);
  });

  it("passa iss/aud/alg esperados ao jwtVerify", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { role: "admin" } });
    await verifySession("token", makeDeps());
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      "token",
      { type: "public" },
      {
        algorithms: ["RS256"],
        issuer: `https://session.firebase.google.com/${PROJECT_ID}`,
        audience: PROJECT_ID,
      },
    );
  });

  it("retorna invalid quando o token está expirado (jwtVerify lança por exp)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error('"exp" claim timestamp check failed'));
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(false);
  });

  it("retorna valid com role do payload quando role != admin", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { role: "user", uid: "u1" } });
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.role).toBe("user");
    }
  });

  it("retorna valid e role admin quando role === admin", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { role: "admin", uid: "u1" } });
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.role).toBe("admin");
    }
  });

  it("retorna valid com role null quando o payload não tem role", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { uid: "u1" } });
    const result = await verifySession("token", makeDeps());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.role).toBeNull();
    }
  });

  it("retorna invalid quando projectId não está configurado", async () => {
    const result = await verifySession("token", makeDeps({ projectId: "" }));
    expect(result.valid).toBe(false);
    expect(decodeProtectedHeaderMock).not.toHaveBeenCalled();
  });

  it("retorna invalid quando o fetch de certs falha", async () => {
    const result = await verifySession(
      "token",
      makeDeps({
        fetchCerts: vi.fn(async () => {
          throw new Error("network down");
        }),
      }),
    );
    expect(result.valid).toBe(false);
  });
});
