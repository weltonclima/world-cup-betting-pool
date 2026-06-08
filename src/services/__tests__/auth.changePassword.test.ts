import type { User as FirebaseUser } from "firebase/auth";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "@/services/auth";

// Mock isolado (este arquivo só exercita changePassword → reauth + updatePassword).
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: vi.fn(() => ({ __tag: "credential" })) },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
  // funções importadas por auth.ts mas não exercidas aqui:
  confirmPasswordReset: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
}));

const { currentUserRef } = vi.hoisted(() => ({
  currentUserRef: { value: null } as { value: Partial<FirebaseUser> | null },
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: {
    get currentUser() {
      return currentUserRef.value;
    },
  },
  firestore: { __tag: "firestore" },
}));

// Endpoint do session cookie não é tocado por changePassword; fetch stub por segurança.
vi.stubGlobal("fetch", vi.fn());

const credentialMock = vi.mocked(EmailAuthProvider.credential);
const reauthMock = vi.mocked(reauthenticateWithCredential);
const updatePasswordMock = vi.mocked(updatePassword);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserRef.value = { uid: "uid-1", email: "user@example.com" };
});

afterEach(() => {
  currentUserRef.value = null;
});

describe("changePassword", () => {
  it("reautentica com a senha atual ANTES de atualizar", async () => {
    const order: string[] = [];
    reauthMock.mockImplementation(async () => {
      order.push("reauth");
      return {} as never; // reauth resolve UserCredential — não usado pelo serviço
    });
    updatePasswordMock.mockImplementation(async () => {
      order.push("update");
    });

    await changePassword("Atual@1", "Nova@123");

    expect(credentialMock).toHaveBeenCalledWith("user@example.com", "Atual@1");
    expect(reauthMock).toHaveBeenCalledOnce();
    expect(updatePasswordMock).toHaveBeenCalledWith(
      currentUserRef.value,
      "Nova@123",
    );
    expect(order).toEqual(["reauth", "update"]);
  });

  it("propaga erro da reautenticação e NÃO atualiza a senha", async () => {
    reauthMock.mockRejectedValue({ code: "auth/wrong-password" });

    await expect(changePassword("Errada", "Nova@123")).rejects.toMatchObject({
      code: "auth/wrong-password",
    });
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("lança quando não há usuário autenticado", async () => {
    currentUserRef.value = null;
    await expect(changePassword("x", "Nova@123")).rejects.toThrow(
      "auth/no-current-user",
    );
    expect(reauthMock).not.toHaveBeenCalled();
  });
});
