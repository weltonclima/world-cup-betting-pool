// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPasskeyHint,
  hasPasskeyHint,
  markPasskeyRegistered,
} from "../passkeyHint";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("passkeyHint", () => {
  it("sem nada gravado: hasPasskeyHint = false", () => {
    expect(hasPasskeyHint()).toBe(false);
  });

  it("mark → has = true; clear → has = false (ciclo completo)", () => {
    markPasskeyRegistered();
    expect(hasPasskeyHint()).toBe(true);

    clearPasskeyHint();
    expect(hasPasskeyHint()).toBe(false);
  });

  it("hasPasskeyHint só aceita o valor canônico '1' (não qualquer truthy)", () => {
    window.localStorage.setItem("bolao:passkey-hint", "true");
    expect(hasPasskeyHint()).toBe(false);
  });

  it("storage que lança em setItem: mark é best-effort, não propaga", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => markPasskeyRegistered()).not.toThrow();
  });

  it("storage que lança em getItem: has retorna false sem propagar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => hasPasskeyHint()).not.toThrow();
    expect(hasPasskeyHint()).toBe(false);
  });

  it("storage que lança em removeItem: clear é best-effort, não propaga", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearPasskeyHint()).not.toThrow();
  });
});
