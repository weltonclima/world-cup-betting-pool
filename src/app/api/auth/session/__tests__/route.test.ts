/**
 * Testes do Route Handler /api/auth/session (TASK-09).
 *
 * O firebase-admin é MOCKADO via `@/server/firebaseAdmin` (verifyIdToken /
 * createSessionCookie). Isso também evita o `import "server-only"` do módulo
 * real, que lança fora de um contexto de servidor Next.
 *
 * Casos:
 *  - POST sucesso: cookie `__session` httpOnly + sameSite=lax setado, 200.
 *  - POST token inválido → 401, sem cookie.
 *  - POST body sem idToken → 400.
 *  - DELETE → 200 e cookie limpo (maxAge 0).
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks do Admin SDK (hoisted para uso nas fábricas de vi.mock).
const { verifyIdTokenMock, createSessionCookieMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  createSessionCookieMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
    createSessionCookie: createSessionCookieMock,
  }),
}));

import { DELETE, POST } from "@/app/api/auth/session/route";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

/** Helper: monta um NextRequest POST com corpo JSON. */
function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    createSessionCookieMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cria o session cookie httpOnly e responde 200 com idToken válido", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-123", role: "admin" });
    createSessionCookieMock.mockResolvedValue("cookie-value-abc");

    const response = await POST(postRequest({ idToken: "valid-id-token" }));

    expect(response.status).toBe(200);
    expect(verifyIdTokenMock).toHaveBeenCalledWith("valid-id-token");
    expect(createSessionCookieMock).toHaveBeenCalledWith("valid-id-token", {
      expiresIn: 5 * 24 * 60 * 60 * 1000,
    });

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("cookie-value-abc");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(5 * 24 * 60 * 60);
  });

  it("responde 401 e não seta cookie quando o idToken é inválido", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await POST(postRequest({ idToken: "bad-token" }));

    expect(response.status).toBe(401);
    expect(createSessionCookieMock).not.toHaveBeenCalled();
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("responde 401 se a criação do session cookie falhar", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-123" });
    createSessionCookieMock.mockRejectedValue(new Error("cookie failure"));

    const response = await POST(postRequest({ idToken: "valid-id-token" }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("responde 400 quando o corpo não tem idToken", async () => {
    const response = await POST(postRequest({ foo: "bar" }));

    expect(response.status).toBe(400);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
    expect(createSessionCookieMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/auth/session", () => {
  it("responde 200 e limpa o cookie de sessão (maxAge 0)", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
  });
});
