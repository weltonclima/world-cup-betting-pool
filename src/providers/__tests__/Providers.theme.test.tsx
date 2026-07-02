// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { useTheme } from "next-themes";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom não implementa matchMedia; next-themes (enableSystem) consulta
// prefers-color-scheme. Stub mínimo retornando "não corresponde" (SO em claro).
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

// TASK-02 — valida o wiring do ThemeProvider dentro de `Providers`:
// um consumidor de `useTheme` deve receber o contexto real do next-themes
// (default "light", enableSystem), não o fallback. As dependências pesadas
// (Firebase/sessão) são mockadas — este teste cobre APENAS o tema.

vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn(() => vi.fn()) }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(() => ({})), getDoc: vi.fn() }));
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
  authPersistenceReady: Promise.resolve(),
}));
// SessionRenewalManager é headless; neutralizamos o efeito de rede.
vi.mock("@/hooks/useSessionRenewal", () => ({ useSessionRenewal: vi.fn() }));

import { Providers } from "@/providers";

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

function ThemeProbe(): React.JSX.Element {
  const { theme, systemTheme, themes } = useTheme();
  // Serializa o estado do contexto em atributos para asserção.
  return (
    <span
      data-testid="theme-probe"
      data-theme={theme ?? ""}
      data-system={systemTheme ?? ""}
      data-themes={themes.join(",")}
    />
  );
}

describe("Providers — ThemeProvider (TASK-02)", () => {
  it("monta o ThemeProvider com default 'light' e enableSystem", async () => {
    render(
      <Providers>
        <ThemeProbe />
      </Providers>,
    );

    const probe = await screen.findByTestId("theme-probe");
    // Default configurado = light (comportamento claro preservado).
    await waitFor(() => expect(probe.getAttribute("data-theme")).toBe("light"));
    // enableSystem registra o tema "system" na lista de temas disponíveis.
    expect(probe.getAttribute("data-themes")).toContain("system");
    expect(probe.getAttribute("data-themes")).toContain("light");
    expect(probe.getAttribute("data-themes")).toContain("dark");
  });

  it("aplica a classe de tema no <html> (attribute='class')", async () => {
    render(
      <Providers>
        <ThemeProbe />
      </Providers>,
    );

    await screen.findByTestId("theme-probe");
    // next-themes com attribute="class" e tema light NÃO adiciona ".dark".
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(false),
    );
  });
});
