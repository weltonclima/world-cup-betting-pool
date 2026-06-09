// @vitest-environment jsdom
/**
 * Testes do componente MatchFiltersSheet (TASK-05).
 *
 * Estratégia:
 *  - Mock de useTeams para controlar a lista de seleções.
 *  - Mock do Base UI Dialog (porta do shadcn Sheet) para evitar problemas de portal/jsdom.
 *  - Exercita: abertura/fechamento, seleção de fase, seleção de status, seleção de team,
 *    busca de seleção, ações Aplicar/Limpar, sincronização de rascunho ao reabrir.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

// Mock do useTeams para controlar dados de seleção
vi.mock("@/features/matches/hooks/useTeams");

// O shadcn Sheet usa Base UI Dialog com portals — mockamos o Sheet para renderizar inline
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="sheet-root" onClick={() => onOpenChange?.(false)}>
        {children}
      </div>
    );
  },
  SheetContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="sheet-content" className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="sheet-title">{children}</h2>
  ),
}));

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useTeams } from "@/features/matches/hooks/useTeams";
import type { TeamWithId } from "@/types";

import { MatchFiltersSheet } from "@/features/matches/components/MatchFiltersSheet";
import type { MatchFiltersSheetProps } from "@/features/matches/components/MatchFiltersSheet";

// ── helpers de tipagem ───────────────────────────────────────────────────────

const mockUseTeams = vi.mocked(useTeams);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTeams: TeamWithId[] = [
  { id: "team-bra", name: "Brasil", code: "BRA", flagUrl: undefined, groupId: "A" },
  { id: "team-arg", name: "Argentina", code: "ARG", flagUrl: undefined, groupId: "B" },
  { id: "team-fra", name: "França", code: "FRA", flagUrl: undefined, groupId: "C" },
];

function makeProps(overrides: Partial<MatchFiltersSheetProps> = {}): MatchFiltersSheetProps {
  return {
    open: true,
    onClose: vi.fn(),
    selectedStage: undefined,
    selectedPredictionStatus: undefined,
    selectedTeamId: undefined,
    onApply: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseTeams.mockReturnValue({ data: mockTeams, isLoading: false, isError: false } as any);
});

// ---------------------------------------------------------------------------
// Testes — abertura e estrutura
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — abertura e estrutura", () => {
  it("T1: não renderiza o sheet quando open=false", () => {
    render(<MatchFiltersSheet {...makeProps({ open: false })} />);
    expect(screen.queryByTestId("sheet-root")).toBeNull();
  });

  it("T2: renderiza o sheet quando open=true", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByTestId("sheet-root")).toBeTruthy();
  });

  it("T3: título 'Filtros' aparece quando aberto", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByText("Filtros")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Testes — Seção Fase
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — Seção Fase", () => {
  it("T4: 'Todas as fases' está selecionado por padrão (aria-pressed=true)", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedStage: undefined })} />);
    const btn = screen.getByRole("button", { name: "Todas as fases" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("T5: opções de fase estão presentes (incluindo 16 Avos — TASK-01)", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByRole("button", { name: "Fase de Grupos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "16 Avos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oitavas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quartas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Semifinal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "3º Lugar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Final" })).toBeTruthy();
  });

  it("T5b: botão '16 Avos' seleciona dezesseis-avos como rascunho (TASK-01)", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const btn = screen.getByRole("button", { name: "16 Avos" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Todas as fases" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("T6: clicar em 'Fase de Grupos' marca como selecionado (aria-pressed=true)", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const btn = screen.getByRole("button", { name: "Fase de Grupos" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("T7: clicar em 'Fase de Grupos' deseleciona 'Todas as fases'", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    expect(
      screen.getByRole("button", { name: "Todas as fases" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("T8: clicar em fase já selecionada volta para 'Todas as fases'", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedStage: "grupos" })} />);
    const btn = screen.getByRole("button", { name: "Fase de Grupos" });
    fireEvent.click(btn); // deseleciona
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Todas as fases" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Testes — Seção Status do Palpite
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — Seção Status do Palpite", () => {
  it("T9: 'Todos' está selecionado por padrão", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedPredictionStatus: undefined })} />);
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("T10: opções de status estão presentes", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByRole("button", { name: "Palpite Enviado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Palpite Pendente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Jogo Encerrado" })).toBeTruthy();
  });

  it("T11: clicar em 'Palpite Enviado' marca como selecionado", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const btn = screen.getByRole("button", { name: "Palpite Enviado" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("T12: clicar em status já selecionado volta para 'Todos'", () => {
    render(
      <MatchFiltersSheet {...makeProps({ selectedPredictionStatus: "enviado" })} />,
    );
    const btn = screen.getByRole("button", { name: "Palpite Enviado" });
    fireEvent.click(btn); // deseleciona
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Testes — Seção Seleção
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — Seção Seleção", () => {
  it("T13: 'Todas as seleções' aparece na lista", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByText("Todas as seleções")).toBeTruthy();
  });

  it("T14: teams da fixture aparecem na lista", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
  });

  it("T15: clicar em um team o seleciona (aria-selected=true)", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const brasilItem = screen.getByText("Brasil").closest("[role='option']");
    expect(brasilItem).toBeTruthy();
    fireEvent.click(brasilItem!);
    expect(brasilItem!.getAttribute("aria-selected")).toBe("true");
  });

  it("T16: clicar em team já selecionado o deseleciona", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedTeamId: "team-bra" })} />);
    const brasilItem = screen.getByText("Brasil").closest("[role='option']");
    expect(brasilItem).toBeTruthy();
    expect(brasilItem!.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(brasilItem!);
    expect(brasilItem!.getAttribute("aria-selected")).toBe("false");
  });

  it("T17: 'Todas as seleções' selecionado por padrão quando selectedTeamId=undefined", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedTeamId: undefined })} />);
    const todasItem = screen.getByText("Todas as seleções").closest("[role='option']");
    expect(todasItem!.getAttribute("aria-selected")).toBe("true");
  });

  it("T18: busca filtra a lista de seleções", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const input = screen.getByLabelText("Buscar por seleção");
    fireEvent.change(input, { target: { value: "bras" } });
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.queryByText("Argentina")).toBeNull();
    expect(screen.queryByText("França")).toBeNull();
  });

  it("T19: 'Todas as seleções' sempre visível mesmo com busca ativa", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const input = screen.getByLabelText("Buscar por seleção");
    fireEvent.change(input, { target: { value: "bras" } });
    expect(screen.getByText("Todas as seleções")).toBeTruthy();
  });

  it("T20: busca case-insensitive — 'BRASIL' encontra Brasil", () => {
    render(<MatchFiltersSheet {...makeProps()} />);
    const input = screen.getByLabelText("Buscar por seleção");
    fireEvent.change(input, { target: { value: "BRASIL" } });
    expect(screen.getByText("Brasil")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Testes — Ações
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — Ações", () => {
  it("T21: 'Aplicar Filtros' chama onApply com os valores do rascunho", () => {
    const onApply = vi.fn();
    render(<MatchFiltersSheet {...makeProps({ onApply })} />);
    // Seleciona fase Oitavas e status Enviado no rascunho
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    fireEvent.click(screen.getByRole("button", { name: "Palpite Enviado" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar Filtros" }));
    expect(onApply).toHaveBeenCalledWith({
      stage: "oitavas",
      predictionStatus: "enviado",
      teamId: undefined,
    });
  });

  it("T22: 'Aplicar Filtros' chama onClose após aplicar", () => {
    const onClose = vi.fn();
    render(<MatchFiltersSheet {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar Filtros" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("T23: 'Limpar Filtros' chama onClear", () => {
    const onClear = vi.fn();
    render(<MatchFiltersSheet {...makeProps({ onClear })} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar Filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("T24: 'Limpar Filtros' chama onClose", () => {
    const onClose = vi.fn();
    render(<MatchFiltersSheet {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar Filtros" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("T25: 'Aplicar Filtros' com teamId selecionado passa teamId no onApply", () => {
    const onApply = vi.fn();
    render(<MatchFiltersSheet {...makeProps({ onApply })} />);
    const brasilItem = screen.getByText("Brasil").closest("[role='option']");
    fireEvent.click(brasilItem!);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar Filtros" }));
    expect(onApply).toHaveBeenCalledWith({
      stage: undefined,
      predictionStatus: undefined,
      teamId: "team-bra",
    });
  });
});

// ---------------------------------------------------------------------------
// Testes — Sincronização de rascunho
// ---------------------------------------------------------------------------

describe("MatchFiltersSheet — Sincronização de rascunho", () => {
  it("T26: rascunho inicializa com selectedStage vindo das props", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedStage: "quartas" })} />);
    expect(
      screen.getByRole("button", { name: "Quartas" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Todas as fases" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("T27: rascunho inicializa com selectedPredictionStatus vindo das props", () => {
    render(
      <MatchFiltersSheet {...makeProps({ selectedPredictionStatus: "pendente" })} />,
    );
    expect(
      screen.getByRole("button", { name: "Palpite Pendente" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("T28: rascunho inicializa com selectedTeamId vindo das props", () => {
    render(<MatchFiltersSheet {...makeProps({ selectedTeamId: "team-arg" })} />);
    const argItem = screen.getByText("Argentina").closest("[role='option']");
    expect(argItem!.getAttribute("aria-selected")).toBe("true");
  });
});
