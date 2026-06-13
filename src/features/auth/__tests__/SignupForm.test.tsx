// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignupForm } from "@/features/auth/SignupForm";

// vi.hoisted: as fábricas de vi.mock são içadas para o topo do arquivo; declarar
// os mocks via hoisted evita o TDZ ao referenciá-los dentro das fábricas.
const { signUpMock, toastSuccessMock, toastErrorMock, pushMock } = vi.hoisted(
  () => ({
    signUpMock: vi.fn<(input: unknown) => Promise<void>>(() =>
      Promise.resolve(),
    ),
    toastSuccessMock: vi.fn<(message: string) => void>(),
    toastErrorMock: vi.fn<(message: string) => void>(),
    pushMock: vi.fn<(href: string) => void>(),
  }),
);

// Serviço de autenticação (TASK-06). Isola Firebase Auth/Firestore.
vi.mock("@/services/auth", () => ({
  signUp: signUpMock,
}));

// Sonner (toasts).
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

// Router de next/navigation (não usado diretamente, mas mockado por segurança).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// `redeemInvite` (PRD-10, A2) importa `@/firebase` no nível de módulo, que valida
// as envs NEXT_PUBLIC_FIREBASE_* ao carregar. Mockado para isolar o SignupForm
// do cliente Firebase real (sem o mock, o import quebra a suíte na carga).
vi.mock("@/services/invites", () => ({
  redeemInvite: vi.fn(async () => true),
}));

// Helpers de seleção de campos por label/placeholder.
function getInput(placeholder: string): HTMLInputElement {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

interface FillOptions {
  name?: string;
  nickname?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// Preenche os campos de texto do formulário.
function fillTextFields({
  name = "Fulano de Tal",
  nickname = "Fulano",
  email = "fulano@example.com",
  password = "secret123",
  confirmPassword = "secret123",
}: FillOptions = {}) {
  fireEvent.change(getInput("Digite seu nome completo"), {
    target: { value: name },
  });
  fireEvent.change(getInput("Digite seu apelido"), {
    target: { value: nickname },
  });
  fireEvent.change(getInput("Digite seu melhor email"), {
    target: { value: email },
  });
  fireEvent.change(getInput("Digite sua senha"), {
    target: { value: password },
  });
  fireEvent.change(getInput("Confirme sua senha"), {
    target: { value: confirmPassword },
  });
  // Cadastro comum não seleciona grupo (associação só via convite `/invite/[code]`).
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /Criar conta/i,
  }) as HTMLButtonElement;
}

beforeEach(() => {
  signUpMock.mockReset();
  signUpMock.mockResolvedValue(undefined);
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SignupForm", () => {
  it("bloqueia o submit e mostra erro quando senha e confirmação divergem", async () => {
    render(<SignupForm />);

    fillTextFields({ password: "secret123", confirmPassword: "outrasenha" });

    await waitFor(() => {
      expect(
        screen.getByText("As senhas não coincidem."),
      ).toBeTruthy();
    });

    // CTA desabilitado e serviço nunca chamado.
    expect(submitButton().disabled).toBe(true);
    fireEvent.click(submitButton());
    await waitFor(() => {
      expect(signUpMock).not.toHaveBeenCalled();
    });
  });

  it("chama signUp apenas com {name,nickname,email,password} quando válido (cadastro comum, sem grupo)", async () => {
    render(<SignupForm />);

    fillTextFields();

    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });

    expect(signUpMock).toHaveBeenCalledWith({
      name: "Fulano de Tal",
      nickname: "Fulano",
      email: "fulano@example.com",
      password: "secret123",
      // Cadastro comum não escolhe grupo: campo nasce vazio e não vira groupId no doc
      // (services/auth.ts só persiste quando truthy). Grupo só via convite.
      groupId: "",
    });

    // Não envia campos exclusivos do frontend ao serviço.
    const firstCall = signUpMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("confirmPassword");
    expect(payload).not.toHaveProperty("acceptTerms");

    // Sucesso → toast de sucesso, sem erro.
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("exibe toast.error com a mensagem mapeada quando signUp rejeita", async () => {
    signUpMock.mockRejectedValue(
      Object.assign(new Error("email in use"), {
        code: "auth/email-already-in-use",
      }),
    );

    render(<SignupForm />);

    fillTextFields();

    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível concluir o cadastro com esses dados.",
      );
    });
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
