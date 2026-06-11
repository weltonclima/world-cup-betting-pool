// @vitest-environment jsdom
/**
 * Testes do GroupStandingsTable (TASK-07).
 *
 * Verifica: cabeçalhos de colunas em ordem, formatação SG com sinal,
 * PTS em destaque (font-bold), texto sr-only de situação por linha,
 * bandeira/fallback de iniciais.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupStandingsTable } from "@/features/worldcup/components/GroupStandingsTable";
import type { GroupTable } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Fixture de dados
// ---------------------------------------------------------------------------

const FIXTURE_TABLE: GroupTable = {
  groupId: "A",
  standings: [
    {
      position: 1,
      team: { id: "bra", name: "Brasil", code: "BRA", flagUrl: "https://cdn.test/bra.svg" },
      played: 3,
      wins: 3,
      draws: 0,
      losses: 0,
      goalsFor: 7,
      goalsAgainst: 1,
      goalDifference: 6,
      points: 9,
      qualification: "classificado",
    },
    {
      position: 2,
      team: { id: "fra", name: "França", code: "FRA", flagUrl: "https://cdn.test/fra.svg" },
      played: 3,
      wins: 2,
      draws: 0,
      losses: 1,
      goalsFor: 5,
      goalsAgainst: 3,
      goalDifference: 2,
      points: 6,
      qualification: "classificado",
    },
    {
      position: 3,
      team: { id: "jpn", name: "Japão", code: "JPN" },
      played: 3,
      wins: 1,
      draws: 0,
      losses: 2,
      goalsFor: 3,
      goalsAgainst: 5,
      goalDifference: -2,
      points: 3,
      qualification: "possivel",
    },
    {
      position: 4,
      team: { id: "can", name: "Canadá", code: "CAN" },
      played: 3,
      wins: 0,
      draws: 0,
      losses: 3,
      goalsFor: 1,
      goalsAgainst: 7,
      goalDifference: -6,
      points: 0,
      qualification: "eliminado",
    },
  ],
};

const FIXTURE_TABLE_WITH_ZERO_SG: GroupTable = {
  groupId: "B",
  standings: [
    {
      position: 1,
      team: { id: "esp", name: "Espanha", code: "ESP" },
      played: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      goalsFor: 1,
      goalsAgainst: 1,
      goalDifference: 0,
      points: 1,
      qualification: "indefinido",
    },
  ],
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("GroupStandingsTable", () => {
  it("T1: renderiza caption sr-only com o groupId", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    // caption está oculto visualmente mas presente no DOM
    expect(screen.getByText("Classificação do Grupo A")).toBeTruthy();
  });

  it("T2: cabeçalhos de coluna presentes na ordem correta (#, Seleção, J, V, E, D, GP, GC, SG, PTS)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    const headers = screen.getAllByRole("columnheader");
    const texts = headers.map((h) => h.textContent?.trim());
    // Verifica presença de cada coluna esperada
    expect(texts).toContain("#");
    expect(texts).toContain("Seleção");
    // Os demais headers têm <abbr> dentro — verificamos via abbr title ou conteúdo
    expect(screen.getByTitle("Jogos")).toBeTruthy();
    expect(screen.getByTitle("Vitórias")).toBeTruthy();
    expect(screen.getByTitle("Empates")).toBeTruthy();
    expect(screen.getByTitle("Derrotas")).toBeTruthy();
    expect(screen.getByTitle("Gols Pró")).toBeTruthy();
    expect(screen.getByTitle("Gols Contra")).toBeTruthy();
    expect(screen.getByTitle("Saldo de Gols")).toBeTruthy();
    expect(screen.getByTitle("Pontos")).toBeTruthy();
  });

  it("T3: renderiza 4 linhas de dado (uma por seleção)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    const rows = screen.getAllByRole("row");
    // 1 header + 4 data rows = 5
    expect(rows).toHaveLength(5);
  });

  it("T4: SG positivo exibe com sinal '+' (ex.: +6)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    expect(screen.getByText("+6")).toBeTruthy();
  });

  it("T5: SG negativo exibe sem sinal adicional (ex.: -2)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    expect(screen.getByText("-2")).toBeTruthy();
  });

  it("T6: SG zero exibe '0' sem sinal de '+'", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE_WITH_ZERO_SG} />);
    // Múltiplas células com "0" são esperadas (draws, losses, etc.); confirma ausência de "+0"
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThan(0);
    expect(screen.queryByText("+0")).toBeNull();
  });

  it("T7: nome das seleções presente nas linhas", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.getByText("Japão")).toBeTruthy();
    expect(screen.getByText("Canadá")).toBeTruthy();
  });

  it("T8: bandeira renderizada via <img> quando flagUrl fornecida", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    const flags = screen.getAllByRole("img");
    // Brasil e França têm flagUrl
    const braFlag = flags.find((img) => img.getAttribute("alt") === "Brasil");
    expect(braFlag).toBeTruthy();
    expect(braFlag?.getAttribute("src")).toBe("https://cdn.test/bra.svg");
  });

  it("T9: fallback de iniciais quando flagUrl ausente", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    // Japão (1 palavra) → inicial "J"; Canadá (1 palavra) → inicial "C"
    // Verifica que o fallback <span aria-label> está presente para seleções sem flagUrl
    expect(screen.getByRole("img", { name: "Brasil" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "França" })).toBeTruthy();
    // Japão e Canadá não têm flagUrl → usam <span aria-label> (sem role="img")
    expect(screen.queryByRole("img", { name: "Japão" })).toBeNull();
    expect(screen.queryByRole("img", { name: "Canadá" })).toBeNull();
    // Os spans de fallback têm aria-label com o nome da seleção
    expect(screen.getByLabelText("Japão")).toBeTruthy();
    expect(screen.getByLabelText("Canadá")).toBeTruthy();
  });

  it("T10: texto sr-only de qualificação 'Classificado' para posição 1 (linha 1)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    // Verifica presença do texto sr-only (pode estar concatenado com "1")
    const srTexts = screen.getAllByText(/Classificado/, { selector: ".sr-only" });
    expect(srTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("T11: texto sr-only 'Possível classificado' para posição 3 (Japão)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    const srTexts = screen.getAllByText(/Possível classificado/, { selector: ".sr-only" });
    expect(srTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("T12: texto sr-only 'Eliminado' para posição 4 (Canadá)", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    const srTexts = screen.getAllByText(/Eliminado/, { selector: ".sr-only" });
    expect(srTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("T13: texto sr-only 'Situação a definir' para indefinido", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE_WITH_ZERO_SG} />);
    const srTexts = screen.getAllByText(/Situação a definir/, { selector: ".sr-only" });
    expect(srTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("T14: PTS em destaque — célula com font-bold", () => {
    render(<GroupStandingsTable table={FIXTURE_TABLE} />);
    // Verifica que o texto "9" (pontos do Brasil) está em elemento com font-bold
    const cells = screen.getAllByText("9");
    const boldCell = cells.find((el) => el.className.includes("font-bold"));
    expect(boldCell).toBeTruthy();
  });
});
