import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes da persistência client do Firebase Auth (TASK-01).
 *
 * Foco no contrato de comportamento de `src/firebase/client.ts`:
 * - `setPersistence` chamado com `browserLocalPersistence` no browser;
 * - `authPersistenceReady` é uma Promise aguardável;
 * - best-effort: falha de `setPersistence` NÃO rejeita `authPersistenceReady`;
 * - server-safe: sem `window`, `setPersistence` não é chamado.
 *
 * O ambiente padrão do Vitest é "node" (sem `window`), então o caminho
 * server-safe é o default; o caminho browser é exercitado com `window` stubado.
 * Cada teste reimporta o módulo (`vi.resetModules` + import dinâmico) para
 * reexecutar a inicialização com as condições do cenário.
 */

const setPersistenceMock =
  vi.fn<(...args: unknown[]) => Promise<void>>();
// Sentinela: identidade do `browserLocalPersistence` exportado pelo mock.
const browserLocalPersistenceSentinel = { __persistence: "local" } as const;
const getAuthMock = vi.fn(() => ({ __tag: "auth" }));

vi.mock("firebase/app", () => ({
  getApp: vi.fn(() => ({ __tag: "app" })),
  // getApps não-vazio: o singleton reaproveita o app, sem initializeApp real.
  getApps: vi.fn(() => [{ __tag: "app" }]),
  initializeApp: vi.fn(() => ({ __tag: "app" })),
}));

// Atenção: este mock cobre apenas os símbolos que `client.ts` importa hoje.
// Se `client.ts` passar a importar outro export de `firebase/auth` (ex.: um
// fallback `indexedDBLocalPersistence`), adicione-o aqui — senão o símbolo vem
// `undefined` e o erro será obscuro em runtime.
vi.mock("firebase/auth", () => ({
  getAuth: getAuthMock,
  connectAuthEmulator: vi.fn(),
  setPersistence: setPersistenceMock,
  browserLocalPersistence: browserLocalPersistenceSentinel,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ __tag: "firestore" })),
  connectFirestoreEmulator: vi.fn(),
}));

// Env mockada: evita ler NEXT_PUBLIC_* reais e desliga emuladores.
vi.mock("../env", () => ({
  firebaseClientEnv: {
    NEXT_PUBLIC_FIREBASE_API_KEY: "k",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "d",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "s",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "m",
    NEXT_PUBLIC_FIREBASE_APP_ID: "a",
  },
  useEmulators: false,
}));

beforeEach(() => {
  vi.resetModules();
  setPersistenceMock.mockReset();
  setPersistenceMock.mockResolvedValue(undefined);
  getAuthMock.mockClear();
  // Defensivo: o guard de emulador (client.ts) seta este global; limpa entre
  // módulos para que cenários futuros com emulador não fiquem order-dependent.
  delete globalThis.__FIREBASE_EMULATORS_CONNECTED__;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client — persistência (browser)", () => {
  beforeEach(() => {
    // Simula ambiente browser (`typeof window !== "undefined"`).
    vi.stubGlobal("window", {});
  });

  it("aplica browserLocalPersistence no Auth", async () => {
    const mod = await import("../client");
    await mod.authPersistenceReady;

    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
    const call = setPersistenceMock.mock.calls[0]!;
    // 1º argumento é a instância de Auth retornada por getAuth (não o app etc.).
    expect(call[0]).toBe(getAuthMock.mock.results[0]!.value);
    // 2º argumento é exatamente o browserLocalPersistence (sentinela do mock).
    expect(call[1]).toBe(browserLocalPersistenceSentinel);
  });

  it("expõe authPersistenceReady como Promise aguardável", async () => {
    const mod = await import("../client");
    expect(mod.authPersistenceReady).toBeInstanceOf(Promise);
    await expect(mod.authPersistenceReady).resolves.toBeUndefined();
  });

  it("best-effort: falha de setPersistence NÃO rejeita authPersistenceReady", async () => {
    setPersistenceMock.mockRejectedValue(new Error("storage indisponível"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const mod = await import("../client");

    // Não propaga: resolve mesmo com setPersistence rejeitando.
    await expect(mod.authPersistenceReady).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("client — persistência (server-safe, sem window)", () => {
  it("não chama setPersistence quando window é indefinido", async () => {
    // Ambiente node default: typeof window === "undefined".
    expect(typeof window).toBe("undefined");

    const mod = await import("../client");
    await mod.authPersistenceReady;

    expect(setPersistenceMock).not.toHaveBeenCalled();
    await expect(mod.authPersistenceReady).resolves.toBeUndefined();
  });
});
