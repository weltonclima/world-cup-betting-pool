// @vitest-environment jsdom
/**
 * Testes do LeagueStandingsTable (TASK-20).
 *
 * Presentacional puro. Verifica: linhas na ordem recebida, escudo com alt=name,
 * fallback de iniciais quando sem crestUrl, formatação do saldo (+N/0/-N), PTS.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeagueStandingsTable } from "@/features/worldcup/components/LeagueStandingsTable";
import type { LeagueStanding } from "@/types/leagues";

const TABLE: LeagueStanding[] = [
  {
    position: 1,
    team: { id: "83", name: "Flamengo", crestUrl: "https://espn/fla.png" },
    played: 2, wins: 2, draws: 0, losses: 0,
    goalsFor: 4, goalsAgainst: 1, goalDifference: 3, points: 6,
  },
  {
    position: 2,
    team: { id: "133", name: "Palmeiras" }, // sem crest → fallback iniciais
    played: 2, wins: 0, draws: 1, losses: 1,
    goalsFor: 1, goalsAgainst: 4, goalDifference: -3, points: 1,
  },
];

describe("LeagueStandingsTable", () => {
  it("renderiza uma linha por time na ordem recebida", () => {
    render(<LeagueStandingsTable table={TABLE} />);
    const rows = screen.getAllByRole("row");
    // header + 2 linhas
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("Flamengo")).toBeTruthy();
    expect(within(rows[2]!).getByText("Palmeiras")).toBeTruthy();
  });

  it("escudo renderiza com alt = nome do clube quando há crestUrl", () => {
    render(<LeagueStandingsTable table={TABLE} />);
    const img = screen.getByAltText("Flamengo") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("https://espn/fla.png");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("sem crestUrl → fallback de iniciais com aria-label do nome", () => {
    render(<LeagueStandingsTable table={TABLE} />);
    // Palmeiras sem escudo → span com aria-label
    expect(screen.getByLabelText("Palmeiras")).toBeTruthy();
    // Nenhuma imagem para Palmeiras
    expect(screen.queryByAltText("Palmeiras")).toBeNull();
  });

  it("formata saldo positivo com '+' e negativo com '-'", () => {
    render(<LeagueStandingsTable table={TABLE} />);
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("-3")).toBeTruthy();
  });

  it("exibe pontos de cada time na última coluna (PTS)", () => {
    render(<LeagueStandingsTable table={TABLE} />);
    const rows = screen.getAllByRole("row");
    // PTS = última célula da linha (10 colunas: # Clube J V E D GP GC SG PTS)
    const flaCells = within(rows[1]!).getAllByRole("cell");
    const palCells = within(rows[2]!).getAllByRole("cell");
    expect(flaCells[flaCells.length - 1]!.textContent).toBe("6");
    expect(palCells[palCells.length - 1]!.textContent).toBe("1");
  });

  it("tabela vazia → só o cabeçalho", () => {
    render(<LeagueStandingsTable table={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
