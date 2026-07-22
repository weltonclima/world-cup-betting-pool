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

const { pathnameState, isCupMock } = vi.hoisted(() => ({
  pathnameState: { value: "/matches" },
  isCupMock: vi.fn(() => true),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

// Gate de tipo (TASK-10): CompetitionTabs oculta Grupos/Eliminatórias p/ liga.
vi.mock("@/features/championships", () => ({
  useIsCupActive: () => isCupMock(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  pathnameState.value = "/matches";
  isCupMock.mockReturnValue(true);
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

describe("CompetitionTabs — gate cup/league (TASK-10)", () => {
  it("T13: liga ativa → mostra só 'Partidas' (Grupos/Eliminatórias ausentes)", () => {
    isCupMock.mockReturnValue(false);
    render(<CompetitionTabs />);
    expect(screen.getByRole("link", { name: "Partidas" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Grupos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Eliminatórias" })).toBeNull();
  });

  it("T14: copa ativa → mantém as 3 abas (sem regressão)", () => {
    isCupMock.mockReturnValue(true);
    render(<CompetitionTabs />);
    expect(screen.getByRole("link", { name: "Partidas" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Grupos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Eliminatórias" })).toBeTruthy();
  });

  it("T15: liga ativa → <nav> ainda presente (só com Partidas)", () => {
    isCupMock.mockReturnValue(false);
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("navigation", { name: "Seções de Jogos" }),
    ).toBeTruthy();
  });
});

describe("CompetitionTabs — aba Classificação league-only (TASK-20)", () => {
  it("T16: liga ativa → mostra 'Classificação' (Grupos/Eliminatórias ausentes)", () => {
    isCupMock.mockReturnValue(false);
    render(<CompetitionTabs />);
    expect(screen.getByRole("link", { name: "Classificação" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Partidas" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Grupos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Eliminatórias" })).toBeNull();
  });

  it("T17: copa ativa → 'Classificação' ausente (gate invertido)", () => {
    isCupMock.mockReturnValue(true);
    render(<CompetitionTabs />);
    expect(screen.queryByRole("link", { name: "Classificação" })).toBeNull();
  });

  it("T18: href de 'Classificação' aponta para /matches/classificacao", () => {
    isCupMock.mockReturnValue(false);
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Classificação" }).getAttribute("href"),
    ).toBe("/matches/classificacao");
  });

  it("T19: 'Classificação' tem aria-current='page' em /matches/classificacao", () => {
    isCupMock.mockReturnValue(false);
    pathnameState.value = "/matches/classificacao";
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("link", { name: "Classificação" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("T20: exibe abas na rota /matches/classificacao (não retorna null)", () => {
    isCupMock.mockReturnValue(false);
    pathnameState.value = "/matches/classificacao";
    render(<CompetitionTabs />);
    expect(
      screen.getByRole("navigation", { name: "Seções de Jogos" }),
    ).toBeTruthy();
  });
});
