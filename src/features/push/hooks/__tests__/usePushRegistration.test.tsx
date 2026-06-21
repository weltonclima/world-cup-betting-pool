// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePushRegistration } from "@/features/push/hooks/usePushRegistration";
import { isPushSupported } from "@/firebase/messaging";
import {
  canRequestPush,
  refreshPushTokenOnLoad,
  registerPush,
  unregisterPush,
} from "@/features/push/registration";

/**
 * Cobertura do hook `usePushRegistration` (web-push-pwa TASK-02): resolução
 * assíncrona de suporte (suporte + gate iOS), re-registro no load, e os fluxos
 * `register`/`unregister`. Mocka as camadas de messaging e orquestração.
 */

vi.mock("@/firebase/messaging", () => ({ isPushSupported: vi.fn() }));
vi.mock("@/features/push/registration", () => ({
  canRequestPush: vi.fn(),
  refreshPushTokenOnLoad: vi.fn(),
  registerPush: vi.fn(),
  unregisterPush: vi.fn(),
}));

const isPushSupportedMock = vi.mocked(isPushSupported);
const canRequestPushMock = vi.mocked(canRequestPush);
const refreshOnLoadMock = vi.mocked(refreshPushTokenOnLoad);
const registerPushMock = vi.mocked(registerPush);
const unregisterPushMock = vi.mocked(unregisterPush);

function setPermission(value: NotificationPermission) {
  // @ts-expect-error stub mínimo de Notification no teste
  globalThis.Notification = { permission: value };
}

beforeEach(() => {
  isPushSupportedMock.mockResolvedValue(true);
  canRequestPushMock.mockReturnValue(true);
  refreshOnLoadMock.mockResolvedValue(undefined);
  registerPushMock.mockResolvedValue("tok-123");
  unregisterPushMock.mockResolvedValue(undefined);
  setPermission("default");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePushRegistration — resolução de suporte", () => {
  it("supported=true quando push suportado e gate liberado", async () => {
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.supported).toBe(true));
    expect(refreshOnLoadMock).toHaveBeenCalled();
  });

  it("supported=false quando o gate iOS bloqueia", async () => {
    canRequestPushMock.mockReturnValue(false);
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(refreshOnLoadMock).toHaveBeenCalled());
    expect(result.current.supported).toBe(false);
  });

  it("supported=false quando sem suporte do browser", async () => {
    isPushSupportedMock.mockResolvedValue(false);
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(refreshOnLoadMock).toHaveBeenCalled());
    expect(result.current.supported).toBe(false);
  });
});

describe("usePushRegistration — register", () => {
  it("chama registerPush e reflete a permissão concedida", async () => {
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.supported).toBe(true));

    // simula concessão pelo prompt
    registerPushMock.mockImplementation(async () => {
      setPermission("granted");
      return "tok-123";
    });

    await act(async () => {
      await result.current.register();
    });

    expect(registerPushMock).toHaveBeenCalled();
    expect(result.current.permission).toBe("granted");
    expect(result.current.registering).toBe(false);
  });

  it("best-effort: falha de registerPush NÃO propaga (hook nunca lança)", async () => {
    registerPushMock.mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.supported).toBe(true));

    // não rejeita — o erro é capturado e logado dentro do hook
    await act(async () => {
      await result.current.register();
    });

    expect(warn).toHaveBeenCalled();
    // o estado de registering volta a false mesmo no erro (finally)
    expect(result.current.registering).toBe(false);
  });
});

describe("usePushRegistration — unregister", () => {
  it("chama unregisterPush", async () => {
    const { result } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.unregister();
    });

    expect(unregisterPushMock).toHaveBeenCalled();
  });
});
