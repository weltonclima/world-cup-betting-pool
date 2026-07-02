// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSelector } from "@/features/profile/components/ThemeSelector";

const setTheme = vi.fn();
const mutateAsync = vi.fn();
const toastError = vi.fn();

// Estado mutável do mock de next-themes (ajustado por teste).
const themeState = { theme: "light" as string | undefined };
const mutationState = { isPending: false };

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: themeState.theme, setTheme }),
}));

vi.mock("@/features/profile/hooks", () => ({
  useUpdateProfile: () => ({
    mutateAsync,
    isPending: mutationState.isPending,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m) },
}));

beforeEach(() => {
  setTheme.mockReset();
  mutateAsync.mockReset().mockResolvedValue(undefined);
  toastError.mockReset();
  themeState.theme = "light";
  mutationState.isPending = false;
});

describe("ThemeSelector", () => {
  it("renderiza as 3 opções com rótulos pt-BR", () => {
    render(<ThemeSelector />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByText("Claro")).toBeTruthy();
    expect(screen.getByText("Escuro")).toBeTruthy();
    expect(screen.getByText("Automático")).toBeTruthy();
  });

  it("marca aria-checked na opção correspondente ao tema atual", () => {
    themeState.theme = "dark";
    render(<ThemeSelector />);
    const escuro = screen
      .getByText("Escuro")
      .closest('[role="radio"]') as HTMLElement;
    expect(escuro.getAttribute("aria-checked")).toBe("true");
    const claro = screen
      .getByText("Claro")
      .closest('[role="radio"]') as HTMLElement;
    expect(claro.getAttribute("aria-checked")).toBe("false");
  });

  it("clicar numa opção aplica o tema e persiste a preferência", async () => {
    render(<ThemeSelector />);
    fireEvent.click(screen.getByText("Escuro"));

    expect(setTheme).toHaveBeenCalledWith("dark");
    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ themePreference: "dark" }),
    );
  });

  it("seleciona Automático → tema system", async () => {
    render(<ThemeSelector />);
    fireEvent.click(screen.getByText("Automático"));

    expect(setTheme).toHaveBeenCalledWith("system");
    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ themePreference: "system" }),
    );
  });

  it("falha de persistência mostra toast, mas mantém o tema aplicado", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("offline"));
    render(<ThemeSelector />);

    fireEvent.click(screen.getByText("Escuro"));

    // Tema já aplicado (otimista), independentemente do erro.
    expect(setTheme).toHaveBeenCalledWith("dark");
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
  });

  it("desabilita as opções enquanto a persistência está pendente", () => {
    mutationState.isPending = true;
    render(<ThemeSelector />);
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
