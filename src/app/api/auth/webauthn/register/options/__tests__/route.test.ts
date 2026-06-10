import { NextResponse, type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireApprovedUserMock,
  listCredentialsByUidMock,
  generateRegistrationOptionsMock,
  createChallengeCookieValueMock,
} = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  listCredentialsByUidMock: vi.fn(),
  generateRegistrationOptionsMock: vi.fn(),
  createChallengeCookieValueMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));

vi.mock("@/server/auth/webauthnCredentialStore", () => ({
  listCredentialsByUid: listCredentialsByUidMock,
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: generateRegistrationOptionsMock,
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
  CHALLENGE_COOKIE_NAME: "webauthn_challenge",
}));

vi.mock("@/server/auth/webauthnConfig", () => ({
  webauthnConfig: {
    rpName: "Bolão dos Parças",
    rpID: "localhost",
    origin: "http://localhost:3000",
  },
  webauthnAuthenticatorSelection: {
    authenticatorAttachment: "platform",
    residentKey: "required",
    userVerification: "required",
  },
  webauthnSupportedAlgorithmIDs: [-7, -257],
}));

import { POST } from "@/app/api/auth/webauthn/register/options/route";

const APPROVED = {
  user: { uid: "uid-1", email: "ana@x.com", nickname: "ana" },
};

/** Request POST com Origin confiável (casa com webauthnConfig.origin mockado). */
function req(origin: string | null = "http://localhost:3000"): NextRequest {
  return new Request("http://localhost/api/auth/webauthn/register/options", {
    method: "POST",
    headers: origin ? { origin } : {},
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedUserMock.mockResolvedValue(APPROVED);
  listCredentialsByUidMock.mockResolvedValue([]);
  generateRegistrationOptionsMock.mockResolvedValue({
    challenge: "CHALLENGE",
    rp: { name: "Bolão dos Parças", id: "localhost" },
    user: { id: "x", name: "ana@x.com", displayName: "ana" },
    pubKeyCredParams: [],
  });
  createChallengeCookieValueMock.mockResolvedValue("signed-token");
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/auth/webauthn/register/options", () => {
  it("403 quando Origin não casa (CSRF)", async () => {
    const res = await POST(req("https://evil.com"));
    expect(res.status).toBe(403);
    expect(requireApprovedUserMock).not.toHaveBeenCalled();
    expect(generateRegistrationOptionsMock).not.toHaveBeenCalled();
  });

  it("propaga o erro de auth quando não aprovado", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "x" }, { status: 403 }),
    });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(generateRegistrationOptionsMock).not.toHaveBeenCalled();
  });

  it("gera options com rpID e exclui credenciais existentes", async () => {
    listCredentialsByUidMock.mockResolvedValue([
      { credentialId: "cred-a", transports: ["internal"] },
    ]);
    const res = await POST(req());
    expect(res.status).toBe(200);

    expect(generateRegistrationOptionsMock).toHaveBeenCalledTimes(1);
    const opts = generateRegistrationOptionsMock.mock.calls[0]![0];
    expect(opts.rpID).toBe("localhost");
    expect(opts.userName).toBe("ana@x.com");
    expect(opts.excludeCredentials).toEqual([
      { id: "cred-a", transports: ["internal"] },
    ]);
    expect(opts.authenticatorSelection.userVerification).toBe("required");
  });

  it("assina o challenge com binding de uid e seta o cookie", async () => {
    const res = await POST(req());
    expect(createChallengeCookieValueMock).toHaveBeenCalledWith({
      challenge: "CHALLENGE",
      uid: "uid-1",
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("webauthn_challenge=");

    const body = await res.json();
    expect(body.challenge).toBe("CHALLENGE");
  });
});
