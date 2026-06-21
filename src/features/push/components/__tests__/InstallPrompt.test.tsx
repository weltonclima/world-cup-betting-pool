// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "@/features/push/components/InstallPrompt";
import { useInstallPrompt } from "@/features/push/hooks/useInstallPrompt";

/**
 * Cobertura do banner `InstallPrompt` (web-push-pwa TASK-06): render condicional
 * (standalone/dispensado/sem-suporte → null), CTA Android vs iOS, abertura do
 * tutorial iOS e dispensa. Mocka o hook para dirigir cada cenário.
 */

vi.mock("@/features/push/hooks/useInstallPrompt", () => ({
  useInstallPrompt: vi.fn(),
}));

const useInstallPromptMock = vi.mocked(useInstallPrompt);

type HookState = ReturnType<typeof useInstallPrompt>;

function stub(overrides: Partial<HookState>): void {
  useInstallPromptMock.mockReturnValue({
    canInstallAndroid: false,
    isIos: false,
    isStandalone: false,
    dismissed: false,
    promptInstall: vi.fn().mockResolvedValue("accepted"),
    dismiss: vi.fn(),
    ...overrides,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("InstallPrompt — render condicional (null)", () => {
  it("não renderiza em standalone", () => {
    stub({ isStandalone: true, canInstallAndroid: true });
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("não renderiza quando dispensado", () => {
    stub({ dismissed: true, isIos: true });
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("não renderiza sem suporte (não-iOS, sem beforeinstallprompt)", () => {
    stub({});
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });
});

describe("InstallPrompt — Android", () => {
  it("mostra 'Instalar' e dispara o prompt nativo", async () => {
    const promptInstall = vi.fn().mockResolvedValue("accepted");
    stub({ canInstallAndroid: true, promptInstall });
    render(<InstallPrompt />);

    const button = screen.getByRole("button", { name: "Instalar" });
    fireEvent.click(button);

    await waitFor(() => expect(promptInstall).toHaveBeenCalled());
  });
});

describe("InstallPrompt — iOS", () => {
  it("mostra 'Como instalar' e abre o tutorial", async () => {
    stub({ isIos: true });
    render(<InstallPrompt />);

    const button = screen.getByRole("button", { name: "Como instalar" });
    fireEvent.click(button);

    // Conteúdo do bottom sheet aparece ao abrir.
    await waitFor(() =>
      expect(screen.queryByText("Adicionar à Tela de Início")).not.toBeNull(),
    );
  });

  it("Android tem prioridade sobre iOS quando ambos verdadeiros (não mostra tutorial)", () => {
    // isIos=true torna showAndroid=false; cai no CTA de tutorial, sem prompt.
    stub({ isIos: true, canInstallAndroid: true });
    render(<InstallPrompt />);
    expect(
      screen.getByRole("button", { name: "Como instalar" }),
    ).toBeTruthy();
  });
});

describe("InstallPrompt — dispensa", () => {
  it("o X chama dismiss()", () => {
    const dismiss = vi.fn();
    stub({ canInstallAndroid: true, dismiss });
    render(<InstallPrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    expect(dismiss).toHaveBeenCalled();
  });
});
