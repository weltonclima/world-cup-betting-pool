// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PasskeyError fake na zona içada (vi.hoisted): a MESMA classe é exportada pelo
// mock de `@/services/webauthn` E usada no corpo do teste, garantindo que o
// `instanceof` do hook bata. Defini-la fora do factory quebraria o hoisting.
const {
  loginWithPasskeyMock,
  signInBioMock,
  toastInfo,
  toastError,
  markPasskeyMock,
  PasskeyErrorFake,
} = vi.hoisted(() => {
  class PasskeyErrorFake extends Error {
    readonly code: string;
    constructor(message: string, code = "error") {
      super(message);
      this.name = "PasskeyError";
      this.code = code;
    }
  }
  return {
    loginWithPasskeyMock: vi.fn(),
    signInBioMock: vi.fn(),
    toastInfo: vi.fn(),
    toastError: vi.fn(),
    markPasskeyMock: vi.fn(),
    PasskeyErrorFake,
  };
});

vi.mock("@/features/passkeys/lib/passkeyHint", () => ({
  markPasskeyRegistered: markPasskeyMock,
}));

vi.mock("@/services/webauthn", () => ({
  PasskeyError: PasskeyErrorFake,
  loginWithPasskey: loginWithPasskeyMock,
}));

vi.mock("@/services/auth", () => ({
  signInWithBiometricToken: signInBioMock,
}));

vi.mock("sonner", () => ({
  toast: { info: toastInfo, error: toastError },
}));

import { useBiometricLogin } from "@/features/auth/hooks/useBiometricLogin";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  loginWithPasskeyMock.mockResolvedValue("TOKEN");
  signInBioMock.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe("useBiometricLogin", () => {
  it("sucesso: orquestra login + sessão, sem toast (AuthLayout redireciona)", async () => {
    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(signInBioMock).toHaveBeenCalledWith("TOKEN");
    // Self-heal: marca o hint local para manter o atalho habilitado.
    expect(markPasskeyMock).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("cancelamento (code 'cancelled'): toast.info neutro, NÃO toast.error", async () => {
    loginWithPasskeyMock.mockRejectedValue(
      new PasskeyErrorFake("Login por biometria cancelado.", "cancelled"),
    );
    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    // Falha → não marca hint (não há passkey utilizável comprovado).
    expect(markPasskeyMock).not.toHaveBeenCalled();
  });

  it("erro real: toast.error pt-BR", async () => {
    loginWithPasskeyMock.mockRejectedValue(new Error("rede"));
    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastInfo).not.toHaveBeenCalled();
  });
});
