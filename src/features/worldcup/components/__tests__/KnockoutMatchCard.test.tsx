// @vitest-environment jsdom
/**
 * Testes do KnockoutMatchCard (TASK-08).
 *
 * Verifica as 3 variantes por status: aguardando, definido, encerrado.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KnockoutMatchCard } from "@/features/worldcup/components/KnockoutMatchCard";
import type { KnockoutMatch } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENCERRADO: KnockoutMatch = {
  id: "m73",
  phase: "dezesseis-avos",
  homeTeam: { name: "Brasil", code: "BRA", flagUrl: "https://cdn.test/bra.svg", defined: true },
  awayTeam: { name: "França", code: "FRA", flagUrl: "https://cdn.test/fra.svg", defined: true },
  homeScore: 2,
  awayScore: 1,
  status: "encerrado",
};

const DEFINIDO: KnockoutMatch = {
  id: "m74",
  phase: "dezesseis-avos",
  homeTeam: { name: "Argentina", code: "ARG", defined: true },
  awayTeam: { name: "México", code: "MEX", defined: true },
  status: "definido",
};

const AGUARDANDO: KnockoutMatch = {
  id: "m75",
  phase: "dezesseis-avos",
  homeTeam: { name: "Vencedor Jogo 74", defined: false },
  awayTeam: { name: "1º do Grupo A", defined: false },
  status: "aguardando",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("KnockoutMatchCard — encerrado", () => {
  it("T1: exibe placar e nomes das seleções", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("T2: tem aria-label com o resultado completo", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.getByLabelText("Brasil 2 x 1 França")).toBeTruthy();
  });

  it("T3: NÃO exibe 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.queryByText("Aguardando definição")).toBeNull();
  });

  it("T4: renderiza bandeiras via <img> quando flagUrl presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.some((i) => i.getAttribute("alt") === "Brasil")).toBe(true);
    expect(imgs.some((i) => i.getAttribute("alt") === "França")).toBe(true);
  });
});

describe("KnockoutMatchCard — definido", () => {
  it("T5: exibe nomes das seleções e nenhum placar", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("México")).toBeTruthy();
    // Separador "x" presente, sem números de placar
    expect(screen.getByText("x")).toBeTruthy();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("T6: NÃO exibe 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.queryByText("Aguardando definição")).toBeNull();
  });

  it("T7: fallback de iniciais quando flagUrl ausente (lado defined)", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    // Argentina e México não têm flagUrl → usam <span aria-label>, sem role="img"
    expect(screen.queryByRole("img", { name: "Argentina" })).toBeNull();
    expect(screen.getByLabelText("Argentina")).toBeTruthy();
    expect(screen.getByLabelText("México")).toBeTruthy();
  });
});

describe("KnockoutMatchCard — aguardando", () => {
  it("T8: exibe rótulos placeholder + 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.getByText("Vencedor Jogo 74")).toBeTruthy();
    expect(screen.getByText("1º do Grupo A")).toBeTruthy();
    expect(screen.getByText("Aguardando definição")).toBeTruthy();
  });

  it("T9: lado não definido NÃO renderiza <img> de bandeira", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("T10: NÃO exibe placar", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    // Apenas o separador "x", sem números
    expect(screen.queryByText("0")).toBeNull();
  });
});
