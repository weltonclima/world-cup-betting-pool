// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

// --- Mocks ------------------------------------------------------------------
const {
  verifyResetCodeMock,
  confirmResetMock,
  toastErrorMock,
  searchParamsMock,
} = vi.hoisted(() => ({
  verifyResetCodeMock: vi.fn(),
  confirmResetMock: vi.fn(),
  toastErrorMock: vi.fn(),
  searchParamsMock: { get: vi.fn() },
}));

vi.mock("@/services/auth", () => ({
  verifyResetCode: verifyResetCodeMock,
  confirmReset: confirmResetMock,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastErrorMock }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock,
}));

/** Configura os params lidos pelo componente para um teste. */
function setParams(values: Record<string, string | null>) {
  searchParamsMock.get.mockImplementation((key: string) => values[key] ?? null);
}

function getPasswordInput(): HTMLInputElement {
  return screen.getByLabelText("Nova senha") as HTMLInputElement;
}

function getConfirmInput(): HTMLInputElement {
  return screen.getByLabelText("Confirmar nova senha") as HTMLInputElement;
}

function getSubmit(): HTMLButtonElement {
  return screen.getByRole("button", { name: /redefinir senha/i }) as HTMLButtonElement;
}

beforeEach(() => {
  verifyResetCodeMock.mockReset();
  confirmResetMock.mockReset();
  toastErrorMock.mockReset();
  searchParamsMock.get.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ResetPasswordForm › validação do oobCode", () => {
  it("sem oobCode → estado inválido (não chama verifyResetCode)", async () => {
    setParams({ oobCode: null, mode: null });
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText("Link inválido ou expirado")).toBeTruthy();
    });
    expect(verifyResetCodeMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Solicitar novo link" }).getAttribute("href"),
    ).toBe("/esqueci-senha");
  });

  it("oobCode válido → estado válido (renderiza o form)", async () => {
    setParams({ oobCode: "good-code", mode: "resetPassword" });
    verifyResetCodeMock.mockResolvedValueOnce("user@example.com");
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText("Definir nova senha")).toBeTruthy();
    });
    expect(verifyResetCodeMock).toHaveBeenCalledWith("good-code");
  });

  it("oobCode expirado/inválido → estado inválido", async () => {
    setParams({ oobCode: "old-code", mode: "resetPassword" });
    verifyResetCodeMock.mockRejectedValueOnce({ code: "auth/expired-action-code" });
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText("Link inválido ou expirado")).toBeTruthy();
    });
  });
});

describe("ResetPasswordForm › submit", () => {
  beforeEach(() => {
    setParams({ oobCode: "good-code", mode: "resetPassword" });
    verifyResetCodeMock.mockResolvedValue("user@example.com");
  });

  it("senha que não atende às regras bloqueia o submit", async () => {
    render(<ResetPasswordForm />);
    await waitFor(() => screen.getByText("Definir nova senha"));

    fireEvent.change(getPasswordInput(), { target: { value: "abc" } });
    fireEvent.change(getConfirmInput(), { target: { value: "abc" } });
    fireEvent.click(getSubmit());

    await waitFor(() => {
      expect(
        screen.getByText("A senha deve ter pelo menos 8 caracteres."),
      ).toBeTruthy();
    });
    expect(confirmResetMock).not.toHaveBeenCalled();
  });

  it("senha válida chama confirmReset e vai para o estado de sucesso", async () => {
    confirmResetMock.mockResolvedValueOnce(undefined);
    render(<ResetPasswordForm />);
    await waitFor(() => screen.getByText("Definir nova senha"));

    fireEvent.change(getPasswordInput(), { target: { value: "abcd1234" } });
    fireEvent.change(getConfirmInput(), { target: { value: "abcd1234" } });
    fireEvent.click(getSubmit());

    await waitFor(() => {
      expect(confirmResetMock).toHaveBeenCalledWith("good-code", "abcd1234");
    });
    await waitFor(() => {
      expect(screen.getByText("Senha alterada com sucesso!")).toBeTruthy();
    });
    expect(
      screen.getByRole("link", { name: "Ir para o login" }).getAttribute("href"),
    ).toBe("/login");
  });

  it("erro do confirmReset dispara toast.error traduzido", async () => {
    confirmResetMock.mockRejectedValueOnce({ code: "auth/invalid-action-code" });
    render(<ResetPasswordForm />);
    await waitFor(() => screen.getByText("Definir nova senha"));

    fireEvent.change(getPasswordInput(), { target: { value: "abcd1234" } });
    fireEvent.change(getConfirmInput(), { target: { value: "abcd1234" } });
    fireEvent.click(getSubmit());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "O link de redefinição é inválido. Solicite um novo.",
      );
    });
    expect(screen.queryByText("Senha alterada com sucesso!")).toBeNull();
  });
});
