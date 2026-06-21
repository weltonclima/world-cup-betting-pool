import type { User as FirebaseUser } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LAST_MINT_STORAGE_KEY,
  SESSION_RENEWAL_THROTTLE_MS,
  refreshSessionCookie,
  signIn,
  signOut,
} from "@/services/auth";

/**
 * Renovação deslizante do session cookie (TASK-02).
 *
 * Foco no comportamento de `refreshSessionCookie` (throttle, anti-imortal,
 * best-effort), na limpeza do timestamp no `signOut`, e no mint compartilhado
 * que o `signIn` também atualiza.
 */

// firebase/auth mockado (sem rede). Lista espelha o que auth.ts importa.
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
  EmailAuthProvider: { credential: vi.fn(() => ({ __tag: "credential" })) },
  onIdTokenChanged: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(),
}));

// Cleanup de push no signOut (web-push-pwa TASK-02): colaborador best-effort,
// stubbado para não puxar firebase/messaging (client real) no teste de auth.
vi.mock("@/features/push/registration", () => ({
  unregisterPush: vi.fn(() => Promise.resolve()),
}));

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
  authPersistenceReady: Promise.resolve(),
}));

const signInMock = vi.mocked(signInWithEmailAndPassword);
const signOutMock = vi.mocked(firebaseSignOut);
const fetchMock = vi.fn<typeof fetch>();

// localStorage in-memory (ambiente node não tem). Injetado via window.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, String(v));
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    }),
    clear: () => store.clear(),
    _store: store,
  };
}
let ls: ReturnType<typeof makeLocalStorage>;

const NOW = new Date("2026-06-09T12:00:00.000Z").getTime();

const fakeUser = { uid: "uid-123" } as FirebaseUser;
const fakeCredential = { user: fakeUser };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  signInMock.mockReset();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue(undefined);

  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue("fresh-id-token");
  currentUserRef.value = null;

  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  ls = makeLocalStorage();
  vi.stubGlobal("window", { localStorage: ls });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("refreshSessionCookie — guardas", () => {
  it("é no-op quando deslogado (sem getIdToken nem fetch)", async () => {
    currentUserRef.value = null;

    await refreshSessionCookie();

    expect(getIdTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-emite o cookie com token fresco quando fora da janela de throttle", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    // Sem timestamp prévio → fora da janela.

    await refreshSessionCookie();

    expect(getIdTokenMock).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ idToken: "fresh-id-token" }),
      }),
    );
    // Timestamp da última emissão = agora.
    expect(ls.setItem).toHaveBeenCalledWith(LAST_MINT_STORAGE_KEY, String(NOW));
  });
});

describe("refreshSessionCookie — throttle", () => {
  it("é no-op quando dentro da janela (emissão recente)", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    // Última emissão há 1h (< janela).
    ls._store.set(LAST_MINT_STORAGE_KEY, String(NOW - 60 * 60 * 1000));

    await refreshSessionCookie();

    expect(getIdTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-emite quando a última emissão é mais antiga que a janela", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    ls._store.set(
      LAST_MINT_STORAGE_KEY,
      String(NOW - SESSION_RENEWAL_THROTTLE_MS - 1),
    );

    await refreshSessionCookie();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ls.setItem).toHaveBeenCalledWith(LAST_MINT_STORAGE_KEY, String(NOW));
  });
});

describe("refreshSessionCookie — anti-imortal e best-effort", () => {
  it("anti-imortal: getIdToken rejeitando NÃO faz POST nem avança o timestamp", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    getIdTokenMock.mockRejectedValue(new Error("token revogado"));
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(refreshSessionCookie()).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(ls.setItem).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("best-effort: resposta não-ok NÃO lança e NÃO avança o timestamp", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(refreshSessionCookie()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ls.setItem).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("best-effort: fetch rejeitando NÃO lança", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    fetchMock.mockRejectedValue(new Error("rede caiu"));
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(refreshSessionCookie()).resolves.toBeUndefined();
    expect(ls.setItem).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("refreshSessionCookie — concorrência", () => {
  it("chamadas sobrepostas não disparam POSTs paralelos", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    // getIdToken pendente: segura a primeira chamada em andamento.
    let resolveToken!: (t: string) => void;
    getIdTokenMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveToken = resolve;
      }),
    );

    const p1 = refreshSessionCookie();
    const p2 = refreshSessionCookie();

    resolveToken("fresh-id-token");
    await Promise.all([p1, p2]);

    // Apenas uma emissão, apesar das duas chamadas.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("refreshSessionCookie — guarda SSR e robustez", () => {
  it("é no-op sem window (SSR/edge), mesmo logado", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    vi.stubGlobal("window", undefined);

    await refreshSessionCookie();

    expect(getIdTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("timestamp corrompido em localStorage é tratado como ausente (re-emite)", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    ls._store.set(LAST_MINT_STORAGE_KEY, "lixo-não-numérico");

    await refreshSessionCookie();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ls.setItem).toHaveBeenCalledWith(LAST_MINT_STORAGE_KEY, String(NOW));
  });

  it("localStorage.getItem lançando NÃO quebra a renovação (best-effort)", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };
    ls.getItem.mockImplementation(() => {
      throw new Error("storage acesso negado");
    });

    // getItem lançando → timestamp tratado como ausente → re-emite, sem lançar.
    await expect(refreshSessionCookie()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("libera o guard de concorrência: nova renovação ocorre após a janela", async () => {
    currentUserRef.value = { getIdToken: getIdTokenMock };

    // 1ª renovação (sem timestamp) → emite e grava NOW.
    await refreshSessionCookie();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Avança o relógio além da janela de throttle.
    vi.setSystemTime(NOW + SESSION_RENEWAL_THROTTLE_MS + 1);

    // 2ª renovação: guard liberado + fora da janela → emite de novo.
    await refreshSessionCookie();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("signOut — limpeza do throttle", () => {
  it("remove o timestamp de última emissão do localStorage", async () => {
    ls._store.set(LAST_MINT_STORAGE_KEY, String(NOW));

    await signOut();

    expect(ls.removeItem).toHaveBeenCalledWith(LAST_MINT_STORAGE_KEY);
  });
});

describe("signIn — mint compartilhado atualiza o timestamp", () => {
  it("após autenticar, grava o timestamp da emissão (reseta a janela)", async () => {
    signInMock.mockResolvedValue(fakeCredential as never);
    currentUserRef.value = { getIdToken: getIdTokenMock };

    await signIn("fulano@example.com", "secret123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST" }),
    );
    expect(ls.setItem).toHaveBeenCalledWith(LAST_MINT_STORAGE_KEY, String(NOW));
  });
});
