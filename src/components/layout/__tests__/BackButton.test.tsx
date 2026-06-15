// @vitest-environment jsdom

/**
 * Testes de `BackButton` — botão de voltar reutilizável das sub-telas.
 *
 * Cobertura:
 * - renderiza com aria-label padrão "Voltar"
 * - clique chama router.back()
 * - aceita label customizado (a11y)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock, push: vi.fn() }),
}));

import { BackButton } from "@/components/layout/BackButton";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackButton", () => {
  it("renderiza com aria-label padrão 'Voltar'", () => {
    render(<BackButton />);
    // getByRole lança se ausente — a presença é a própria asserção.
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
  });

  it("chama router.back() ao clicar", async () => {
    const user = userEvent.setup();
    render(<BackButton />);

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("aceita label customizado", () => {
    render(<BackButton label="Voltar para os grupos" />);
    expect(
      screen.getByRole("button", { name: "Voltar para os grupos" }),
    ).toBeTruthy();
  });
});
