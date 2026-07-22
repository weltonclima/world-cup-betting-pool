// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateGroupForm } from "@/features/auth/CreateGroupForm";
import { OnboardingSubmitError } from "@/services/onboarding";

// vi.hoisted: fábricas de vi.mock são içadas ao topo; declarar os mocks aqui
// evita TDZ ao referenciá-los dentro das fábricas.
const {
  createGroupMock,
  activateMyPoolMock,
  toastSuccessMock,
  toastErrorMock,
  toastInfoMock,
  pushMock,
} = vi.hoisted(() => ({
  createGroupMock: vi.fn<(input: unknown) => Promise<unknown>>(),
  activateMyPoolMock: vi.fn<() => Promise<unknown>>(),
  toastSuccessMock: vi.fn<(message: string) => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  toastInfoMock: vi.fn<(message: string) => void>(),
  pushMock: vi.fn<(href: string) => void>(),
}));

// Serviço de onboarding (TASK-16). Isola Firebase Auth + a chamada à rota.
// A fábrica exporta uma classe `OnboardingSubmitError` real para que o
// `error instanceof OnboardingSubmitError` do componente funcione (a mesma
// classe é importada pelo teste e pelo componente a partir deste mock).
vi.mock("@/services/onboarding", () => {
  class OnboardingSubmitError extends Error {
    readonly kind: "slug-taken" | "account-exists" | "generic";
    constructor(
      kind: "slug-taken" | "account-exists" | "generic",
      message: string,
    ) {
      super(message);
      this.name = "OnboardingSubmitError";
      this.kind = kind;
    }
  }
  return {
    createGroupAndAccount: createGroupMock,
    activateMyPool: activateMyPoolMock,
    OnboardingSubmitError,
  };
});

// Sonner (toasts).
vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

// Router de next/navigation — usado só no clique do CTA de sucesso.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function getInput(placeholder: string): HTMLInputElement {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

interface FillOptions {
  name?: string;
  nickname?: string;
  email?: string;
  groupName?: string;
  password?: string;
  confirmPassword?: string;
}

function fillFields({
  name = "Fulano de Tal",
  nickname = "Fulano",
  email = "fulano@example.com",
  groupName = "Bolão da Firma",
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
  fireEvent.change(getInput("Ex.: Bolão da firma"), {
    target: { value: groupName },
  });
  fireEvent.change(getInput("Digite sua senha"), {
    target: { value: password },
  });
  fireEvent.change(getInput("Confirme sua senha"), {
    target: { value: confirmPassword },
  });
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /Criar grupo e conta/i,
  }) as HTMLButtonElement;
}

beforeEach(() => {
  createGroupMock.mockReset();
  // Default: conta verificada → pool active (variante sem aviso de verificação).
  // Os testes do fluxo pending sobrescrevem `pending: true`.
  createGroupMock.mockResolvedValue({
    slug: "bolao-da-firma",
    inviteCode: "ABC123",
    pending: false,
  });
  activateMyPoolMock.mockReset();
  activateMyPoolMock.mockResolvedValue({ ok: true, activated: 1 });
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  toastInfoMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CreateGroupForm", () => {
  it("mantém o CTA desabilitado enquanto o formulário é inválido", async () => {
    render(<CreateGroupForm />);

    // Estado inicial: campos vazios → inválido.
    expect(submitButton().disabled).toBe(true);

    // Preenche tudo menos o nome do grupo → ainda inválido.
    fillFields({ groupName: "" });
    await waitFor(() => {
      expect(submitButton().disabled).toBe(true);
    });
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it("bloqueia o submit e mostra erro quando senha e confirmação divergem", async () => {
    render(<CreateGroupForm />);

    fillFields({ password: "secret123", confirmPassword: "outrasenha" });

    await waitFor(() => {
      expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
    });

    expect(submitButton().disabled).toBe(true);
    fireEvent.click(submitButton());
    await waitFor(() => {
      expect(createGroupMock).not.toHaveBeenCalled();
    });
  });

  it("exibe o preview do slug derivado do nome do grupo", async () => {
    render(<CreateGroupForm />);

    fireEvent.change(getInput("Ex.: Bolão da firma"), {
      target: { value: "Bolão da Firma!!" },
    });

    await waitFor(() => {
      expect(
        screen.getByText("bolao.app/invite/bolao-da-firma"),
      ).toBeTruthy();
    });
  });

  it("chama createGroupAndAccount com o slug derivado quando válido e mostra a fase de sucesso", async () => {
    render(<CreateGroupForm />);

    fillFields();

    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledTimes(1);
    });

    expect(createGroupMock).toHaveBeenCalledWith({
      name: "Fulano de Tal",
      nickname: "Fulano",
      email: "fulano@example.com",
      password: "secret123",
      groupName: "Bolão da Firma",
      slug: "bolao-da-firma",
    });

    // Fase de sucesso: link de convite exibido (via InviteValue) + CTA de navegação.
    await waitFor(() => {
      expect(screen.getByText("Grupo criado!")).toBeTruthy();
    });
    expect(
      screen.getByText(new RegExp("/invite/ABC123")),
    ).toBeTruthy();
    // Não navega automaticamente — só no clique.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navega para o grupo apenas quando o CTA de sucesso é clicado", async () => {
    render(<CreateGroupForm />);

    fillFields();
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    fireEvent.click(submitButton());

    const cta = await screen.findByRole("button", {
      name: /Ir para o meu grupo/i,
    });
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.click(cta);
    expect(pushMock).toHaveBeenCalledWith("/group");
  });

  it("em erro slug-taken: mostra toast e foca o campo do nome do grupo", async () => {
    createGroupMock.mockRejectedValue(
      new OnboardingSubmitError(
        "slug-taken",
        "Esse nome de grupo já está em uso.",
      ),
    );

    render(<CreateGroupForm />);

    fillFields();
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Esse nome de grupo já está em uso.",
      );
    });

    // Permanece na fase de formulário e foca o campo do grupo.
    expect(screen.queryByText("Grupo criado!")).toBeNull();
    expect(document.activeElement).toBe(getInput("Ex.: Bolão da firma"));
  });

  it("em erro genérico (Firebase Auth): mostra toast com mensagem mapeada em pt-BR", async () => {
    createGroupMock.mockRejectedValue(
      Object.assign(new Error("email in use"), {
        code: "auth/email-already-in-use",
      }),
    );

    render(<CreateGroupForm />);

    fillFields();
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível concluir o cadastro com esses dados.",
      );
    });
    expect(screen.queryByText("Grupo criado!")).toBeNull();
  });
});

// TASK-18 — sucesso com pool PENDING: aviso de verificação + "Já verifiquei".
describe("CreateGroupForm — verificação de e-mail (TASK-18)", () => {
  async function submitToPendingSuccess() {
    render(<CreateGroupForm />);
    fillFields();
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    fireEvent.click(submitButton());
    await screen.findByText("Grupo criado!");
  }

  it("pool active (verificado): NÃO mostra aviso nem botão 'Já verifiquei'", async () => {
    createGroupMock.mockResolvedValue({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: false,
    });
    await submitToPendingSuccess();

    expect(screen.queryByRole("note")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Já verifiquei/i }),
    ).toBeNull();
  });

  it("pool pending: mostra aviso (role=note) + botão 'Já verifiquei'", async () => {
    createGroupMock.mockResolvedValue({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: true,
    });
    await submitToPendingSuccess();

    expect(screen.getByRole("note").textContent).toMatch(
      /link de verificação/i,
    );
    expect(
      screen.getByRole("button", { name: /Já verifiquei/i }),
    ).toBeTruthy();
  });

  it("'Já verifiquei' + promoção OK → some o aviso e mostra toast de sucesso", async () => {
    createGroupMock.mockResolvedValue({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: true,
    });
    activateMyPoolMock.mockResolvedValue({ ok: true, activated: 1 });
    await submitToPendingSuccess();

    fireEvent.click(screen.getByRole("button", { name: /Já verifiquei/i }));

    await waitFor(() => {
      expect(activateMyPoolMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("note")).toBeNull();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Seu grupo já está visível na busca!",
    );
  });

  it("'Já verifiquei' + ainda não verificado → toast info, aviso permanece", async () => {
    createGroupMock.mockResolvedValue({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: true,
    });
    activateMyPoolMock.mockResolvedValue({ ok: false, activated: 0 });
    await submitToPendingSuccess();

    fireEvent.click(screen.getByRole("button", { name: /Já verifiquei/i }));

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledWith(
        expect.stringMatching(/Ainda não confirmamos seu e-mail/i),
      );
    });
    // Sem promoção → aviso continua visível.
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("'Já verifiquei' + erro de rede → toast de erro", async () => {
    createGroupMock.mockResolvedValue({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: true,
    });
    activateMyPoolMock.mockRejectedValue(new Error("network"));
    await submitToPendingSuccess();

    fireEvent.click(screen.getByRole("button", { name: /Já verifiquei/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível verificar agora. Tente novamente.",
      );
    });
    expect(screen.getByRole("note")).toBeTruthy();
  });
});
