// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INSTALL_DISMISSED_KEY,
  useInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/features/push/hooks/useInstallPrompt";
import { isIos, isStandalone } from "@/features/push/platform";

/**
 * Cobertura do hook `useInstallPrompt` (web-push-pwa TASK-06): captura do
 * `beforeinstallprompt`, disparo do prompt nativo, detecção de plataforma e
 * dispensa persistida. Mocka `platform` e dirige eventos/localStorage no jsdom.
 */

vi.mock("@/features/push/platform", () => ({
  isIos: vi.fn(),
  isStandalone: vi.fn(),
}));

const isIosMock = vi.mocked(isIos);
const isStandaloneMock = vi.mocked(isStandalone);

/** Cria um `beforeinstallprompt` falso com `prompt`/`userChoice` controláveis. */
function makeBipEvent(outcome: "accepted" | "dismissed"): BeforeInstallPromptEvent {
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

beforeEach(() => {
  isIosMock.mockReturnValue(false);
  isStandaloneMock.mockReturnValue(false);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useInstallPrompt — captura do beforeinstallprompt", () => {
  it("preventDefault + canInstallAndroid=true quando o evento dispara", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = makeBipEvent("accepted");
    const prevent = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => expect(result.current.canInstallAndroid).toBe(true));
    expect(prevent).toHaveBeenCalled();
  });

  it("promptInstall dispara prompt() e retorna o outcome", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = makeBipEvent("accepted");
    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.canInstallAndroid).toBe(true));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(outcome).toBe("accepted");
    // evento consumido → CTA some
    expect(result.current.canInstallAndroid).toBe(false);
  });

  it("promptInstall sem evento capturado retorna 'unavailable'", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe("unavailable");
  });

  it("appinstalled esconde o CTA do Android", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(makeBipEvent("accepted"));
    });
    await waitFor(() => expect(result.current.canInstallAndroid).toBe(true));

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    await waitFor(() => expect(result.current.canInstallAndroid).toBe(false));
  });
});

describe("useInstallPrompt — plataforma", () => {
  it("reflete isIos/isStandalone do módulo platform", async () => {
    isIosMock.mockReturnValue(true);
    isStandaloneMock.mockReturnValue(true);
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.isIos).toBe(true));
    expect(result.current.isStandalone).toBe(true);
  });
});

describe("useInstallPrompt — dispensa persistida", () => {
  it("dismiss() grava em localStorage e marca dismissed", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.dismissed).toBe(false));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe("1");
  });

  it("lê dismissed=true no mount quando a flag já está setada", async () => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.dismissed).toBe(true));
  });
});
