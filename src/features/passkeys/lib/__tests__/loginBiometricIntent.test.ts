// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearBiometricIntent,
  consumeBiometricIntent,
  setBiometricIntent,
} from "../loginBiometricIntent";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("loginBiometricIntent", () => {
  it("sem nada gravado: consume = false", () => {
    expect(consumeBiometricIntent()).toBe(false);
  });

  it("set → consume retorna true e LIMPA (segundo consume = false)", () => {
    setBiometricIntent();
    expect(consumeBiometricIntent()).toBe(true);
    expect(consumeBiometricIntent()).toBe(false);
  });

  it("set → clear → consume = false", () => {
    setBiometricIntent();
    clearBiometricIntent();
    expect(consumeBiometricIntent()).toBe(false);
  });

  it("só aceita o valor canônico '1' (não qualquer truthy)", () => {
    window.sessionStorage.setItem("bolao:activate-biometric-intent", "true");
    expect(consumeBiometricIntent()).toBe(false);
  });

  it("storage que lança em setItem: best-effort, não propaga", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => setBiometricIntent()).not.toThrow();
  });

  it("storage que lança em getItem: consume retorna false sem propagar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => consumeBiometricIntent()).not.toThrow();
    expect(consumeBiometricIntent()).toBe(false);
  });
});
