import { startRegistration } from "@simplewebauthn/browser";
import { getDocs } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PasskeyError,
  listMyPasskeys,
  registerPasskey,
  revokePasskey,
} from "@/services/webauthn";

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({ firestore: { __tag: "firestore" } }));

const startRegistrationMock = vi.mocked(startRegistration);
const getDocsMock = vi.mocked(getDocs);
const fetchMock = vi.fn<typeof fetch>();

const REG_RESPONSE = { id: "cred-1", type: "public-key" };

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset(); // limpa a fila de mockResolvedValueOnce entre testes
  vi.stubGlobal("fetch", fetchMock);
  // options ok → verify ok (sucesso por padrão)
  fetchMock
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ challenge: "CH" }), { status: 200 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 201 }));
  startRegistrationMock.mockResolvedValue(REG_RESPONSE as never);
});

afterEach(() => vi.unstubAllGlobals());

describe("registerPasskey", () => {
  it("orquestra options → startRegistration → verify", async () => {
    await registerPasskey("iPhone");
    expect(startRegistrationMock).toHaveBeenCalledWith({
      optionsJSON: { challenge: "CH" },
    });
    // 2ª chamada do fetch = verify, com o response + deviceLabel.
    const verifyCall = fetchMock.mock.calls[1]!;
    expect(verifyCall[0]).toContain("/register/verify");
    expect(JSON.parse((verifyCall[1] as RequestInit).body as string)).toEqual({
      response: REG_RESPONSE,
      deviceLabel: "iPhone",
    });
  });

  it("options não-ok → PasskeyError", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(registerPasskey()).rejects.toBeInstanceOf(PasskeyError);
    expect(startRegistrationMock).not.toHaveBeenCalled();
  });

  it("cancelamento (NotAllowedError) → code 'cancelled'", async () => {
    startRegistrationMock.mockRejectedValue(
      Object.assign(new Error("x"), { name: "NotAllowedError" }),
    );
    await expect(registerPasskey()).rejects.toMatchObject({
      code: "cancelled",
    });
  });

  it("InvalidStateError → code 'exists'", async () => {
    startRegistrationMock.mockRejectedValue(
      Object.assign(new Error("x"), { name: "InvalidStateError" }),
    );
    await expect(registerPasskey()).rejects.toMatchObject({ code: "exists" });
  });

  it("verify 409 → code 'exists'", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: "CH" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(registerPasskey()).rejects.toMatchObject({ code: "exists" });
  });

  it("verify falha genérica → PasskeyError", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: "CH" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 422 }));
    await expect(registerPasskey()).rejects.toBeInstanceOf(PasskeyError);
  });
});

describe("revokePasskey", () => {
  it("chama DELETE no endpoint da credencial", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await revokePasskey("cred-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/webauthn/credentials/cred-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("resposta não-ok → PasskeyError", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(revokePasskey("cred-1")).rejects.toBeInstanceOf(PasskeyError);
  });

  it("404 = remoção idempotente (não lança)", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(revokePasskey("cred-1")).resolves.toBeUndefined();
  });
});

describe("listMyPasskeys", () => {
  it("mapeia e descarta docs inválidos", async () => {
    const valid = {
      credentialId: "cred-1",
      uid: "uid-1",
      publicKey: "pk",
      counter: 0,
      createdAt: "2026-06-09T12:00:00.000Z",
    };
    getDocsMock.mockResolvedValue({
      forEach: (cb: (d: { data: () => unknown }) => void) => {
        cb({ data: () => valid });
        cb({ data: () => ({ broken: true }) }); // inválido → descartado
      },
    } as never);

    const list = await listMyPasskeys("uid-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.credentialId).toBe("cred-1");
  });
});
