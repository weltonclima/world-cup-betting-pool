// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterSW } from "@/features/pwa/RegisterSW";

afterEach(() => {
  vi.restoreAllMocks();
  // limpa o serviceWorker injetado entre testes
  // @ts-expect-error — manipulação direta do mock no navigator
  delete navigator.serviceWorker;
});

describe("RegisterSW", () => {
  it("registra /sw.js com escopo raiz quando suportado", () => {
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    render(<RegisterSW />);

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("não lança quando serviceWorker não é suportado", () => {
    // sem serviceWorker no navigator (guard de suporte)
    expect(() => render(<RegisterSW />)).not.toThrow();
  });

  it("best-effort: rejeição de register() não propaga", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error("boom"));
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    expect(() => render(<RegisterSW />)).not.toThrow();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });

  it("não renderiza nenhum DOM (render null)", () => {
    const { container } = render(<RegisterSW />);
    expect(container.firstChild).toBeNull();
  });
});
