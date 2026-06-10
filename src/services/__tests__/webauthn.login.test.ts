import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startAuthenticationMock } = vi.hoisted(() => ({
  startAuthenticationMock: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: startAuthenticationMock,
  startRegistration: vi.fn(),
}));

// webauthn.ts importa firestore na carga do módulo — mocks neutros (não usados aqui).
vi.mock("@/firebase", () => ({ firestore: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

import { PasskeyError, loginWithPasskey } from "@/services/webauthn";

const ASSERTION = { id: "cred-1", rawId: "cred-1", response: {}, type: "public-key" };

const fetchMock = vi.fn();

function ok(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}
function notOk(status = 400) {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  startAuthenticationMock.mockResolvedValue(ASSERTION);
});

afterEach(() => vi.clearAllMocks());

describe("loginWithPasskey", () => {
  it("options→startAuthentication→verify retorna o customToken", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ challenge: "CH" }))
      .mockResolvedValueOnce(ok({ verified: true, customToken: "TOKEN_123" }));

    const token = await loginWithPasskey();

    expect(token).toBe("TOKEN_123");
    expect(startAuthenticationMock).toHaveBeenCalledWith({
      optionsJSON: { challenge: "CH" },
    });
    // verify recebe a assertion sob `response`.
    const verifyBody = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(verifyBody.response.id).toBe("cred-1");
  });

  it("options !ok → PasskeyError genérico, sem cerimônia", async () => {
    fetchMock.mockResolvedValueOnce(notOk(500));
    await expect(loginWithPasskey()).rejects.toBeInstanceOf(PasskeyError);
    expect(startAuthenticationMock).not.toHaveBeenCalled();
  });

  it("NotAllowedError (cancelou/timeout) → PasskeyError code 'cancelled'", async () => {
    fetchMock.mockResolvedValueOnce(ok({ challenge: "CH" }));
    startAuthenticationMock.mockRejectedValue(
      Object.assign(new Error("x"), { name: "NotAllowedError" }),
    );

    await expect(loginWithPasskey()).rejects.toMatchObject({
      name: "PasskeyError",
      code: "cancelled",
    });
  });

  it("verify !ok → PasskeyError genérico", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ challenge: "CH" }))
      .mockResolvedValueOnce(notOk(401));
    await expect(loginWithPasskey()).rejects.toBeInstanceOf(PasskeyError);
  });

  it("verify ok mas sem customToken → PasskeyError genérico", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ challenge: "CH" }))
      .mockResolvedValueOnce(ok({ verified: true }));
    await expect(loginWithPasskey()).rejects.toBeInstanceOf(PasskeyError);
  });
});
