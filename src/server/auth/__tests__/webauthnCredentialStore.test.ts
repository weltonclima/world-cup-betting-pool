import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getFirestoreMock } = vi.hoisted(() => ({ getFirestoreMock: vi.fn() }));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

import {
  CredentialAlreadyExistsError,
  deleteCredential,
  getCredentialById,
  listCredentialsByUid,
  publicKeyFromStorage,
  publicKeyToStorage,
  saveCredential,
  updateCredentialCounter,
} from "@/server/auth/webauthnCredentialStore";

const validCred = {
  credentialId: "cred-1",
  uid: "uid-1",
  publicKey: "cHVibGljLWtleQ",
  counter: 0,
  transports: ["internal"],
  deviceLabel: "iPhone",
  createdAt: "2026-06-09T12:00:00.000Z",
};

function makeFs({
  docData = null as Record<string, unknown> | null,
  queryDocs = [] as Record<string, unknown>[],
  createError = null as { code?: number } | null,
} = {}) {
  const createMock = createError
    ? vi.fn().mockRejectedValue(createError)
    : vi.fn().mockResolvedValue(undefined);
  const docGet = vi
    .fn()
    .mockResolvedValue(
      docData ? { exists: true, data: () => docData } : { exists: false },
    );
  const deleteMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn(() => ({
    get: docGet,
    create: createMock,
    delete: deleteMock,
    update: updateMock,
  }));
  const whereGet = vi
    .fn()
    .mockResolvedValue({ docs: queryDocs.map((d) => ({ data: () => d })) });
  const whereMock = vi.fn(() => ({ get: whereGet }));
  const collectionMock = vi.fn(() => ({ doc: docMock, where: whereMock }));
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
  return { createMock, deleteMock, updateMock, docMock, whereMock, collectionMock };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("publicKey conversão base64url ↔ Uint8Array", () => {
  it("round-trip preserva os bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 200, 250, 255]);
    const stored = publicKeyToStorage(bytes);
    expect(typeof stored).toBe("string");
    expect(Array.from(publicKeyFromStorage(stored))).toEqual(
      Array.from(bytes),
    );
  });
});

describe("saveCredential", () => {
  it("valida o schema e CRIA no doc id = credentialId (create, não set)", async () => {
    const { createMock, docMock, collectionMock } = makeFs();
    await saveCredential(validCred);
    expect(collectionMock).toHaveBeenCalledWith("webauthn_credentials");
    expect(docMock).toHaveBeenCalledWith("cred-1");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita credencial inválida (counter negativo) sem gravar", async () => {
    const { createMock } = makeFs();
    await expect(
      saveCredential({ ...validCred, counter: -1 }),
    ).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("colisão de credentialId (ALREADY_EXISTS) → CredentialAlreadyExistsError (anti-overwrite cross-user)", async () => {
    makeFs({ createError: { code: 6 } });
    await expect(saveCredential(validCred)).rejects.toBeInstanceOf(
      CredentialAlreadyExistsError,
    );
  });

  it("outros erros do Firestore propagam (não mascarados)", async () => {
    makeFs({ createError: { code: 13 } });
    await expect(saveCredential(validCred)).rejects.not.toBeInstanceOf(
      CredentialAlreadyExistsError,
    );
  });
});

describe("getCredentialById", () => {
  it("retorna a credencial quando existe", async () => {
    makeFs({ docData: validCred });
    const cred = await getCredentialById("cred-1");
    expect(cred?.credentialId).toBe("cred-1");
  });

  it("retorna null quando não existe", async () => {
    makeFs({ docData: null });
    expect(await getCredentialById("missing")).toBeNull();
  });

  it("retorna null quando o doc armazenado é inválido (corrompido)", async () => {
    // Doc existe mas não bate com o schema (counter negativo) → não confiar.
    makeFs({ docData: { ...validCred, counter: -5 } });
    expect(await getCredentialById("cred-1")).toBeNull();
  });
});

describe("deleteCredential", () => {
  it("deleta o doc pelo credentialId (by-id)", async () => {
    const { docMock, deleteMock, collectionMock } = makeFs();
    await deleteCredential("cred-1");
    expect(collectionMock).toHaveBeenCalledWith("webauthn_credentials");
    expect(docMock).toHaveBeenCalledWith("cred-1");
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("updateCredentialCounter", () => {
  it("atualiza counter + lastUsedAt no doc by-id (anti-clonagem, TASK-07)", async () => {
    const { updateMock, docMock, collectionMock } = makeFs();
    await updateCredentialCounter("cred-1", 7, "2026-06-10T10:00:00.000Z");
    expect(collectionMock).toHaveBeenCalledWith("webauthn_credentials");
    expect(docMock).toHaveBeenCalledWith("cred-1");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]![0]).toMatchObject({
      counter: 7,
      lastUsedAt: "2026-06-10T10:00:00.000Z",
    });
  });

  it("rejeita counter negativo sem gravar", async () => {
    const { updateMock } = makeFs();
    await expect(
      updateCredentialCounter("cred-1", -1, "2026-06-10T10:00:00.000Z"),
    ).rejects.toThrow();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("listCredentialsByUid", () => {
  it("consulta por uid e mapeia os docs", async () => {
    const { whereMock } = makeFs({ queryDocs: [validCred] });
    const list = await listCredentialsByUid("uid-1");
    expect(whereMock).toHaveBeenCalledWith("uid", "==", "uid-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.credentialId).toBe("cred-1");
  });
});
