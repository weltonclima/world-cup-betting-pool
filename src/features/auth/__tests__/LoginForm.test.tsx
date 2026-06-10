// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks -----------------------------------------------------------
const { signInMock, setIntentMock, toastError, toastMock, hasHintMock, supportMock } =
  vi.hoisted(() => ({
    signInMock: vi.fn(),
    setIntentMock: vi.fn(),
    toastError: vi.fn(),
    toastMock: vi.fn(),
    hasHintMock: vi.fn(),
    supportMock: vi.fn(),
  }));

vi.mock("@/services/auth", () => ({ signIn: signInMock }));

vi.mock("sonner", () => {
  const toast = Object.assign(toastMock, { error: toastError });
  return { toast };
});

vi.mock("@/features/passkeys/lib/loginBiometricIntent", () => ({
  setBiometricIntent: setIntentMock,
}));

vi.mock("@/features/passkeys/lib/passkeyHint", () => ({
  hasPasskeyHint: hasHintMock,
}));

vi.mock("@/features/passkeys/hooks", () => ({
  usePasskeySupport: supportMock,
}));

// next/navigation — mock defensivo (Link/router pode tocá-lo)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// -----------------------------------------------------------------------------
import { LoginForm } from "../LoginForm";

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

// Default: passkey not supported → checkbox never shown in base tests.
beforeEach(() => {
  vi.clearAllMocks();
  signInMock.mockResolvedValue(undefined);
  hasHintMock.mockReturnValue(false);
  supportMock.mockReturnValue({ supported: null, isWebView: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Original tests (PRD-01, TASK-07)
// =============================================================================
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
    expect(toastError).not.toHaveBeenCalled();
  });

  it("falha de signIn dispara toast.error com mensagem traduzida (R6)", async () => {
    signInMock.mockRejectedValueOnce({ code: "auth/invalid-credential" });
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "secret123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(toastError).toHaveBeenCalledWith("E-mail ou senha inválidos.");
  });

  it("erro sem código usa a mensagem genérica de fallback", async () => {
    signInMock.mockRejectedValueOnce(new Error("boom"));
    render(<LoginForm />);

    fireEvent.change(getEmailInput(), { target: { value: "user@example.com" } });
    fireEvent.change(getPasswordInput(), { target: { value: "secret123" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
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

// =============================================================================
// New tests — biometric activation checkbox
// =============================================================================
async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("E-mail"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Senha"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

describe("LoginForm — ativação de biometria", () => {
  beforeEach(() => {
    // Override default: passkey supported + no hint → show checkbox
    supportMock.mockReturnValue({ supported: true, isWebView: false });
    hasHintMock.mockReturnValue(false);
  });

  it("mostra o checkbox quando suportado e sem hint", () => {
    render(<LoginForm />);
    expect(screen.getByRole("checkbox", { name: /ativar biometria/i })).toBeTruthy();
  });

  it("não mostra o checkbox quando o device já tem passkey (hint)", () => {
    hasHintMock.mockReturnValue(true);
    render(<LoginForm />);
    expect(screen.queryByRole("checkbox", { name: /ativar biometria/i })).toBeNull();
  });

  it("não mostra o checkbox quando não suportado", () => {
    supportMock.mockReturnValue({ supported: false, isWebView: false });
    render(<LoginForm />);
    expect(screen.queryByRole("checkbox", { name: /ativar biometria/i })).toBeNull();
  });

  it("marcado + login OK → grava intenção", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("checkbox", { name: /ativar biometria/i }));
    await fillAndSubmit();
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1));
    expect(setIntentMock).toHaveBeenCalledTimes(1);
  });

  it("desmarcado + login OK → NÃO grava intenção", async () => {
    render(<LoginForm />);
    await fillAndSubmit();
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1));
    expect(setIntentMock).not.toHaveBeenCalled();
  });

  it("marcado + login FALHA → NÃO grava intenção", async () => {
    signInMock.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("checkbox", { name: /ativar biometria/i }));
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(setIntentMock).not.toHaveBeenCalled();
  });
});
