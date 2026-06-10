import { NextResponse, type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireApprovedUserMock,
  saveCredentialMock,
  publicKeyToStorageMock,
  verifyRegistrationResponseMock,
  readChallengeMock,
  consumeJtiMock,
  cookiesMock,
  CredentialAlreadyExistsError,
} = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  saveCredentialMock: vi.fn(),
  publicKeyToStorageMock: vi.fn(),
  verifyRegistrationResponseMock: vi.fn(),
  readChallengeMock: vi.fn(),
  consumeJtiMock: vi.fn(),
  cookiesMock: vi.fn(),
  CredentialAlreadyExistsError: class extends Error {},
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));

vi.mock("@/server/auth/webauthnCredentialStore", () => ({
  saveCredential: saveCredentialMock,
  publicKeyToStorage: publicKeyToStorageMock,
  CredentialAlreadyExistsError,
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: verifyRegistrationResponseMock,
}));

vi.mock("@/server/auth/webauthnChallenge", () => ({
  readChallenge: readChallengeMock,
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

vi.mock("@/server/auth/webauthnChallengeJtiStore", () => ({
  consumeJti: consumeJtiMock,
}));

vi.mock("@/server/auth/webauthnConfig", () => ({
  webauthnConfig: {
    rpName: "Bolão dos Parças",
    rpID: "localhost",
    origin: "http://localhost:3000",
  },
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { POST } from "@/app/api/auth/webauthn/register/verify/route";

const UID = "uid-1";

function req(
  body: unknown,
  origin: string | null = "http://localhost:3000",
): NextRequest {
  return new Request("http://localhost/api/auth/webauthn/register/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_BODY = {
  response: { id: "cred-1", rawId: "cred-1", response: {}, type: "public-key" },
  deviceLabel: "iPhone",
};

const VERIFIED_OK = {
  verified: true,
  registrationInfo: {
    credential: {
      id: "cred-1",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports: ["internal"],
    },
    credentialDeviceType: "singleDevice",
    credentialBackedUp: true,
  },
};

function setChallengeCookie(present = true) {
  cookiesMock.mockResolvedValue({
    get: vi.fn((name: string) =>
      present && name === "webauthn_challenge" ? { value: "token" } : undefined,
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedUserMock.mockResolvedValue({
    user: { uid: UID, email: "ana@x.com", nickname: "ana" },
  });
  setChallengeCookie(true);
  readChallengeMock.mockResolvedValue({ challenge: "CH", uid: UID, jti: "jti-1" });
  consumeJtiMock.mockResolvedValue(true);
  verifyRegistrationResponseMock.mockResolvedValue(VERIFIED_OK);
  publicKeyToStorageMock.mockReturnValue("PK_B64URL");
  saveCredentialMock.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe("POST /register/verify — auth e challenge", () => {
  it("403 quando Origin não casa (CSRF), sem auth/verify/save", async () => {
    const res = await POST(req(VALID_BODY, "https://evil.com"));
    expect(res.status).toBe(403);
    expect(requireApprovedUserMock).not.toHaveBeenCalled();
    expect(verifyRegistrationResponseMock).not.toHaveBeenCalled();
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("propaga erro de auth (não grava nem verifica)", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "x" }, { status: 403 }),
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(403);
    expect(verifyRegistrationResponseMock).not.toHaveBeenCalled();
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("400 quando o challenge cookie está ausente/ inválido", async () => {
    readChallengeMock.mockResolvedValue(null);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(400);
    expect(verifyRegistrationResponseMock).not.toHaveBeenCalled();
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("rejeita quando challenge.uid ≠ uid da sessão (binding)", async () => {
    readChallengeMock.mockResolvedValue({ challenge: "CH", uid: "OUTRO", jti: "jti-1" });
    const res = await POST(req(VALID_BODY));
    expect([400, 403]).toContain(res.status);
    expect(verifyRegistrationResponseMock).not.toHaveBeenCalled();
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("HR-01 carry-forward: consome o jti do challenge (single-use)", async () => {
    await POST(req(VALID_BODY));
    expect(consumeJtiMock).toHaveBeenCalledWith("jti-1", expect.any(String));
  });

  it("HR-01 carry-forward: jti já consumido (replay) → 400, sem verificar/gravar", async () => {
    consumeJtiMock.mockResolvedValue(false);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(400);
    expect(verifyRegistrationResponseMock).not.toHaveBeenCalled();
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });
});

describe("POST /register/verify — verificação e persistência", () => {
  it("verifica com origin/rpID da config e userVerification required", async () => {
    await POST(req(VALID_BODY));
    expect(verifyRegistrationResponseMock).toHaveBeenCalledTimes(1);
    const args = verifyRegistrationResponseMock.mock.calls[0]![0];
    expect(args.expectedChallenge).toBe("CH");
    expect(args.expectedOrigin).toBe("http://localhost:3000");
    expect(args.expectedRPID).toBe("localhost");
    expect(args.requireUserVerification).toBe(true);
  });

  it("verified:false → 422 e NADA gravado, cookie limpo", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(422);
    expect(saveCredentialMock).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain("webauthn_challenge=");
  });

  it("verified:true → grava credencial sob uid da sessão (publicKey base64url) e 201", async () => {
    // uid no body é ignorado: deve usar o da sessão.
    const res = await POST(req({ ...VALID_BODY, uid: "evil" }));
    expect(res.status).toBe(201);
    expect(saveCredentialMock).toHaveBeenCalledTimes(1);
    const saved = saveCredentialMock.mock.calls[0]![0];
    expect(saved.uid).toBe(UID);
    expect(saved.credentialId).toBe("cred-1");
    expect(saved.publicKey).toBe("PK_B64URL");
    expect(saved.counter).toBe(0);
  });

  it("body sem `response` → 422", async () => {
    const res = await POST(req({ deviceLabel: "x" }));
    expect(res.status).toBe(422);
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("JSON malformado → 422, nada gravado", async () => {
    const bad = new Request(
      "http://localhost/api/auth/webauthn/register/verify",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: "{nao-e-json",
      },
    ) as unknown as NextRequest;
    const res = await POST(bad);
    expect(res.status).toBe(422);
    expect(saveCredentialMock).not.toHaveBeenCalled();
  });

  it("verifyRegistrationResponse lançando → 422, nada gravado, cookie limpo", async () => {
    verifyRegistrationResponseMock.mockRejectedValue(
      new Error("attestation inválida"),
    );
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(422);
    expect(saveCredentialMock).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain("webauthn_challenge=");
  });

  it("sucesso (201) também limpa o challenge cookie (uso único)", async () => {
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("webauthn_challenge=");
    // Max-Age=0 → cookie expirado (limpo).
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("colisão de credentialId → 409 (não 500), nada de overwrite", async () => {
    saveCredentialMock.mockRejectedValue(new CredentialAlreadyExistsError());
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("erro do Admin SDK ao gravar → 500", async () => {
    saveCredentialMock.mockRejectedValue(new Error("firestore down"));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
