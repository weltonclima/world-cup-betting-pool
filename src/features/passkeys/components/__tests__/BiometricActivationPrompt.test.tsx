// @vitest-environment jsdom
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { consumeMock, supportMock, hasHintMock, mutateMock } = vi.hoisted(() => ({
  consumeMock: vi.fn(),
  supportMock: vi.fn(),
  hasHintMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("../../lib/loginBiometricIntent", () => ({
  consumeBiometricIntent: consumeMock,
}));
vi.mock("../../lib/passkeyHint", () => ({ hasPasskeyHint: hasHintMock }));
vi.mock("../../lib/deviceLabel", () => ({ deriveDeviceLabel: () => "iPhone" }));
vi.mock("../../hooks", () => ({
  usePasskeySupport: supportMock,
  useRegisterPasskey: () => ({ mutate: mutateMock, isPending: false }),
}));

import { BiometricActivationPrompt } from "../BiometricActivationPrompt";

beforeEach(() => {
  vi.clearAllMocks();
  supportMock.mockReturnValue({ supported: true, isWebView: false });
  hasHintMock.mockReturnValue(false);
});

afterEach(() => vi.clearAllMocks());

describe("BiometricActivationPrompt", () => {
  it("sem intenção: não abre", () => {
    consumeMock.mockReturnValue(false);
    render(<BiometricActivationPrompt />);
    expect(screen.queryByRole("button", { name: /ativar agora/i })).toBeNull();
  });

  it("com intenção + suporte + sem hint: abre o confirm", async () => {
    consumeMock.mockReturnValue(true);
    render(<BiometricActivationPrompt />);
    expect(await screen.findByRole("button", { name: /ativar agora/i })).toBeTruthy();
  });

  it("regressão StrictMode: consume destrutivo no double-invoke não perde a intenção", async () => {
    // 1ª chamada limpa a flag (true), 2ª (StrictMode) já vê false.
    consumeMock.mockReturnValueOnce(true).mockReturnValue(false);
    render(
      <StrictMode>
        <BiometricActivationPrompt />
      </StrictMode>,
    );
    // Mesmo com o 2º consume retornando false, o prompt abre.
    expect(
      await screen.findByRole("button", { name: /ativar agora/i }),
    ).toBeTruthy();
  });

  it("com intenção mas device já tem hint: não abre", () => {
    consumeMock.mockReturnValue(true);
    hasHintMock.mockReturnValue(true);
    render(<BiometricActivationPrompt />);
    expect(screen.queryByRole("button", { name: /ativar agora/i })).toBeNull();
  });

  it("'Ativar agora' dispara o registro com o rótulo do device", async () => {
    consumeMock.mockReturnValue(true);
    render(<BiometricActivationPrompt />);
    await userEvent.click(await screen.findByRole("button", { name: /ativar agora/i }));
    expect(mutateMock).toHaveBeenCalledWith("iPhone", expect.any(Object));
  });

  it("com intenção mas em WebView: não abre", () => {
    consumeMock.mockReturnValue(true);
    supportMock.mockReturnValue({ supported: true, isWebView: true });
    render(<BiometricActivationPrompt />);
    expect(screen.queryByRole("button", { name: /ativar agora/i })).toBeNull();
  });

  it("'Agora não' não dispara registro", async () => {
    consumeMock.mockReturnValue(true);
    render(<BiometricActivationPrompt />);
    await userEvent.click(await screen.findByRole("button", { name: /agora não/i }));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
