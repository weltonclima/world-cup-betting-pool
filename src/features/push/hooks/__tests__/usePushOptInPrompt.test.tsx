// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUSH_OPTIN_SNOOZE_KEY,
  PUSH_OPTIN_SNOOZE_MS,
  usePushOptInPrompt,
} from "@/features/push/hooks/usePushOptInPrompt";
import { usePushRegistration } from "@/features/push/hooks/usePushRegistration";
import { registerPush } from "@/features/push/registration";
import {
  usePreferences,
  useUpdatePreferences,
} from "@/features/notifications/hooks";

/**
 * Cobertura do soft-ask `usePushOptInPrompt` (push-optin): gate de visibilidade
 * (suporte + permissão + pushEnabled + snooze), o fluxo `activate` (token → liga
 * pushEnabled), e o `snooze` (adia 24h via localStorage). Mocka registro, prefs
 * e a mutation. `toast` mockado para não tocar a UI.
 */

vi.mock("@/features/push/hooks/usePushRegistration", () => ({
  usePushRegistration: vi.fn(),
}));
vi.mock("@/features/push/registration", () => ({ registerPush: vi.fn() }));
vi.mock("@/features/notifications/hooks", () => ({
  usePreferences: vi.fn(),
  useUpdatePreferences: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const usePushRegistrationMock = vi.mocked(usePushRegistration);
const registerPushMock = vi.mocked(registerPush);
const usePreferencesMock = vi.mocked(usePreferences);
const useUpdatePreferencesMock = vi.mocked(useUpdatePreferences);

const mutateMock = vi.fn();

type PushState = ReturnType<typeof usePushRegistration>;
function stubPush(over: Partial<PushState> = {}): void {
  usePushRegistrationMock.mockReturnValue({
    supported: true,
    permission: "default",
    registering: false,
    register: vi.fn(),
    unregister: vi.fn(),
    ...over,
  });
}

function stubPrefs(data: Record<string, unknown> | undefined): void {
  // Só os campos que o hook lê; cast para o tipo do retorno da query.
  usePreferencesMock.mockReturnValue({
    data,
  } as ReturnType<typeof usePreferences>);
}

beforeEach(() => {
  window.localStorage.clear();
  stubPush();
  stubPrefs({
    userId: "u1",
    system: true,
    games: true,
    ranking: true,
    pushEnabled: false,
  });
  registerPushMock.mockResolvedValue("tok-123");
  useUpdatePreferencesMock.mockReturnValue({
    mutate: mutateMock,
  } as unknown as ReturnType<typeof useUpdatePreferences>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePushOptInPrompt — gate de visibilidade", () => {
  it("shouldShow=true: suportado, não negado, pushEnabled=false, sem snooze", async () => {
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));
  });

  it("shouldShow=false quando push não suportado", async () => {
    stubPush({ supported: false });
    const { result } = renderHook(() => usePushOptInPrompt());
    // dá tempo do efeito de mount rodar; segue false
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow=false quando permissão negada (não re-pede prompt)", async () => {
    stubPush({ permission: "denied" });
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow=false quando pushEnabled já é true", async () => {
    stubPrefs({ system: true, games: true, ranking: true, pushEnabled: true });
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow=false enquanto prefs ainda carregam (data undefined)", async () => {
    stubPrefs(undefined);
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow=false quando snooze futuro está persistido", async () => {
    window.localStorage.setItem(
      PUSH_OPTIN_SNOOZE_KEY,
      String(Date.now() + PUSH_OPTIN_SNOOZE_MS),
    );
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow=true quando snooze expirado (timestamp no passado)", async () => {
    window.localStorage.setItem(PUSH_OPTIN_SNOOZE_KEY, String(Date.now() - 1000));
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));
  });
});

describe("usePushOptInPrompt — activate", () => {
  it("token OK → liga pushEnabled mantendo as categorias", async () => {
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));

    await act(async () => {
      await result.current.activate();
    });

    expect(registerPushMock).toHaveBeenCalled();
    expect(mutateMock).toHaveBeenCalledWith(
      { system: true, games: true, ranking: true, pushEnabled: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("sem token (negada/sem suporte) → NÃO liga pushEnabled", async () => {
    registerPushMock.mockResolvedValue(null);
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));

    await act(async () => {
      await result.current.activate();
    });

    expect(registerPushMock).toHaveBeenCalled();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("best-effort: registerPush lança → não propaga", async () => {
    registerPushMock.mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));

    await act(async () => {
      await result.current.activate();
    });

    expect(warn).toHaveBeenCalled();
    expect(result.current.activating).toBe(false);
  });
});

describe("usePushOptInPrompt — snooze", () => {
  it("persiste timestamp futuro e esconde o banner", async () => {
    const { result } = renderHook(() => usePushOptInPrompt());
    await waitFor(() => expect(result.current.shouldShow).toBe(true));

    act(() => {
      result.current.snooze();
    });

    expect(result.current.shouldShow).toBe(false);
    const stored = Number.parseInt(
      window.localStorage.getItem(PUSH_OPTIN_SNOOZE_KEY) ?? "0",
      10,
    );
    expect(stored).toBeGreaterThan(Date.now());
  });
});
