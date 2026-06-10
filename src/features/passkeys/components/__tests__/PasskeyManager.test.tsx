// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasskeyManager } from "../PasskeyManager";

const {
  usePasskeysMock,
  usePasskeySupportMock,
  useRegisterPasskeyMock,
  useRevokePasskeyMock,
} = vi.hoisted(() => ({
  usePasskeysMock: vi.fn(),
  usePasskeySupportMock: vi.fn(),
  useRegisterPasskeyMock: vi.fn(),
  useRevokePasskeyMock: vi.fn(),
}));

vi.mock("@/features/passkeys/hooks", () => ({
  usePasskeys: usePasskeysMock,
  usePasskeySupport: usePasskeySupportMock,
  useRegisterPasskey: useRegisterPasskeyMock,
  useRevokePasskey: useRevokePasskeyMock,
}));

const CRED = {
  credentialId: "cred-1",
  uid: "uid-1",
  publicKey: "pk",
  counter: 0,
  deviceLabel: "iPhone do Welton",
  createdAt: "2026-06-09T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useRegisterPasskeyMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useRevokePasskeyMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  usePasskeysMock.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
  usePasskeySupportMock.mockReturnValue({ supported: true, isWebView: false });
});

afterEach(() => vi.clearAllMocks());

describe("PasskeyManager", () => {
  it("sem suporte: mostra aviso de indisponibilidade, esconde CTA ativo", () => {
    usePasskeySupportMock.mockReturnValue({
      supported: false,
      isWebView: false,
    });
    render(<PasskeyManager />);
    expect(screen.getByText(/não suporta biometria/i)).toBeTruthy();
    expect(screen.queryByText(/Biometria neste dispositivo/i)).toBeNull();
  });

  it("WebView: orienta abrir no navegador", () => {
    usePasskeySupportMock.mockReturnValue({ supported: null, isWebView: true });
    render(<PasskeyManager />);
    expect(screen.getByText(/navegador/i)).toBeTruthy();
  });

  it("suportado e vazio: mostra CTA + estado vazio", () => {
    render(<PasskeyManager />);
    expect(screen.getByText(/Biometria neste dispositivo/i)).toBeTruthy();
    expect(screen.getByText(/Nenhum dispositivo cadastrado/i)).toBeTruthy();
  });

  it("com passkeys: lista os dispositivos cadastrados", () => {
    usePasskeysMock.mockReturnValue({
      data: [CRED],
      isPending: false,
      isError: false,
    });
    render(<PasskeyManager />);
    expect(screen.getByText("iPhone do Welton")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Remover iPhone do Welton/i }),
    ).toBeTruthy();
  });

  it("carregando (uid/fetch pendente): mostra skeleton, não o estado vazio", () => {
    usePasskeysMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<PasskeyManager />);
    expect(screen.queryByText(/Nenhum dispositivo cadastrado/i)).toBeNull();
  });

  it("erro na lista: mostra alerta + botão Tentar novamente (não estado vazio)", () => {
    const refetch = vi.fn();
    usePasskeysMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    render(<PasskeyManager />);
    expect(screen.queryByText(/Nenhum dispositivo cadastrado/i)).toBeNull();
    const retry = screen.getByRole("button", { name: /Tentar novamente/i });
    retry.click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
