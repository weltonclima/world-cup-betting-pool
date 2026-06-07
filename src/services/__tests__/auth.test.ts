import type { User as FirebaseUser, UserCredential } from "firebase/auth";
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  verifyPasswordResetCode,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmReset,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  verifyResetCode,
  type SignUpInput,
} from "@/services/auth";

// --- Mocks de Firebase (sem rede/emulador), espelhando AuthProvider.test.tsx ---
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(),
}));

// currentUser.getIdToken usado por signIn para criar o session cookie (TASK-09).
// Hoisted: referenciado pela fábrica de vi.mock("@/firebase") (içada ao topo).
const { getIdTokenMock, currentUserRef } = vi.hoisted(() => ({
  getIdTokenMock: vi.fn<(forceRefresh?: boolean) => Promise<string>>(),
  currentUserRef: { value: null } as {
    value: { getIdToken: ReturnType<typeof vi.fn> } | null;
  },
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: {
    __tag: "auth",
    get currentUser() {
      return currentUserRef.value;
    },
  },
  firestore: { __tag: "firestore" },
}));

const signInMock = vi.mocked(signInWithEmailAndPassword);
const createUserMock = vi.mocked(createUserWithEmailAndPassword);
const deleteUserMock = vi.mocked(deleteUser);
const signOutMock = vi.mocked(firebaseSignOut);
const docMock = vi.mocked(doc);
const setDocMock = vi.mocked(setDoc);
const sendResetMock = vi.mocked(sendPasswordResetEmail);
const verifyCodeMock = vi.mocked(verifyPasswordResetCode);
const confirmResetMock = vi.mocked(confirmPasswordReset);

// Usuário fake do Firebase Auth.
const fakeUser = { uid: "uid-123" } as FirebaseUser;
const fakeCredential = { user: fakeUser } as UserCredential;

const validInput: SignUpInput = {
  name: "Fulano de Tal",
  nickname: "Fulano",
  email: "fulano@example.com",
  password: "secret123",
};

// fetch global mockado: signIn/signOut chamam /api/auth/session (TASK-09).
// Best-effort no código; aqui controlamos para asserções determinísticas.
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  signInMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  signOutMock.mockReset();
  docMock.mockReset();
  setDocMock.mockReset();
  sendResetMock.mockReset();
  verifyCodeMock.mockReset();
  confirmResetMock.mockReset();
  docMock.mockReturnValue({} as ReturnType<typeof doc>);

  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue("fresh-id-token");
  currentUserRef.value = null;
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
      expect.objectContaining({ __tag: "auth" }),
      "fulano@example.com",
      "secret123",
    );
  });

  it("cria o session cookie (POST /api/auth/session) com idToken fresco", async () => {
    signInMock.mockResolvedValue(fakeCredential);
    currentUserRef.value = { getIdToken: getIdTokenMock };

    await signIn("fulano@example.com", "secret123");

    // getIdToken(true): força refresh p/ carregar o custom claim role (TASK-08).
    expect(getIdTokenMock).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ idToken: "fresh-id-token" }),
      }),
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
      expect.objectContaining({ __tag: "auth" }),
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
  it("limpa o session cookie (DELETE) e chama signOut do Firebase", async () => {
    signOutMock.mockResolvedValue(undefined);

    await signOut();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      method: "DELETE",
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith(
      expect.objectContaining({ __tag: "auth" }),
    );
  });
});

describe("sendPasswordReset", () => {
  it("chama sendPasswordResetEmail com o auth e o e-mail", async () => {
    sendResetMock.mockResolvedValue(undefined);

    await sendPasswordReset("fulano@example.com");

    expect(sendResetMock).toHaveBeenCalledTimes(1);
    expect(sendResetMock).toHaveBeenCalledWith(
      expect.objectContaining({ __tag: "auth" }),
      "fulano@example.com",
    );
  });

  it("resolve silenciosamente quando o e-mail não existe (anti-enumeração R3)", async () => {
    const error = Object.assign(new Error("not found"), {
      code: "auth/user-not-found",
    });
    sendResetMock.mockRejectedValue(error);

    await expect(sendPasswordReset("naoexiste@example.com")).resolves.toBeUndefined();
  });

  it("propaga outros erros do Firebase", async () => {
    const error = Object.assign(new Error("rate limit"), {
      code: "auth/too-many-requests",
    });
    sendResetMock.mockRejectedValue(error);

    await expect(sendPasswordReset("a@b.com")).rejects.toBe(error);
  });
});

describe("verifyResetCode", () => {
  it("chama verifyPasswordResetCode e resolve o e-mail retornado", async () => {
    verifyCodeMock.mockResolvedValue("fulano@example.com");

    const email = await verifyResetCode("oob-code-123");

    expect(verifyCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ __tag: "auth" }),
      "oob-code-123",
    );
    expect(email).toBe("fulano@example.com");
  });

  it("propaga erro de código expirado", async () => {
    const error = Object.assign(new Error("expired"), {
      code: "auth/expired-action-code",
    });
    verifyCodeMock.mockRejectedValue(error);

    await expect(verifyResetCode("velho")).rejects.toBe(error);
  });
});

describe("confirmReset", () => {
  it("chama confirmPasswordReset com oobCode e nova senha", async () => {
    confirmResetMock.mockResolvedValue(undefined);

    await confirmReset("oob-code-123", "novaSenha1");

    expect(confirmResetMock).toHaveBeenCalledTimes(1);
    expect(confirmResetMock).toHaveBeenCalledWith(
      expect.objectContaining({ __tag: "auth" }),
      "oob-code-123",
      "novaSenha1",
    );
  });

  it("propaga erro de código inválido", async () => {
    const error = Object.assign(new Error("invalid"), {
      code: "auth/invalid-action-code",
    });
    confirmResetMock.mockRejectedValue(error);

    await expect(confirmReset("ruim", "novaSenha1")).rejects.toBe(error);
  });
});
