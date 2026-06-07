// @vitest-environment jsdom
/**
 * Testes do componente MatchListHeader (TASK-04).
 *
 * Estratégia: renderização isolada com props controladas.
 * Verifica título, input de busca, botão de filtros e chips.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MatchListHeader } from "@/features/matches/components/MatchListHeader";
import type { MatchListHeaderProps } from "@/features/matches/components/MatchListHeader";

// ---------------------------------------------------------------------------
// Fixtures de props base
// ---------------------------------------------------------------------------

const defaultProps: MatchListHeaderProps = {
  searchQuery: "",
  onSearchChange: vi.fn(),
  selectedStage: undefined,
  onStageChange: vi.fn(),
  selectedPredictionStatus: undefined,
  onPredictionStatusChange: vi.fn(),
  onFiltersOpen: vi.fn(),
  filtersCount: 0,
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("MatchListHeader — título e estrutura", () => {
  it("T1: renderiza o título 'Jogos'", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByText("Jogos")).toBeTruthy();
  });

  it("T2: input de busca tem aria-label correto", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByLabelText("Buscar jogos por seleção")).toBeTruthy();
  });

  it("T3: botão de filtros avançados tem aria-label correto", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Abrir filtros avançados" })).toBeTruthy();
  });

  it("T4: grupo de chips tem aria-label='Filtros rápidos'", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByRole("group", { name: "Filtros rápidos" })).toBeTruthy();
  });
});

describe("MatchListHeader — campo de busca", () => {
  it("T5: exibe valor atual de searchQuery no input", () => {
    render(<MatchListHeader {...defaultProps} searchQuery="Brasil" />);
    const input = screen.getByLabelText("Buscar jogos por seleção") as HTMLInputElement;
    expect(input.value).toBe("Brasil");
  });

  it("T6: chama onSearchChange ao digitar", () => {
    const onSearchChange = vi.fn();
    render(<MatchListHeader {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Argentina" } });
    expect(onSearchChange).toHaveBeenCalledWith("Argentina");
  });
});

describe("MatchListHeader — botão de filtros avançados", () => {
  it("T7: chama onFiltersOpen ao clicar no botão", () => {
    const onFiltersOpen = vi.fn();
    render(<MatchListHeader {...defaultProps} onFiltersOpen={onFiltersOpen} />);
    const btn = screen.getByRole("button", { name: "Abrir filtros avançados" });
    fireEvent.click(btn);
    expect(onFiltersOpen).toHaveBeenCalledTimes(1);
  });

  it("T8: não exibe badge quando filtersCount é 0", () => {
    render(<MatchListHeader {...defaultProps} filtersCount={0} />);
    // Badge com aria-label de filtros não deve aparecer
    expect(screen.queryByLabelText(/filtro.* ativo/i)).toBeNull();
  });

  it("T9: exibe badge numérica quando filtersCount > 0", () => {
    render(<MatchListHeader {...defaultProps} filtersCount={2} />);
    // Badge com valor "2"
    expect(screen.getByText("2")).toBeTruthy();
  });
});

describe("MatchListHeader — chips de fase (Stage)", () => {
  it("T10: exibe chip 'Todas as fases' como selecionado quando selectedStage é undefined", () => {
    render(<MatchListHeader {...defaultProps} selectedStage={undefined} />);
    const chip = screen.getByRole("button", { name: "Todas as fases" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("T11: exibe chip 'Fase de Grupos'", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Fase de Grupos" })).toBeTruthy();
  });

  it("T12: chama onStageChange com 'grupos' ao clicar no chip Fase de Grupos", () => {
    const onStageChange = vi.fn();
    render(<MatchListHeader {...defaultProps} onStageChange={onStageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    expect(onStageChange).toHaveBeenCalledWith("grupos");
  });

  it("T13: chip de fase selecionada tem aria-pressed=true", () => {
    render(<MatchListHeader {...defaultProps} selectedStage="grupos" />);
    const chip = screen.getByRole("button", { name: "Fase de Grupos" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("T14: chip 'Todas as fases' deselecionado quando uma fase está ativa", () => {
    render(<MatchListHeader {...defaultProps} selectedStage="oitavas" />);
    const chip = screen.getByRole("button", { name: "Todas as fases" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  it("T15: clicar no chip de fase já selecionada chama onStageChange com undefined", () => {
    const onStageChange = vi.fn();
    render(
      <MatchListHeader {...defaultProps} selectedStage="grupos" onStageChange={onStageChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    expect(onStageChange).toHaveBeenCalledWith(undefined);
  });
});

describe("MatchListHeader — chips de status de palpite", () => {
  it("T16: exibe chip 'Todos' como selecionado quando selectedPredictionStatus é undefined", () => {
    render(<MatchListHeader {...defaultProps} selectedPredictionStatus={undefined} />);
    const chip = screen.getByRole("button", { name: "Todos" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("T17: exibe chips Enviados, Pendentes, Bloqueados", () => {
    render(<MatchListHeader {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Enviados" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pendentes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bloqueados" })).toBeTruthy();
  });

  it("T18: chama onPredictionStatusChange com 'enviado' ao clicar em Enviados", () => {
    const onPredictionStatusChange = vi.fn();
    render(
      <MatchListHeader {...defaultProps} onPredictionStatusChange={onPredictionStatusChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviados" }));
    expect(onPredictionStatusChange).toHaveBeenCalledWith("enviado");
  });

  it("T19: clicar no status já selecionado chama onPredictionStatusChange com undefined", () => {
    const onPredictionStatusChange = vi.fn();
    render(
      <MatchListHeader
        {...defaultProps}
        selectedPredictionStatus="pendente"
        onPredictionStatusChange={onPredictionStatusChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));
    expect(onPredictionStatusChange).toHaveBeenCalledWith(undefined);
  });

  it("T20: chip 'Todos' deselecionado quando um status está ativo", () => {
    render(<MatchListHeader {...defaultProps} selectedPredictionStatus="enviado" />);
    const chip = screen.getByRole("button", { name: "Todos" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });
});
