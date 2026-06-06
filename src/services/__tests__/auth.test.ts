import type { User as FirebaseUser, UserCredential } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn, signOut, signUp, type SignUpInput } from "@/services/auth";

// --- Mocks de Firebase (sem rede/emulador), espelhando AuthProvider.test.tsx ---
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: { __tag: "auth" },
  firestore: { __tag: "firestore" },
}));

const signInMock = vi.mocked(signInWithEmailAndPassword);
const createUserMock = vi.mocked(createUserWithEmailAndPassword);
const deleteUserMock = vi.mocked(deleteUser);
const signOutMock = vi.mocked(firebaseSignOut);
const docMock = vi.mocked(doc);
const setDocMock = vi.mocked(setDoc);

// Usuário fake do Firebase Auth.
const fakeUser = { uid: "uid-123" } as FirebaseUser;
const fakeCredential = { user: fakeUser } as UserCredential;

const validInput: SignUpInput = {
  name: "Fulano de Tal",
  nickname: "Fulano",
  email: "fulano@example.com",
  password: "secret123",
};

beforeEach(() => {
  signInMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  signOutMock.mockReset();
  docMock.mockReset();
  setDocMock.mockReset();
  docMock.mockReturnValue({} as ReturnType<typeof doc>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signIn", () => {
  it("chama signInWithEmailAndPassword com as credenciais", async () => {
    signInMock.mockResolvedValue(fakeCredential);

    await signIn("fulano@example.com", "secret123");

    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith(
      { __tag: "auth" },
      "fulano@example.com",
      "secret123",
    );
  });

  it("propaga o erro do Firebase sem traduzir", async () => {
    const error = Object.assign(new Error("bad creds"), {
      code: "auth/invalid-credential",
    });
    signInMock.mockRejectedValue(error);

    await expect(signIn("a@b.com", "wrongpass")).rejects.toBe(error);
  });
});

describe("signUp", () => {
  it("cria o usuário no Auth e grava o doc com role=user/status=pending", async () => {
    createUserMock.mockResolvedValue(fakeCredential);
    setDocMock.mockResolvedValue(undefined);

    await signUp(validInput);

    expect(createUserMock).toHaveBeenCalledWith(
      { __tag: "auth" },
      "fulano@example.com",
      "secret123",
    );
    expect(docMock).toHaveBeenCalledWith(
      { __tag: "firestore" },
      "users",
      "uid-123",
    );
    expect(setDocMock).toHaveBeenCalledTimes(1);

    const firstCall = setDocMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const writtenDoc = firstCall![1] as Record<string, unknown>;
    expect(writtenDoc).toMatchObject({
      uid: "uid-123",
      name: "Fulano de Tal",
      nickname: "Fulano",
      email: "fulano@example.com",
      role: "user",
      status: "pending",
    });
    // createdAt é uma ISO string válida.
    expect(typeof writtenDoc.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(writtenDoc.createdAt as string))).toBe(false);
    // Sem campos só-de-frontend.
    expect(writtenDoc).not.toHaveProperty("confirmPassword");
    expect(writtenDoc).not.toHaveProperty("acceptTerms");
    expect(writtenDoc).not.toHaveProperty("password");

    // Sucesso: rollback NÃO chamado.
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("faz rollback (deleteUser) e relança o erro quando setDoc falha", async () => {
    const setDocError = new Error("permission-denied");
    createUserMock.mockResolvedValue(fakeCredential);
    setDocMock.mockRejectedValue(setDocError);
    deleteUserMock.mockResolvedValue(undefined);

    await expect(signUp(validInput)).rejects.toBe(setDocError);

    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith(fakeUser);
  });

  it("loga e relança o erro original quando o próprio rollback falha", async () => {
    const setDocError = new Error("setDoc failed");
    const rollbackError = new Error("delete failed");
    createUserMock.mockResolvedValue(fakeCredential);
    setDocMock.mockRejectedValue(setDocError);
    deleteUserMock.mockRejectedValue(rollbackError);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Relança o erro ORIGINAL do setDoc, não o do rollback.
    await expect(signUp(validInput)).rejects.toBe(setDocError);

    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("não tenta gravar o doc se createUser falhar", async () => {
    const authError = Object.assign(new Error("email in use"), {
      code: "auth/email-already-in-use",
    });
    createUserMock.mockRejectedValue(authError);

    await expect(signUp(validInput)).rejects.toBe(authError);

    expect(setDocMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("chama signOut do Firebase com o auth", async () => {
    signOutMock.mockResolvedValue(undefined);

    await signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ __tag: "auth" });
  });
});
