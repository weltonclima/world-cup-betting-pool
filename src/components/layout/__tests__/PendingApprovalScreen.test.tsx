// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "@/providers/AuthProvider";
import type { UserStatus } from "@/types";
import { PendingApprovalScreen } from "@/components/layout/PendingApprovalScreen";

// Controlador mutável do contexto de auth. `refreshProfile` muta `authState`,
// simulando a releitura do perfil; o componente re-renderiza (setState interno)
// e o useAuth mockado devolve o valor fresco no render seguinte.
interface AuthState {
  status: UserStatus | null;
  error: AuthContextValue["error"];
}

// vi.hoisted: os mocks abaixo são referenciados pelas fábricas de vi.mock, que
// são içadas para o topo do arquivo. Declarar via hoisted evita o TDZ.
const {
  pushMock,
  toastInfoMock,
  toastErrorMock,
  refreshProfileMock,
  signOutMock,
  authState,
} = vi.hoisted(() => ({
  pushMock: vi.fn<(href: string) => void>(),
  toastInfoMock: vi.fn<(message: string) => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  refreshProfileMock: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  signOutMock: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  authState: { status: "pending", error: null } as AuthState,
}));

// Router de next/navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Sonner (toasts).
vi.mock("sonner", () => ({
  toast: { info: toastInfoMock, error: toastErrorMock },
}));

// Serviço de auth: o componente chama `signOut()` (logout do botão Sair), que
// internamente limpa o session cookie (TASK-09) e desloga do Firebase Auth.
// Mockar o serviço evita validar env NEXT_PUBLIC_FIREBASE_* / fetch no load.
vi.mock("@/services/auth", () => ({
  signOut: signOutMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (): Pick<
    AuthContextValue,
    "refreshProfile" | "status" | "error"
  > => ({
    refreshProfile: refreshProfileMock,
    status: authState.status,
    error: authState.error,
  }),
}));

describe("PendingApprovalScreen", () => {
  beforeEach(() => {
    authState.status = "pending";
    authState.error = null;
    refreshProfileMock.mockReset();
    refreshProfileMock.mockResolvedValue(undefined);
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
    pushMock.mockReset();
    toastInfoMock.mockReset();
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza título e descrição da PRD-01", () => {
    render(<PendingApprovalScreen />);

    expect(
      screen.getByRole("heading", { name: "Aguardando Aprovação" }),
    ).toBeTruthy();
    expect(screen.getByText("Cadastro realizado!")).toBeTruthy();
    expect(
      screen.getByText(/Seu acesso está aguardando aprovação do administrador/i),
    ).toBeTruthy();
  });

  it("não promete email de aprovação (A6 — sem serviço de email)", () => {
    render(<PendingApprovalScreen />);

    expect(
      screen.queryByText(/Você receberá um email/i),
    ).toBeNull();
  });

  it("clicar em 'Sair' faz logout e redireciona para /login", async () => {
    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Sair/i }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("exibe toast de erro e reabilita o botão se o logout falhar", async () => {
    signOutMock.mockRejectedValueOnce(new Error("network"));

    render(<PendingApprovalScreen />);

    const sairButton = screen.getByRole("button", { name: /Sair/i });
    fireEvent.click(sairButton);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível sair. Tente novamente.",
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Sair/i }),
    ).not.toHaveProperty("disabled", true);
  });

  it("clicar em 'Atualizar Status' chama refreshProfile", async () => {
    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Status/i }));

    await waitFor(() => {
      expect(refreshProfileMock).toHaveBeenCalledTimes(1);
    });
  });

  it("redireciona para /home quando status vira 'approved' após o refresh", async () => {
    // Ao reler o perfil, o usuário passa a estar aprovado.
    refreshProfileMock.mockImplementation(() => {
      authState.status = "approved";
      return Promise.resolve();
    });

    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Status/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/home");
    });
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("exibe toast info quando continua 'pending' após o refresh", async () => {
    // refreshProfile mantém o status pending (default do authState).
    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Status/i }));

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledWith("Ainda aguardando aprovação.");
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("exibe toast de erro quando o refresh resulta em erro de perfil", async () => {
    refreshProfileMock.mockImplementation(() => {
      authState.error = "fetch-error";
      return Promise.resolve();
    });

    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Status/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível atualizar. Tente novamente.",
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("aplica área de toque ≥44px (h-11) no botão (MASTER §10.2)", () => {
    render(<PendingApprovalScreen />);

    const refreshButton = screen.getByRole("button", {
      name: /Atualizar status/i,
    });

    expect(refreshButton.className).toContain("h-11");
  });

  it("spinner respeita reduced-motion (motion-reduce:animate-none, MASTER §10.6)", () => {
    refreshProfileMock.mockImplementation(
      () =>
        // Promise nunca resolvida: mantém o estado "refreshing" para o spinner ficar visível.
        new Promise<void>(() => {}),
    );

    render(<PendingApprovalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Status/i }));

    // O spinner é um SVG (LoaderCircle); em SVGElement `className` é um
    // SVGAnimatedString, não string — usar getAttribute("class").
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
  });
});
