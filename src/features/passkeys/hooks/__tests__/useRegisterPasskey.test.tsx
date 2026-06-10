// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  registerPasskeyMock,
  toastSuccess,
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
    registerPasskeyMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastInfo: vi.fn(),
    toastError: vi.fn(),
    markPasskeyMock: vi.fn(),
    PasskeyErrorFake,
  };
});

vi.mock("@/services/webauthn", () => ({
  PasskeyError: PasskeyErrorFake,
  registerPasskey: registerPasskeyMock,
}));

vi.mock("../../lib/passkeyHint", () => ({
  markPasskeyRegistered: markPasskeyMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, info: toastInfo, error: toastError },
}));

import { useRegisterPasskey } from "../useRegisterPasskey";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerPasskeyMock.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe("useRegisterPasskey", () => {
  it("sucesso: grava o hint local e mostra toast de sucesso", async () => {
    const { result } = renderHook(() => useRegisterPasskey(), { wrapper });
    result.current.mutate(undefined);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(markPasskeyMock).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("falha: NÃO grava hint (sem passkey cadastrado)", async () => {
    registerPasskeyMock.mockRejectedValue(
      new PasskeyErrorFake("Não foi possível ativar a biometria."),
    );
    const { result } = renderHook(() => useRegisterPasskey(), { wrapper });
    result.current.mutate(undefined);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(markPasskeyMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
