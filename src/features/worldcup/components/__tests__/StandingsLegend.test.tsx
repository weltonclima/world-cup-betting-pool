// @vitest-environment jsdom
/**
 * Testes do StandingsLegend (TASK-07).
 *
 * Smoke test: verifica presença dos rótulos de abreviações e qualificação.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StandingsLegend } from "@/features/worldcup/components/StandingsLegend";

describe("StandingsLegend", () => {
  it("T1: renderiza sem erro (smoke)", () => {
    const { container } = render(<StandingsLegend />);
    expect(container.firstChild).toBeTruthy();
  });

  it("T2: exibe texto com abreviações de colunas", () => {
    render(<StandingsLegend />);
    // Verifica presença das abreviações principais
    expect(screen.getByText(/J Jogos/)).toBeTruthy();
    expect(screen.getByText(/PTS Pontos/)).toBeTruthy();
  });

  it("T3: exibe rótulo 'Classificado' na legenda de cores", () => {
    render(<StandingsLegend />);
    expect(screen.getByText("Classificado")).toBeTruthy();
  });

  it("T4: exibe rótulo 'Possível classificado' na legenda de cores", () => {
    render(<StandingsLegend />);
    expect(screen.getByText("Possível classificado")).toBeTruthy();
  });

  it("T5: exibe rótulo 'Eliminado' na legenda de cores", () => {
    render(<StandingsLegend />);
    expect(screen.getByText("Eliminado")).toBeTruthy();
  });

  it("T6: exibe abreviações V, E, D, GP, GC, SG no texto", () => {
    render(<StandingsLegend />);
    // Verifica cada abreviação presente na string completa
    const text = screen.getByText(/J Jogos/);
    expect(text.textContent).toContain("V Vitórias");
    expect(text.textContent).toContain("E Empates");
    expect(text.textContent).toContain("D Derrotas");
    expect(text.textContent).toContain("GP Gols Pró");
    expect(text.textContent).toContain("GC Gols Contra");
    expect(text.textContent).toContain("SG Saldo de Gols");
  });
});
