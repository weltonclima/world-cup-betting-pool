import { NextResponse, type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireApprovedUserMock,
  getCredentialByIdMock,
  deleteCredentialMock,
} = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  getCredentialByIdMock: vi.fn(),
  deleteCredentialMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));

vi.mock("@/server/auth/webauthnCredentialStore", () => ({
  getCredentialById: getCredentialByIdMock,
  deleteCredential: deleteCredentialMock,
}));

vi.mock("@/server/auth/webauthnConfig", () => ({
  webauthnConfig: { origin: "http://localhost:3000", rpID: "localhost" },
}));

import { DELETE } from "@/app/api/auth/webauthn/credentials/[credentialId]/route";

const UID = "uid-1";

function req(origin: string | null = "http://localhost:3000"): NextRequest {
  return new Request(
    "http://localhost/api/auth/webauthn/credentials/cred-1",
    { method: "DELETE", headers: origin ? { origin } : {} },
  ) as unknown as NextRequest;
}

function ctx(credentialId = "cred-1") {
  return { params: Promise.resolve({ credentialId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedUserMock.mockResolvedValue({
    user: { uid: UID, email: "a@x.com", nickname: "a" },
  });
  getCredentialByIdMock.mockResolvedValue({
    credentialId: "cred-1",
    uid: UID,
    publicKey: "pk",
    counter: 0,
    createdAt: "2026-06-09T12:00:00.000Z",
  });
  deleteCredentialMock.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe("DELETE /api/auth/webauthn/credentials/[credentialId]", () => {
  it("403 quando Origin não casa (CSRF), sem auth/delete", async () => {
    const res = await DELETE(req("https://evil.com"), ctx());
    expect(res.status).toBe(403);
    expect(requireApprovedUserMock).not.toHaveBeenCalled();
    expect(deleteCredentialMock).not.toHaveBeenCalled();
  });

  it("propaga erro de auth (401/403)", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "x" }, { status: 401 }),
    });
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(401);
    expect(deleteCredentialMock).not.toHaveBeenCalled();
  });

  it("404 quando a credencial não existe", async () => {
    getCredentialByIdMock.mockResolvedValue(null);
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(404);
    expect(deleteCredentialMock).not.toHaveBeenCalled();
  });

  it("404 ao tentar remover credencial de OUTRO usuário (ownership)", async () => {
    getCredentialByIdMock.mockResolvedValue({
      credentialId: "cred-1",
      uid: "OUTRO_USUARIO",
      publicKey: "pk",
      counter: 0,
      createdAt: "2026-06-09T12:00:00.000Z",
    });
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(404);
    expect(deleteCredentialMock).not.toHaveBeenCalled();
  });

  it("remove a própria credencial → 200", async () => {
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(200);
    expect(deleteCredentialMock).toHaveBeenCalledWith("cred-1");
  });

  it("erro do Admin SDK ao deletar → 500", async () => {
    deleteCredentialMock.mockRejectedValue(new Error("firestore down"));
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(500);
  });
});
