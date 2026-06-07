// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "@/providers/AuthProvider";
import type { UserStatus } from "@/types";
import AuthLayout from "@/app/(auth)/layout";

interface AuthState {
  loading: boolean;
  firebaseUser: { uid: string } | null;
  status: UserStatus | null;
}

const { pushMock, authState, pathState } = vi.hoisted(() => ({
  pushMock: vi.fn<(href: string) => void>(),
  authState: {
    loading: false,
    firebaseUser: null,
    status: null,
  } as AuthState,
  pathState: { value: "/login" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathState.value,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (): Pick<
    AuthContextValue,
    "loading" | "firebaseUser" | "status"
  > => ({
    loading: authState.loading,
    firebaseUser: authState.firebaseUser as AuthContextValue["firebaseUser"],
    status: authState.status,
  }),
}));

// Telas auxiliares: marcadores simples para asserção.
vi.mock("@/components/layout/LoadingScreen", () => ({
  LoadingScreen: () => <div>LOADING</div>,
}));
vi.mock("@/components/layout/BlockedScreen", () => ({
  BlockedScreen: () => <div>BLOCKED</div>,
}));

beforeEach(() => {
  authState.loading = false;
  authState.firebaseUser = null;
  authState.status = null;
  pathState.value = "/login";
  pushMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthLayout", () => {
  it("loading → LoadingScreen, sem redirect nem children", () => {
    authState.loading = true;

    render(
      <AuthLayout>
        <div>LOGIN</div>
      </AuthLayout>,
    );

    expect(screen.getByText("LOADING")).toBeTruthy();
    expect(screen.queryByText("LOGIN")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("deslogado → renderiza children (tela de login)", () => {
    authState.firebaseUser = null;

    render(
      <AuthLayout>
        <div>LOGIN</div>
      </AuthLayout>,
    );

    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("approved no /login → redireciona /home, sem children", async () => {
    authState.firebaseUser = { uid: "u1" };
    authState.status = "approved";

    render(
      <AuthLayout>
        <div>LOGIN</div>
      </AuthLayout>,
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    expect(screen.queryByText("LOGIN")).toBeNull();
  });

  it("pending no /login → redireciona /pending, sem children (regressão)", async () => {
    authState.firebaseUser = { uid: "u1" };
    authState.status = "pending";
    pathState.value = "/login";

    render(
      <AuthLayout>
        <div>LOGIN</div>
      </AuthLayout>,
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/pending"));
    expect(screen.queryByText("LOGIN")).toBeNull();
  });

  it("pending JÁ em /pending → renderiza children, sem redirect", () => {
    authState.firebaseUser = { uid: "u1" };
    authState.status = "pending";
    pathState.value = "/pending";

    render(
      <AuthLayout>
        <div>PENDING_SCREEN</div>
      </AuthLayout>,
    );

    expect(screen.getByText("PENDING_SCREEN")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("autenticado com status null (perfil inválido) → BlockedScreen", () => {
    authState.firebaseUser = { uid: "u1" };
    authState.status = null;

    render(
      <AuthLayout>
        <div>LOGIN</div>
      </AuthLayout>,
    );

    expect(screen.getByText("BLOCKED")).toBeTruthy();
    expect(screen.queryByText("LOGIN")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
