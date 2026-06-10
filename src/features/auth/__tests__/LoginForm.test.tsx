// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks -----------------------------------------------------------
const {
  signInMock,
  setIntentMock,
  clearIntentMock,
  hasIntentMock,
  toastError,
  toastMock,
  hasHintMock,
  supportMock,
} = vi.hoisted(() => ({
  signInMock: vi.fn(),
  setIntentMock: vi.fn(),
  clearIntentMock: vi.fn(),
  hasIntentMock: vi.fn(),
  toastError: vi.fn(),
  toastMock: vi.fn(),
  hasHintMock: vi.fn(),
  supportMock: vi.fn(),
}));

const { bioMutateMock } = vi.hoisted(() => ({ bioMutateMock: vi.fn() }));

vi.mock("@/services/auth", () => ({ signIn: signInMock }));

vi.mock("@/features/auth/hooks/useBiometricLogin", () => ({
  useBiometricLogin: () => ({ mutate: bioMutateMock, isPending: false }),
}));

vi.mock("sonner", () => {
  const toast = Object.assign(toastMock, { error: toastError });
  return { toast };
});

vi.mock("@/features/passkeys/lib/loginBiometricIntent", () => ({
  setBiometricIntent: setIntentMock,
  clearBiometricIntent: clearIntentMock,
  hasBiometricIntent: hasIntentMock,
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
  hasIntentMock.mockReturnValue(false);
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

  it("mostra o checkbox quando suportado (sem hint → rótulo 'Ativar')", () => {
    render(<LoginForm />);
    expect(screen.getByRole("checkbox", { name: /ativar biometria/i })).toBeTruthy();
  });

  it("mostra o checkbox MESMO com passkey salvo (hint → rótulo 'Entrar com biometria')", () => {
    hasHintMock.mockReturnValue(true);
    render(<LoginForm />);
    expect(
      screen.getByRole("checkbox", { name: /entrar com biometria/i }),
    ).toBeTruthy();
  });

  it("não mostra o checkbox quando não suportado", () => {
    supportMock.mockReturnValue({ supported: false, isWebView: false });
    render(<LoginForm />);
    expect(screen.queryByRole("checkbox", { name: /biometria/i })).toBeNull();
  });

  it("não mostra o checkbox em WebView", () => {
    supportMock.mockReturnValue({ supported: true, isWebView: true });
    render(<LoginForm />);
    expect(screen.queryByRole("checkbox", { name: /biometria/i })).toBeNull();
  });

  it("marcar grava a intenção NA HORA (antes do login → sem race)", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("checkbox", { name: /ativar biometria/i }));
    // Intenção persistida no clique, não no submit.
    expect(setIntentMock).toHaveBeenCalledTimes(1);
    expect(clearIntentMock).not.toHaveBeenCalled();
  });

  it("desmarcar limpa a intenção", async () => {
    render(<LoginForm />);
    const cb = screen.getByRole("checkbox", { name: /ativar biometria/i });
    await userEvent.click(cb); // marca
    await userEvent.click(cb); // desmarca
    expect(clearIntentMock).toHaveBeenCalledTimes(1);
  });

  it("estado sobrevive ao reload: checkbox restaurado da intenção persistida", () => {
    hasIntentMock.mockReturnValue(true);
    render(<LoginForm />);
    const cb = screen.getByRole("checkbox", { name: /ativar biometria/i });
    expect(cb.getAttribute("aria-checked")).toBe("true");
  });

  it("desmarcado: intenção não é gravada (nada a consumir pós-login)", async () => {
    render(<LoginForm />);
    await fillAndSubmit();
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1));
    expect(setIntentMock).not.toHaveBeenCalled();
  });

  it("submit NÃO regrava a intenção (já persistida ao marcar)", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("checkbox", { name: /ativar biometria/i }));
    setIntentMock.mockClear();
    await fillAndSubmit();
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1));
    // O submit não chama setBiometricIntent de novo — a gravação é no clique.
    expect(setIntentMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm — login biométrico direto (device com passkey)", () => {
  beforeEach(() => {
    supportMock.mockReturnValue({ supported: true, isWebView: false });
    hasHintMock.mockReturnValue(true); // device já tem passkey
    hasIntentMock.mockReturnValue(true); // checkbox marcado (persistido)
  });

  it("com passkey + checkbox marcado: botão vira 'Entrar com biometria'", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("button", { name: /^entrar com biometria/i }),
    ).toBeTruthy();
  });

  it("clicar 'Entrar com biometria' dispara a cerimônia WebAuthn (não signIn)", async () => {
    render(<LoginForm />);
    await userEvent.click(
      screen.getByRole("button", { name: /^entrar com biometria/i }),
    );
    expect(bioMutateMock).toHaveBeenCalledTimes(1);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("modo biométrico IGNORA e-mail/senha (sem validação, login mesmo com campos vazios)", async () => {
    render(<LoginForm />);
    // Campos vazios — em login por senha bloquearia; no modo biométrico não.
    await userEvent.click(
      screen.getByRole("button", { name: /^entrar com biometria/i }),
    );
    expect(bioMutateMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/E-mail inválido/i)).toBeNull();
  });

  it("com passkey: checkbox vem MARCADO por padrão (biometria é o método salvo)", () => {
    render(<LoginForm />);
    const cb = screen.getByRole("checkbox", { name: /entrar com biometria/i });
    expect(cb.getAttribute("aria-checked")).toBe("true");
  });

  it("desmarcar em device com passkey: volta ao login por senha ('Entrar')", async () => {
    render(<LoginForm />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: /entrar com biometria/i }),
    ); // desmarca
    expect(
      screen.queryByRole("button", { name: /^entrar com biometria/i }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeTruthy();
  });

  it("campos e-mail e senha continuam na tela no modo biométrico", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
  });
});
