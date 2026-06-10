import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  generateAuthenticationOptionsMock,
  createChallengeCookieValueMock,
} = vi.hoisted(() => ({
  generateAuthenticationOptionsMock: vi.fn(),
  createChallengeCookieValueMock: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: generateAuthenticationOptionsMock,
}));

vi.mock("@/server/auth/webauthnChallenge", () => ({
  createChallengeCookieValue: createChallengeCookieValueMock,
  challengeCookieOptions: (maxAge?: number) => ({
    name: "webauthn_challenge",
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAge ?? 300,
  }),
}));

vi.mock("@/server/auth/webauthnConfig", () => ({
  webauthnConfig: { rpName: "Bolão dos Parças", rpID: "localhost", origin: "http://localhost:3000" },
}));

import { POST } from "@/app/api/auth/webauthn/login/options/route";

function req(origin: string | null = "http://localhost:3000"): NextRequest {
  return new Request("http://localhost/api/auth/webauthn/login/options", {
    method: "POST",
    headers: origin ? { origin } : {},
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  generateAuthenticationOptionsMock.mockResolvedValue({
    challenge: "CH",
    rpId: "localhost",
    allowCredentials: [],
  });
  createChallengeCookieValueMock.mockResolvedValue("COOKIE_VALUE");
});

afterEach(() => vi.clearAllMocks());

describe("POST /login/options", () => {
  it("403 quando Origin não casa (CSRF), sem gerar opções", async () => {
    const res = await POST(req("https://evil.com"));
    expect(res.status).toBe(403);
    expect(generateAuthenticationOptionsMock).not.toHaveBeenCalled();
  });

  it("200 com as opções e seta o challenge cookie", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBe("CH");
    expect(res.headers.get("set-cookie") ?? "").toContain("webauthn_challenge=");
  });

  it("gera com rpID da config e userVerification 'required'", async () => {
    await POST(req());
    const args = generateAuthenticationOptionsMock.mock.calls[0]![0];
    expect(args.rpID).toBe("localhost");
    expect(args.userVerification).toBe("required");
  });

  it("usernameless (M5): NÃO restringe allowCredentials", async () => {
    await POST(req());
    const args = generateAuthenticationOptionsMock.mock.calls[0]![0];
    expect(args.allowCredentials).toBeUndefined();
  });

  it("assina o challenge cookie com o challenge gerado (jti embutido no helper)", async () => {
    await POST(req());
    expect(createChallengeCookieValueMock).toHaveBeenCalledTimes(1);
    expect(createChallengeCookieValueMock.mock.calls[0]![0]).toMatchObject({
      challenge: "CH",
    });
  });
});
