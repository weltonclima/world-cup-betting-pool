// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canRequestPush,
  refreshPushTokenOnLoad,
  registerPush,
  unregisterPush,
} from "@/features/push/registration";
import {
  deletePushTokenLocal,
  getCurrentPushToken,
  requestPushToken,
} from "@/firebase/messaging";
import { deletePushToken, registerPushToken } from "@/services/pushTokens";

/**
 * Cobertura de `src/features/push/registration.ts` (web-push-pwa TASK-02):
 * gate iOS-standalone, fluxos de registro/limpeza e o lifecycle de re-registro,
 * todos best-effort. Mocka a camada de messaging e a de serviço de tokens.
 */

vi.mock("@/firebase/messaging", () => ({
  requestPushToken: vi.fn(),
  getCurrentPushToken: vi.fn(),
  deletePushTokenLocal: vi.fn(),
}));

vi.mock("@/services/pushTokens", () => ({
  registerPushToken: vi.fn(),
  deletePushToken: vi.fn(),
}));

const requestPushTokenMock = vi.mocked(requestPushToken);
const getCurrentPushTokenMock = vi.mocked(getCurrentPushToken);
const deletePushTokenLocalMock = vi.mocked(deletePushTokenLocal);
const registerPushTokenMock = vi.mocked(registerPushToken);
const deletePushTokenMock = vi.mocked(deletePushToken);

/** Configura plataforma: userAgent + standalone (matchMedia + navigator.standalone). */
function setPlatform(opts: {
  ua: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}) {
  Object.defineProperty(navigator, "userAgent", {
    value: opts.ua,
    configurable: true,
  });
  Object.defineProperty(navigator, "platform", {
    value: opts.platform ?? "",
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: opts.maxTouchPoints ?? 0,
    configurable: true,
  });
  Object.defineProperty(navigator, "standalone", {
    value: opts.standalone ?? false,
    configurable: true,
  });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: opts.standalone ?? false,
  }) as unknown as typeof window.matchMedia;
}

const ANDROID = "Mozilla/5.0 (Linux; Android 13) Chrome/120";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";

beforeEach(() => {
  setPlatform({ ua: ANDROID, standalone: false });
  requestPushTokenMock.mockResolvedValue("tok-123");
  getCurrentPushTokenMock.mockResolvedValue("tok-123");
  deletePushTokenLocalMock.mockResolvedValue(undefined);
  registerPushTokenMock.mockResolvedValue(undefined);
  deletePushTokenMock.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("canRequestPush (gate iOS)", () => {
  it("libera fora do iOS (Android)", () => {
    setPlatform({ ua: ANDROID, standalone: false });
    expect(canRequestPush()).toBe(true);
  });

  it("bloqueia em iOS aba não-instalada (não-standalone)", () => {
    setPlatform({ ua: IPHONE, standalone: false });
    expect(canRequestPush()).toBe(false);
  });

  it("libera em iOS instalado (standalone)", () => {
    setPlatform({ ua: IPHONE, standalone: true });
    expect(canRequestPush()).toBe(true);
  });

  it("detecta iPadOS (Macintosh + touch) e bloqueia se não-standalone", () => {
    setPlatform({
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      platform: "MacIntel",
      maxTouchPoints: 5,
      standalone: false,
    });
    expect(canRequestPush()).toBe(false);
  });
});

describe("registerPush", () => {
  it("happy path: obtém token e registra no backend", async () => {
    const token = await registerPush();
    expect(requestPushTokenMock).toHaveBeenCalled();
    expect(registerPushTokenMock).toHaveBeenCalledWith("tok-123");
    expect(token).toBe("tok-123");
  });

  it("no-op quando o gate iOS bloqueia (não pede token)", async () => {
    setPlatform({ ua: IPHONE, standalone: false });
    const token = await registerPush();
    expect(token).toBeNull();
    expect(requestPushTokenMock).not.toHaveBeenCalled();
    expect(registerPushTokenMock).not.toHaveBeenCalled();
  });

  it("null quando token não é obtido (sem suporte/negado)", async () => {
    requestPushTokenMock.mockResolvedValue(null);
    const token = await registerPush();
    expect(token).toBeNull();
    expect(registerPushTokenMock).not.toHaveBeenCalled();
  });

  it("best-effort: falha do POST não propaga", async () => {
    registerPushTokenMock.mockRejectedValue(new Error("network"));
    await expect(registerPush()).resolves.toBeNull();
  });
});

describe("refreshPushTokenOnLoad (lifecycle)", () => {
  it("re-registra o token quando há permissão (granted)", async () => {
    await refreshPushTokenOnLoad();
    expect(registerPushTokenMock).toHaveBeenCalledWith("tok-123");
  });

  it("no-op quando não há token corrente (sem permissão)", async () => {
    getCurrentPushTokenMock.mockResolvedValue(null);
    await refreshPushTokenOnLoad();
    expect(registerPushTokenMock).not.toHaveBeenCalled();
  });

  it("best-effort: falha do POST não propaga", async () => {
    registerPushTokenMock.mockRejectedValue(new Error("network"));
    await expect(refreshPushTokenOnLoad()).resolves.toBeUndefined();
  });
});

describe("unregisterPush (logout/revogação)", () => {
  it("remove no backend (DELETE) e revoga local", async () => {
    await unregisterPush();
    expect(deletePushTokenMock).toHaveBeenCalledWith("tok-123");
    expect(deletePushTokenLocalMock).toHaveBeenCalled();
  });

  it("sem token corrente: pula o DELETE mas revoga local", async () => {
    getCurrentPushTokenMock.mockResolvedValue(null);
    await unregisterPush();
    expect(deletePushTokenMock).not.toHaveBeenCalled();
    expect(deletePushTokenLocalMock).toHaveBeenCalled();
  });

  it("best-effort: falha do DELETE não propaga e ainda revoga local", async () => {
    deletePushTokenMock.mockRejectedValue(new Error("network"));
    await expect(unregisterPush()).resolves.toBeUndefined();
    expect(deletePushTokenLocalMock).toHaveBeenCalled();
  });
});
