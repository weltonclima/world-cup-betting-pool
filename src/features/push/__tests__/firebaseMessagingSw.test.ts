// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobertura do service worker de FCM `public/firebase-messaging-sw.js`
 * (web-push-pwa TASK-02). O SW não é um módulo (usa `importScripts` + globais
 * `self`/`firebase`); aqui ele é executado num escopo de função com esses
 * globais stubbados, capturando o handler de `notificationclick`.
 */

const SW_PATH = resolve(__dirname, "../../../../public/firebase-messaging-sw.js");
const SW_CODE = readFileSync(SW_PATH, "utf8");
const ORIGIN = "https://app.test";

interface ClientStub {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
}

let handlers: Record<string, (event: unknown) => void>;
let clientsApi: {
  matchAll: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
};

function loadSw() {
  handlers = {};
  clientsApi = { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() };

  // Globais que o SW referencia livremente resolvem via globalThis.
  (globalThis as Record<string, unknown>).importScripts = vi.fn();
  (globalThis as Record<string, unknown>).firebase = {
    initializeApp: vi.fn(),
    messaging: vi.fn(),
  };
  (globalThis as Record<string, unknown>).self = {
    addEventListener: (ev: string, cb: (event: unknown) => void) => {
      handlers[ev] = cb;
    },
    location: { origin: ORIGIN },
    clients: clientsApi,
  };

  // Executa o SW (efeitos colaterais: registra o handler de notificationclick).
  new Function(SW_CODE)();
}

/** Dispara o notificationclick capturado e aguarda o waitUntil. */
async function clickWith(dataUrl?: string) {
  const close = vi.fn();
  let pending: Promise<unknown> = Promise.resolve();
  const event = {
    notification: { close, data: dataUrl === undefined ? undefined : { url: dataUrl } },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  };
  const handler = handlers["notificationclick"];
  if (!handler) throw new Error("notificationclick handler não registrado");
  handler(event);
  await pending;
  return { close };
}

beforeEach(() => {
  loadSw();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).importScripts;
  delete (globalThis as Record<string, unknown>).firebase;
  delete (globalThis as Record<string, unknown>).self;
});

describe("firebase-messaging-sw notificationclick", () => {
  it("registra o handler de notificationclick", () => {
    expect(typeof handlers["notificationclick"]).toBe("function");
  });

  it("sem aba aberta → abre nova janela na rota de data.url", async () => {
    clientsApi.matchAll.mockResolvedValue([]);
    const { close } = await clickWith("/jogos");
    expect(close).toHaveBeenCalled();
    expect(clientsApi.openWindow).toHaveBeenCalledWith(`${ORIGIN}/jogos`);
  });

  it("data.url ausente → fallback para '/'", async () => {
    clientsApi.matchAll.mockResolvedValue([]);
    await clickWith(undefined);
    expect(clientsApi.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("aba já aberta na mesma rota (ignora query) → navega e foca, sem nova janela", async () => {
    const focus = vi.fn();
    const navigate = vi.fn().mockResolvedValue(undefined);
    const client: ClientStub = { url: `${ORIGIN}/jogos?x=1`, focus, navigate };
    clientsApi.matchAll.mockResolvedValue([client]);

    await clickWith("/jogos");

    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/jogos`);
    expect(focus).toHaveBeenCalled();
    expect(clientsApi.openWindow).not.toHaveBeenCalled();
  });

  it("rota diferente aberta → abre nova janela (não foca a errada)", async () => {
    const focus = vi.fn();
    const client: ClientStub = { url: `${ORIGIN}/perfil`, focus };
    clientsApi.matchAll.mockResolvedValue([client]);

    await clickWith("/jogos");

    expect(focus).not.toHaveBeenCalled();
    expect(clientsApi.openWindow).toHaveBeenCalledWith(`${ORIGIN}/jogos`);
  });
});

describe("firebase-messaging-sw — guarda de drift de versão/config", () => {
  it("importScripts usa a versão de firebase instalada (package.json)", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../../../../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const installed = (pkg.dependencies?.firebase ?? "").replace(/[^0-9.]/g, "");
    expect(installed).not.toBe("");
    expect(SW_CODE).toContain(`firebasejs/${installed}/firebase-app-compat.js`);
    expect(SW_CODE).toContain(
      `firebasejs/${installed}/firebase-messaging-compat.js`,
    );
  });

  it("config inline aponta para o projeto Firebase correto", () => {
    expect(SW_CODE).toContain("world-cup-betting-pool-8e93c");
  });
});
