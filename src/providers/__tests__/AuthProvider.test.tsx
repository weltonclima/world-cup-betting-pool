// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/providers/AuthProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import type { User } from "@/types";

// --- Mocks de Firebase (sem rede/emulador) ---------------------------------
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

const onAuthStateChangedMock = vi.mocked(onAuthStateChanged);
const getDocMock = vi.mocked(getDoc);

// Tipo do callback aceito por onAuthStateChanged.
type AuthCallback = (user: FirebaseUser | null) => void;

// Captura o callback registrado e o unsubscribe simulado.
let authCallback: AuthCallback;
const unsubscribeSpy = vi.fn();

// Perfil válido de exemplo (passa no userSchema).
const validProfile: User = {
  uid: "uid-123",
  name: "Fulano de Tal",
  nickname: "Fulano",
  email: "fulano@example.com",
  role: "user",
  status: "approved",
};

const fakeUser = { uid: "uid-123" } as FirebaseUser;

// Helper: monta um snapshot fake de getDoc.
function makeSnapshot(exists: boolean, data: unknown) {
  return {
    exists: () => exists,
    data: () => data,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

// Sonda que expõe o valor do contexto no DOM para asserções.
function ContextProbe() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return <div data-testid="no-context" />;
  }
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="firebaseUser">
        {ctx.firebaseUser ? ctx.firebaseUser.uid : "null"}
      </span>
      <span data-testid="profile">{ctx.profile ? ctx.profile.uid : "null"}</span>
      <span data-testid="status">{ctx.status ?? "null"}</span>
      <span data-testid="role">{ctx.role ?? "null"}</span>
      <span data-testid="error">{ctx.error ?? "null"}</span>
      {/* Dispara refreshProfile sob demanda para os testes de releitura manual. */}
      <button
        type="button"
        data-testid="refresh"
        onClick={() => {
          void ctx.refreshProfile();
        }}
      >
        refresh
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <ContextProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  unsubscribeSpy.mockClear();
  onAuthStateChangedMock.mockReset();
  getDocMock.mockReset();
  // Captura o callback e devolve o unsubscribe simulado.
  onAuthStateChangedMock.mockImplementation((_auth, nextOrObserver) => {
    authCallback = nextOrObserver as AuthCallback;
    return unsubscribeSpy;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("estado inicial: loading=true, firebaseUser=null, profile=null", () => {
    renderProvider();
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("firebaseUser").textContent).toBe("null");
    expect(screen.getByTestId("profile").textContent).toBe("null");
  });

  it("não autenticado: callback(null) → loading=false, sem perfil/erro", async () => {
    renderProvider();
    authCallback(null);

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("firebaseUser").textContent).toBe("null");
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("error").textContent).toBe("null");
  });

  it("autenticado + perfil OK: profile preenchido, status/role derivados", async () => {
    getDocMock.mockResolvedValue(makeSnapshot(true, validProfile));
    renderProvider();
    authCallback(fakeUser);

    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("uid-123");
    });
    expect(screen.getByTestId("firebaseUser").textContent).toBe("uid-123");
    expect(screen.getByTestId("status").textContent).toBe("approved");
    expect(screen.getByTestId("role").textContent).toBe("user");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toBe("null");
  });

  it("autenticado sem doc: error='not-found', profile=null", async () => {
    getDocMock.mockResolvedValue(makeSnapshot(false, undefined));
    renderProvider();
    authCallback(fakeUser);

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("not-found");
    });
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("autenticado parse-fail: error='parse-error', profile=null", async () => {
    getDocMock.mockResolvedValue(
      makeSnapshot(true, { uid: "uid-123", foo: "bar" }),
    );
    renderProvider();
    authCallback(fakeUser);

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("parse-error");
    });
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("erro de leitura: getDoc rejeita → error='fetch-error'", async () => {
    getDocMock.mockRejectedValue(new Error("network down"));
    renderProvider();
    authCallback(fakeUser);

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("fetch-error");
    });
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("unsubscribe é chamado ao desmontar", () => {
    const { unmount } = renderProvider();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("sem setState após desmontagem: getDoc resolve depois do unmount não atualiza estado", async () => {
    // Promessa controlada: resolve somente quando chamamos manualmente `resolveGetDoc`.
    let resolveGetDoc!: (value: Awaited<ReturnType<typeof getDoc>>) => void;
    const pendingSnapshot = new Promise<Awaited<ReturnType<typeof getDoc>>>(
      (res) => {
        resolveGetDoc = res;
      },
    );
    getDocMock.mockReturnValue(pendingSnapshot);

    const { unmount } = renderProvider();

    // Dispara resolveSession com um usuário autenticado; getDoc fica pendente.
    act(() => {
      authCallback(fakeUser);
    });

    // Desmonta o componente enquanto getDoc ainda não resolveu.
    unmount();

    // Resolve o getDoc APÓS a desmontagem — não deve lançar act warning nem alterar estado.
    await act(async () => {
      resolveGetDoc(makeSnapshot(true, validProfile));
      // Aguarda a microfila esvaziar.
      await Promise.resolve();
    });

    // Após desmontagem, o elemento não existe mais no DOM — sem setState.
    expect(screen.queryByTestId("profile")).toBeNull();
  });
});

describe("AuthProvider.refreshProfile", () => {
  const pendingProfile: User = { ...validProfile, status: "pending" };

  it("relê o perfil sob demanda: pending → approved", async () => {
    // Carga inicial: perfil pending.
    getDocMock.mockResolvedValue(makeSnapshot(true, pendingProfile));
    renderProvider();
    await act(async () => {
      authCallback(fakeUser);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("pending");
    });

    // O doc foi aprovado no Firestore — o próximo getDoc retorna approved.
    getDocMock.mockResolvedValue(makeSnapshot(true, validProfile));

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("approved");
    });
    expect(screen.getByTestId("profile").textContent).toBe("uid-123");
    expect(screen.getByTestId("error").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("no-op quando deslogado: não chama getDoc nem altera estado", async () => {
    renderProvider();
    await act(async () => {
      authCallback(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Zera o histórico para provar que refreshProfile não dispara leitura.
    getDocMock.mockClear();

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    expect(getDocMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("firebaseUser").textContent).toBe("null");
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("error").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("define error='not-found' se o doc sumiu na releitura", async () => {
    getDocMock.mockResolvedValue(makeSnapshot(true, validProfile));
    renderProvider();
    await act(async () => {
      authCallback(fakeUser);
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("uid-123");
    });

    // Doc não existe mais na releitura.
    getDocMock.mockResolvedValue(makeSnapshot(false, undefined));

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("not-found");
    });
    expect(screen.getByTestId("profile").textContent).toBe("null");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
