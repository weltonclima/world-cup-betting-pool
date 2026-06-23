// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PushOptInPrompt } from "@/features/push/components/PushOptInPrompt";
import { usePushOptInPrompt } from "@/features/push/hooks/usePushOptInPrompt";

/**
 * Cobertura do banner `PushOptInPrompt` (push-optin): render condicional
 * (shouldShow=false → null), CTA "Ativar" e dispensa "Agora não". Mocka o hook
 * para dirigir cada cenário.
 */

vi.mock("@/features/push/hooks/usePushOptInPrompt", () => ({
  usePushOptInPrompt: vi.fn(),
}));

const usePushOptInPromptMock = vi.mocked(usePushOptInPrompt);

type HookState = ReturnType<typeof usePushOptInPrompt>;
function stub(over: Partial<HookState>): void {
  usePushOptInPromptMock.mockReturnValue({
    shouldShow: false,
    activating: false,
    activate: vi.fn().mockResolvedValue(undefined),
    snooze: vi.fn(),
    ...over,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PushOptInPrompt — render condicional", () => {
  it("não renderiza quando shouldShow=false", () => {
    stub({ shouldShow: false });
    const { container } = render(<PushOptInPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o banner quando shouldShow=true", () => {
    stub({ shouldShow: true });
    render(<PushOptInPrompt />);
    expect(screen.getByRole("region", { name: "Ativar notificações" })).toBeTruthy();
  });
});

describe("PushOptInPrompt — ações", () => {
  it("'Ativar' chama activate()", async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    stub({ shouldShow: true, activate });
    render(<PushOptInPrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    await waitFor(() => expect(activate).toHaveBeenCalled());
  });

  it("'Ativar' fica desabilitado enquanto activating", () => {
    stub({ shouldShow: true, activating: true });
    render(<PushOptInPrompt />);
    expect(
      screen.getByRole("button", { name: "Ativar" }),
    ).toHaveProperty("disabled", true);
  });

  it("o X 'Agora não' chama snooze()", () => {
    const snooze = vi.fn();
    stub({ shouldShow: true, snooze });
    render(<PushOptInPrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(snooze).toHaveBeenCalled();
  });
});
