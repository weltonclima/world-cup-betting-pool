// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

// --- Mocks ------------------------------------------------------------------
const { sendPasswordResetMock, toastErrorMock } = vi.hoisted(() => ({
  sendPasswordResetMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  sendPasswordReset: sendPasswordResetMock,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastErrorMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

function getEmailInput(): HTMLInputElement {
  return screen.getByLabelText("E-mail") as HTMLInputElement;
}

function getSubmitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /enviar link/i }) as HTMLButtonElement;
}

beforeEach(() => {
  sendPasswordResetMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ForgotPasswordForm", () => {
  it("e-mail inválido bloqueia o submit e exibe validação inline", async () => {
    render(<ForgotPasswordForm />);

    fireEvent.change(getEmailInput(), { target: { value: "nao-e-email" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText("E-mail inválido.")).toBeTruthy();
    });
    expect(sendPasswordResetMock).not.toHaveBeenCalled();
  });

  it("submit válido chama sendPasswordReset e mostra a confirmação com o e-mail", async () => {
    sendPasswordResetMock.mockResolvedValueOnce(undefined);
    render(<ForgotPasswordForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(sendPasswordResetMock).toHaveBeenCalledWith("user@example.com");
    });
    // Transição para o estado "enviado" (tela 03).
    await waitFor(() => {
      expect(screen.getByText("Email enviado!")).toBeTruthy();
    });
    // E-mail digitado é exibido na confirmação.
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("erro do serviço dispara toast.error traduzido e permanece no form", async () => {
    sendPasswordResetMock.mockRejectedValueOnce({
      code: "auth/too-many-requests",
    });
    render(<ForgotPasswordForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      );
    });
    // Não transicionou para a confirmação.
    expect(screen.queryByText("Email enviado!")).toBeNull();
  });

  it("erro sem código usa a mensagem genérica de fallback", async () => {
    sendPasswordResetMock.mockRejectedValueOnce(new Error("boom"));
    render(<ForgotPasswordForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Ocorreu um erro inesperado. Tente novamente.",
      );
    });
  });

  it("renderiza o link 'Voltar para o login' apontando para /login", () => {
    render(<ForgotPasswordForm />);

    const link = screen.getByRole("link", { name: "Voltar para o login" });
    expect(link.getAttribute("href")).toBe("/login");
  });
});
