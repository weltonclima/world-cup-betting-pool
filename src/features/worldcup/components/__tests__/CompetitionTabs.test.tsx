// @vitest-environment jsdom
/**
 * Testes do componente CompetitionTabs (TASK-06).
 *
 * Estratégia: mock de usePathname; next/link renderiza <a> no jsdom.
 * Verifica: links presentes, aria-current correto por rota, retorno null em rotas de detalhe.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompetitionTabs } from "@/features/worldcup/components/CompetitionTabs";

// ---------------------------------------------------------------------------
// Mock de next/navigation
// ---------------------------------------------------------------------------

const { pathnameState } = vi.hoisted(() => ({
  pathnameState: { value: "/matches" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  pathnameState.value = "/matches";
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("CompetitionTabs — rota /matches (Partidas)", () => {
  it("T1: renderiza os 3 links de navegação", () => {
    render(<CompetitionTabs />);
    expect(screen.getByRole("link", { name: "Partidas" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Grupos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Eliminatórias" })).toBeTruthy();
  });

  it("T2: 'Partidas' tem aria-current='page' em /matches", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Partidas" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("T3: 'Grupos' e 'Eliminatórias' NÃO têm aria-current em /matches", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Grupos" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Eliminatórias" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("CompetitionTabs — rota /matches/grupos", () => {
  beforeEach(() => {
    pathnameState.value = "/matches/grupos";
  });

  it("T4: 'Grupos' tem aria-current='page' em /matches/grupos", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Grupos" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("T5: 'Partidas' e 'Eliminatórias' NÃO têm aria-current em /matches/grupos", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Partidas" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Eliminatórias" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("CompetitionTabs — rota /matches/eliminatorias", () => {
  beforeEach(() => {
    pathnameState.value = "/matches/eliminatorias";
  });

  it("T6: 'Eliminatórias' tem aria-current='page' em /matches/eliminatorias", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Eliminatórias" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("T7: 'Partidas' e 'Grupos' NÃO têm aria-current em /matches/eliminatorias", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Partidas" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Grupos" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("CompetitionTabs — hrefs corretos", () => {
  it("T8: links apontam para as rotas corretas", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Partidas" }).getAttribute("href"),
    ).toBe("/matches");
    expect(
      screen.getByRole("link", { name: "Grupos" }).getAttribute("href"),
    ).toBe("/matches/grupos");
    expect(
      screen.getByRole("link", { name: "Eliminatórias" }).getAttribute("href"),
    ).toBe("/matches/eliminatorias");
  });
});

describe("CompetitionTabs — rotas de detalhe (null)", () => {
  it("T9: retorna null em /matches/m73 (detalhe)", () => {
    pathnameState.value = "/matches/m73";
    const { container } = render(<CompetitionTabs />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("T10: retorna null em /matches/m73/predict", () => {
    pathnameState.value = "/matches/m73/predict";
    const { container } = render(<CompetitionTabs />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("T11: retorna null em /matches/qualquer-outra-coisa", () => {
    pathnameState.value = "/matches/outra-rota";
    const { container } = render(<CompetitionTabs />);
    expect(container.firstChild).toBeNull();
  });
});

describe("CompetitionTabs — elemento <nav> e semântica", () => {
  it("T12: renderiza <nav> com aria-label='Seções de Jogos'", () => {
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("navigation", { name: "Seções de Jogos" }),
    ).toBeTruthy();
  });
});
