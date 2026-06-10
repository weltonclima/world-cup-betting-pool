// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BiometricLoginButton } from "@/features/auth/BiometricLoginButton";

const { usePasskeySupportMock, useBiometricLoginMock, mutateMock } = vi.hoisted(
  () => ({
    usePasskeySupportMock: vi.fn(),
    useBiometricLoginMock: vi.fn(),
    mutateMock: vi.fn(),
  }),
);

vi.mock("@/features/passkeys/hooks", () => ({
  usePasskeySupport: usePasskeySupportMock,
}));

vi.mock("@/features/auth/hooks/useBiometricLogin", () => ({
  useBiometricLogin: useBiometricLoginMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  usePasskeySupportMock.mockReturnValue({ supported: true, isWebView: false });
  useBiometricLoginMock.mockReturnValue({ mutate: mutateMock, isPending: false });
});

afterEach(() => vi.clearAllMocks());

function getButton(): HTMLButtonElement | null {
  return screen.queryByRole("button", {
    name: /entrar com biometria|entrando com biometria/i,
  }) as HTMLButtonElement | null;
}

describe("BiometricLoginButton", () => {
  it("suportado e não-WebView: renderiza o botão", () => {
    render(<BiometricLoginButton />);
    expect(getButton()).not.toBeNull();
  });

  it("resolvendo (supported=null): não renderiza nada (M3 — fallback basta)", () => {
    usePasskeySupportMock.mockReturnValue({ supported: null, isWebView: false });
    const { container } = render(<BiometricLoginButton />);
    expect(getButton()).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("sem suporte (supported=false): não renderiza nada (M3)", () => {
    usePasskeySupportMock.mockReturnValue({ supported: false, isWebView: false });
    const { container } = render(<BiometricLoginButton />);
    expect(getButton()).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("WebView (A9): mostra a nota 'abrir no navegador', sem botão", () => {
    usePasskeySupportMock.mockReturnValue({ supported: true, isWebView: true });
    render(<BiometricLoginButton />);
    expect(getButton()).toBeNull();
    expect(screen.getByText(/navegador/i)).toBeTruthy();
  });

  it("clique dispara a mutação (gesto do usuário)", () => {
    render(<BiometricLoginButton />);
    fireEvent.click(getButton()!);
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("loading: botão desabilitado, aria-busy e texto de progresso", () => {
    useBiometricLoginMock.mockReturnValue({ mutate: mutateMock, isPending: true });
    render(<BiometricLoginButton />);
    const btn = getButton()!;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.textContent).toMatch(/entrando com biometria/i);
  });
});
