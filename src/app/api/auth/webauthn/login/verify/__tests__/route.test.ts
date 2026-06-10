import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  verifyAuthenticationResponseMock,
  readChallengeMock,
  consumeJtiMock,
  getCredentialByIdMock,
  updateCredentialCounterMock,
  publicKeyFromStorageMock,
  getApprovedUserRoleMock,
  createCustomTokenMock,
  cookiesMock,
} = vi.hoisted(() => ({
  verifyAuthenticationResponseMock: vi.fn(),
  readChallengeMock: vi.fn(),
  consumeJtiMock: vi.fn(),
  getCredentialByIdMock: vi.fn(),
  updateCredentialCounterMock: vi.fn(),
  publicKeyFromStorageMock: vi.fn(),
  getApprovedUserRoleMock: vi.fn(),
  createCustomTokenMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: verifyAuthenticationResponseMock,
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

vi.mock("@/server/auth/webauthnCredentialStore", () => ({
  getCredentialById: getCredentialByIdMock,
  updateCredentialCounter: updateCredentialCounterMock,
  publicKeyFromStorage: publicKeyFromStorageMock,
}));

vi.mock("@/server/auth/approvedUserLookup", () => ({
  getApprovedUserRole: getApprovedUserRoleMock,
}));

vi.mock("@/server/auth/webauthnConfig", () => ({
  webauthnConfig: { rpID: "localhost", origin: "http://localhost:3000" },
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ createCustomToken: createCustomTokenMock }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { POST } from "@/app/api/auth/webauthn/login/verify/route";

const UID = "uid-1";

function req(
  body: unknown,
  origin: string | null = "http://localhost:3000",
): NextRequest {
  return new Request("http://localhost/api/auth/webauthn/login/verify", {
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
};

const STORED_CRED = {
  credentialId: "cred-1",
  uid: UID,
  publicKey: "PK_B64URL",
  counter: 0,
  transports: ["internal"],
  createdAt: "2026-06-09T12:00:00.000Z",
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
  setChallengeCookie(true);
  readChallengeMock.mockResolvedValue({ challenge: "CH", jti: "jti-1" });
  consumeJtiMock.mockResolvedValue(true);
  getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED });
  publicKeyFromStorageMock.mockReturnValue(new Uint8Array([1, 2, 3]));
  verifyAuthenticationResponseMock.mockResolvedValue({
    verified: true,
    authenticationInfo: { credentialID: "cred-1", newCounter: 1, userVerified: true },
  });
  getApprovedUserRoleMock.mockResolvedValue({ approved: true, role: "user" });
  updateCredentialCounterMock.mockResolvedValue(undefined);
  createCustomTokenMock.mockResolvedValue("CUSTOM_TOKEN");
});

afterEach(() => vi.clearAllMocks());

describe("POST /login/verify — guardas e challenge", () => {
  it("403 quando Origin não casa (CSRF), sem verificar", async () => {
    const res = await POST(req(VALID_BODY, "https://evil.com"));
    expect(res.status).toBe(403);
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("challenge ausente/forjado → 400, sem verificar, cookie limpo", async () => {
    readChallengeMock.mockResolvedValue(null);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(400);
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain("webauthn_challenge=");
  });

  it("anti-replay (HR-01): jti já consumido → 400, sem verificar", async () => {
    consumeJtiMock.mockResolvedValue(false);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(400);
    expect(consumeJtiMock).toHaveBeenCalledWith("jti-1", expect.any(String));
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("challenge sem jti no payload → 400, sem consumir nem verificar", async () => {
    readChallengeMock.mockResolvedValue({ challenge: "CH" });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(400);
    expect(consumeJtiMock).not.toHaveBeenCalled();
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
  });

  it("falha de infra no consumeJti → 500, sem verificar", async () => {
    consumeJtiMock.mockRejectedValue(new Error("firestore down"));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(500);
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
  });

  it("body sem `response` → 422", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(422);
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
  });

  it("credencial não encontrada (M5) → 401 idêntico à assertion inválida (anti-enum)", async () => {
    getCredentialByIdMock.mockResolvedValue(null);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(verifyAuthenticationResponseMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });
});

describe("POST /login/verify — verificação criptográfica", () => {
  it("usa origin/rpID da config, UV required e a publicKey decodificada", async () => {
    await POST(req(VALID_BODY));
    const args = verifyAuthenticationResponseMock.mock.calls[0]![0];
    expect(args.expectedChallenge).toBe("CH");
    expect(args.expectedOrigin).toBe("http://localhost:3000");
    expect(args.expectedRPID).toBe("localhost");
    expect(args.requireUserVerification).toBe(true);
    expect(args.credential.id).toBe("cred-1");
    expect(Array.from(args.credential.publicKey)).toEqual([1, 2, 3]);
    expect(args.credential.counter).toBe(0);
  });

  it("verifyAuthenticationResponse lançando → 401, sem token/update, cookie limpo", async () => {
    verifyAuthenticationResponseMock.mockRejectedValue(new Error("assertion inválida"));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(updateCredentialCounterMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain("webauthn_challenge=");
  });

  it("verified:false → 401, sem token/update", async () => {
    verifyAuthenticationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(updateCredentialCounterMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });
});

describe("POST /login/verify — counter (M4)", () => {
  it("single-device: counter regrediu (next <= stored) → 401, sem token/update", async () => {
    getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED, counter: 5 });
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "cred-1",
        newCounter: 5,
        userVerified: true,
        credentialBackedUp: false,
      },
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(updateCredentialCounterMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("single-device reportando 0/0 (clone não-incremental) → 401 (H-2)", async () => {
    getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED, counter: 0 });
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "cred-1",
        newCounter: 0,
        userVerified: true,
        credentialBackedUp: false,
      },
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("passkey sincronizado (backedUp, 0/0) → aceita e emite token", async () => {
    getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED, counter: 0 });
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "cred-1",
        newCounter: 0,
        userVerified: true,
        credentialBackedUp: true,
      },
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    expect(updateCredentialCounterMock).toHaveBeenCalledWith("cred-1", 0, expect.any(String));
    expect(createCustomTokenMock).toHaveBeenCalled();
  });

  it("passkey sincronizado (backedUp) com counter igual (>0) → aceita", async () => {
    getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED, counter: 5 });
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "cred-1",
        newCounter: 5,
        userVerified: true,
        credentialBackedUp: true,
      },
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
  });

  it("single-device: counter avança (stored>0, next>stored) → 200 e persiste next", async () => {
    getCredentialByIdMock.mockResolvedValue({ ...STORED_CRED, counter: 5 });
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "cred-1",
        newCounter: 6,
        userVerified: true,
        credentialBackedUp: false,
      },
    });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    expect(updateCredentialCounterMock).toHaveBeenCalledWith("cred-1", 6, expect.any(String));
  });
});

describe("POST /login/verify — autorização e emissão", () => {
  it("não-approved (pending/blocked) → 403, sem token nem update", async () => {
    getApprovedUserRoleMock.mockResolvedValue({ approved: false, role: "user" });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(403);
    expect(updateCredentialCounterMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("usuário inexistente no lookup → 403", async () => {
    getApprovedUserRoleMock.mockResolvedValue(null);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(403);
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it("sucesso → 200 com customToken; persiste counter+lastUsedAt; cookie limpo", async () => {
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.customToken).toBe("CUSTOM_TOKEN");
    expect(updateCredentialCounterMock).toHaveBeenCalledWith(
      "cred-1",
      1,
      expect.any(String),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("webauthn_challenge=");
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("custom token inclui o claim role do usuário (M1)", async () => {
    getApprovedUserRoleMock.mockResolvedValue({ approved: true, role: "admin" });
    await POST(req(VALID_BODY));
    expect(createCustomTokenMock).toHaveBeenCalledWith(UID, { role: "admin" });
  });

  it("role default 'user' quando o lookup devolve role 'user'", async () => {
    await POST(req(VALID_BODY));
    expect(createCustomTokenMock).toHaveBeenCalledWith(UID, { role: "user" });
  });

  it("uid vem da credencial resolvida (M5), nunca do body", async () => {
    await POST(req({ ...VALID_BODY, uid: "evil" }));
    expect(createCustomTokenMock).toHaveBeenCalledWith(UID, expect.anything());
  });
});
