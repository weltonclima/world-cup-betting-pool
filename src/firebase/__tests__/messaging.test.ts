// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobertura de `src/firebase/messaging.ts` (web-push-pwa TASK-02).
 *
 * APIs de browser/FCM não são unit-testáveis de fato → testadas via mocks de
 * `firebase/messaging` + globais de browser (Notification). O módulo lê a VAPID
 * key e memoiza a instância no import → cada teste recarrega o módulo isolado
 * (`vi.resetModules` + import dinâmico) para variar suporte/VAPID/permissão.
 */

const fcm = {
  isSupported: vi.fn(),
  getMessaging: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  onMessage: vi.fn(),
};

vi.mock("firebase/messaging", () => ({
  isSupported: (...a: unknown[]) => fcm.isSupported(...a),
  getMessaging: (...a: unknown[]) => fcm.getMessaging(...a),
  getToken: (...a: unknown[]) => fcm.getToken(...a),
  deleteToken: (...a: unknown[]) => fcm.deleteToken(...a),
  onMessage: (...a: unknown[]) => fcm.onMessage(...a),
}));

vi.mock("@/firebase/client", () => ({ firebaseApp: { name: "test-app" } }));

// VAPID key controlada por teste (getter → leitura viva no re-import).
const envState = { vapid: "VAPID_TEST" as string | undefined };
vi.mock("@/firebase/env", () => ({
  get firebaseClientEnv() {
    return { NEXT_PUBLIC_FIREBASE_VAPID_KEY: envState.vapid };
  },
}));

async function loadModule() {
  vi.resetModules();
  return import("@/firebase/messaging");
}

function setPermission(value: NotificationPermission | undefined) {
  if (value === undefined) {
    // remove Notification do global (browser sem suporte)
    // @ts-expect-error manipulação de global no teste
    delete globalThis.Notification;
    return;
  }
  // @ts-expect-error stub mínimo de Notification
  globalThis.Notification = { permission: value };
}

beforeEach(() => {
  envState.vapid = "VAPID_TEST";
  fcm.isSupported.mockResolvedValue(true);
  fcm.getMessaging.mockReturnValue({ instance: true });
  fcm.getToken.mockResolvedValue("tok-123");
  fcm.deleteToken.mockResolvedValue(true);
  setPermission("granted");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("isPushSupported", () => {
  it("true quando isSupported e VAPID presentes", async () => {
    const m = await loadModule();
    await expect(m.isPushSupported()).resolves.toBe(true);
  });

  it("false quando VAPID ausente (não consulta isSupported)", async () => {
    envState.vapid = undefined;
    const m = await loadModule();
    await expect(m.isPushSupported()).resolves.toBe(false);
    expect(fcm.isSupported).not.toHaveBeenCalled();
  });

  it("false quando o browser não suporta (isSupported false)", async () => {
    fcm.isSupported.mockResolvedValue(false);
    const m = await loadModule();
    await expect(m.isPushSupported()).resolves.toBe(false);
  });

  it("false (sem lançar) quando isSupported rejeita", async () => {
    fcm.isSupported.mockRejectedValue(new Error("boom"));
    const m = await loadModule();
    await expect(m.isPushSupported()).resolves.toBe(false);
  });
});

describe("requestPushToken", () => {
  it("retorna o token quando getToken resolve", async () => {
    const m = await loadModule();
    await expect(m.requestPushToken()).resolves.toBe("tok-123");
    expect(fcm.getToken).toHaveBeenCalledWith(
      { instance: true },
      { vapidKey: "VAPID_TEST" },
    );
  });

  it("null quando VAPID ausente (não chama getToken)", async () => {
    envState.vapid = undefined;
    const m = await loadModule();
    await expect(m.requestPushToken()).resolves.toBeNull();
    expect(fcm.getToken).not.toHaveBeenCalled();
  });

  it("null (best-effort) quando getToken lança — permissão bloqueada", async () => {
    fcm.getToken.mockRejectedValue(new Error("permission-blocked"));
    const m = await loadModule();
    await expect(m.requestPushToken()).resolves.toBeNull();
  });

  it("null quando getToken devolve string vazia", async () => {
    fcm.getToken.mockResolvedValue("");
    const m = await loadModule();
    await expect(m.requestPushToken()).resolves.toBeNull();
  });
});

describe("getCurrentPushToken", () => {
  it("lê o token sem prompt quando permissão é granted", async () => {
    setPermission("granted");
    const m = await loadModule();
    await expect(m.getCurrentPushToken()).resolves.toBe("tok-123");
  });

  it("null quando permissão não é granted (não chama getToken)", async () => {
    setPermission("default");
    const m = await loadModule();
    await expect(m.getCurrentPushToken()).resolves.toBeNull();
    expect(fcm.getToken).not.toHaveBeenCalled();
  });

  it("null quando Notification indisponível (sem suporte)", async () => {
    setPermission(undefined);
    const m = await loadModule();
    await expect(m.getCurrentPushToken()).resolves.toBeNull();
  });
});

describe("deletePushTokenLocal", () => {
  it("revoga o token via deleteToken", async () => {
    const m = await loadModule();
    await m.deletePushTokenLocal();
    expect(fcm.deleteToken).toHaveBeenCalledWith({ instance: true });
  });

  it("best-effort: não lança quando deleteToken rejeita", async () => {
    fcm.deleteToken.mockRejectedValue(new Error("boom"));
    const m = await loadModule();
    await expect(m.deletePushTokenLocal()).resolves.toBeUndefined();
  });

  it("no-op quando sem suporte (isSupported false)", async () => {
    fcm.isSupported.mockResolvedValue(false);
    const m = await loadModule();
    await m.deletePushTokenLocal();
    expect(fcm.deleteToken).not.toHaveBeenCalled();
  });
});

describe("onForegroundMessage", () => {
  it("subscreve onMessage e devolve unsubscribe funcional", async () => {
    const unsub = vi.fn();
    fcm.onMessage.mockReturnValue(unsub);
    const m = await loadModule();

    const cb = vi.fn();
    const teardown = m.onForegroundMessage(cb);
    // a subscrição resolve no microtask de getMessagingIfSupported
    await vi.waitFor(() => expect(fcm.onMessage).toHaveBeenCalled());

    teardown();
    expect(unsub).toHaveBeenCalled();
  });
});
