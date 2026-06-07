// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/auth/LoginForm";

// --- Mocks ------------------------------------------------------------------
// vi.hoisted: as fns são referenciadas dentro das factories de vi.mock,
// que são içadas para o topo do módulo.
const { signInMock, toastErrorMock, toastMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  signIn: signInMock,
}));

vi.mock("sonner", () => {
  const toast = Object.assign(toastMock, { error: toastErrorMock });
  return { toast };
});

// next/navigation não é exercitado diretamente (não navegamos manualmente),
// mas o Link/router pode tocá-lo — mock defensivo.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// Helpers de seleção dos campos por rótulo associado (FormLabel htmlFor).
function getEmailInput(): HTMLInputElement {
  return screen.getByLabelText("E-mail") as HTMLInputElement;
}

function getPasswordInput(): HTMLInputElement {
  return screen.getByLabelText("Senha") as HTMLInputElement;
}

function getSubmitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /entrar/i }) as HTMLButtonElement;
}

beforeEach(() => {
  signInMock.mockReset();
  toastErrorMock.mockReset();
  toastMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("e-mail inválido bloqueia o submit e exibe mensagem de validação", async () => {
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "nao-e-email" } });
    fireEvent.change(getPasswordInput(), { target: { value: "123456" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText("E-mail inválido.")).toBeTruthy();
    });

    expect(signInMock).not.toHaveBeenCalled();
  });

  it("senha curta bloqueia o submit e exibe mensagem de validação", async () => {
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.getByText("A senha deve ter pelo menos 6 caracteres."),
      ).toBeTruthy();
    });

    expect(signInMock).not.toHaveBeenCalled();
  });

  it("submit válido chama signIn com e-mail e senha", async () => {
    signInMock.mockResolvedValueOnce(undefined);
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "secret123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledTimes(1);
    });
    expect(signInMock).toHaveBeenCalledWith("user@example.com", "secret123");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("falha de signIn dispara toast.error com mensagem traduzida (R6)", async () => {
    signInMock.mockRejectedValueOnce({ code: "auth/invalid-credential" });
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "secret123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock).toHaveBeenCalledWith("E-mail ou senha inválidos.");
  });

  it("erro sem código usa a mensagem genérica de fallback", async () => {
    signInMock.mockRejectedValueOnce(new Error("boom"));
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "secret123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Ocorreu um erro inesperado. Tente novamente.",
      );
    });
  });

  it("não renderiza o link 'Cadastre-se' (pertence ao footer da página)", () => {
    render(<LoginForm />);

    expect(screen.queryByRole("link", { name: "Cadastre-se" })).toBeNull();
  });

  it("'Esqueci minha senha' é um link para /forgot-password (PRD-01.1)", () => {
    render(<LoginForm />);

    const forgot = screen.getByRole("link", {
      name: "Esqueci minha senha",
    });
    expect(forgot.getAttribute("href")).toBe("/forgot-password");
    // Não é mais um placeholder com toast.
    expect(toastMock).not.toHaveBeenCalled();
  });
});
