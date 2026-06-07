// @vitest-environment jsdom
/**
 * Testes da tela Classificação Prevista (TASK-10, PRD03-04).
 *
 * Cobre:
 * - deriveQualification (pura): 1,2→qualified; 3→best-third-candidate; 4→eliminated.
 * - PredictedStandings: render da tabela (header scope, 4 linhas na ordem de
 *   position, Pos/nome/Pts/SG com sinal/GP), destaque dos classificados (ícone+
 *   texto), marcação do 3º, nota parcial, CTAs Confirmar/Editar, acessibilidade.
 *
 * Componente apresentacional puro; sem mock de dados.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroupStandingEntry } from "@/features/predictions/lib";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

import {
  PredictedStandings,
  deriveQualification,
} from "../PredictedStandings";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function entry(
  teamId: string,
  position: number,
  overrides: Partial<GroupStandingEntry> = {},
): GroupStandingEntry {
  return {
    teamId,
    played: 3,
    wins: 2,
    draws: 0,
    losses: 1,
    goalsFor: 5,
    goalsAgainst: 2,
    goalDifference: 3,
    points: 6,
    position,
    ...overrides,
  };
}

const TEAM_NAMES: Record<string, string> = {
  BRA: "Brasil",
  FRA: "França",
  JPN: "Japão",
  SRB: "Sérvia",
};

function resolveTeamName(teamId: string): ResolvedTeam {
  return { name: TEAM_NAMES[teamId] ?? teamId, flagUrl: undefined };
}

function fourEntries(): GroupStandingEntry[] {
  return [
    entry("BRA", 1, { points: 7, goalDifference: 4, goalsFor: 6 }),
    entry("FRA", 2, { points: 5, goalDifference: 1, goalsFor: 4 }),
    entry("JPN", 3, { points: 2, goalDifference: -1, goalsFor: 2 }),
    entry("SRB", 4, { points: 1, goalDifference: -4, goalsFor: 1 }),
  ];
}

function renderStandings(
  overrides: Partial<React.ComponentProps<typeof PredictedStandings>> = {},
) {
  const props: React.ComponentProps<typeof PredictedStandings> = {
    groupId: "C",
    standings: fourEntries(),
    resolveTeamName,
    isPartial: false,
    onConfirm: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<PredictedStandings {...props} />) };
}

// ── deriveQualification ────────────────────────────────────────────────────────

describe("deriveQualification", () => {
  it("posições 1 e 2 → qualified", () => {
    expect(deriveQualification(1)).toBe("qualified");
    expect(deriveQualification(2)).toBe("qualified");
  });
  it("posição 3 → best-third-candidate", () => {
    expect(deriveQualification(3)).toBe("best-third-candidate");
  });
  it("posição 4+ → eliminated", () => {
    expect(deriveQualification(4)).toBe("eliminated");
    expect(deriveQualification(5)).toBe("eliminated");
  });
});

// ── Render ────────────────────────────────────────────────────────────────────

describe("PredictedStandings — render", () => {
  it("renderiza tabela com header (scope=col) e 4 linhas na ordem de position", () => {
    renderStandings();
    expect(screen.getByRole("table")).toBeTruthy();
    const colHeaders = screen.getAllByRole("columnheader");
    expect(colHeaders).toHaveLength(5);
    colHeaders.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));

    const rows = screen.getAllByRole("row");
    // 1 header + 4 dados
    expect(rows).toHaveLength(5);
  });

  it("exibe Pos, nome, Pts, SG com sinal e GP por linha", () => {
    renderStandings();
    const rows = screen.getAllByRole("row").slice(1); // pula header
    const first = within(rows[0]!);
    expect(first.getByText("Brasil")).toBeTruthy();
    expect(first.getByText("7")).toBeTruthy(); // Pts
    expect(first.getByText("+4")).toBeTruthy(); // SG com sinal
    // 3º com SG negativo
    const third = within(rows[2]!);
    expect(third.getByText("Japão")).toBeTruthy();
    expect(third.getByText("-1")).toBeTruthy();
  });

  it("destaca classificados (1º/2º) com ícone+texto e marca o 3º", () => {
    renderStandings();
    // Lista "Classificados"
    expect(screen.getByRole("heading", { name: "Classificados", level: 3 })).toBeTruthy();
    expect(screen.getByText("Brasil (1º)")).toBeTruthy();
    expect(screen.getByText("França (2º)")).toBeTruthy();
    expect(screen.getByText(/Japão \(3º\) — candidato a melhor terceiro/)).toBeTruthy();
  });

  it("chip de posição tem aria-label com classificação (cor não-exclusiva)", () => {
    renderStandings();
    expect(screen.getByLabelText("1º — classificado")).toBeTruthy();
    expect(screen.getByLabelText("3º — candidato a melhor terceiro")).toBeTruthy();
    expect(screen.getByLabelText("4º — eliminado")).toBeTruthy();
  });

  it("tabela tem caption acessível", () => {
    renderStandings();
    expect(screen.getByText("Classificação prevista do Grupo C")).toBeTruthy();
  });
});

// ── Nota parcial + CTAs ──────────────────────────────────────────────────────────

describe("PredictedStandings — nota parcial e CTAs", () => {
  it("isPartial=true exibe a nota; false não exibe", () => {
    const { unmount } = renderStandings({ isPartial: true });
    expect(screen.getByText(/Classificação parcial/)).toBeTruthy();
    unmount();
    renderStandings({ isPartial: false });
    expect(screen.queryByText(/Classificação parcial/)).toBeNull();
  });

  it("'Confirmar Classificação' chama onConfirm", () => {
    const onConfirm = vi.fn();
    renderStandings({ onConfirm });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Classificação" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("'Editar Resultados' chama onEdit", () => {
    const onEdit = vi.fn();
    renderStandings({ onEdit });
    fireEvent.click(screen.getByRole("button", { name: "Editar Resultados" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("standings vazio → não renderiza nada", () => {
    const { container } = renderStandings({ standings: [] });
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar Classificação" })).toBeNull();
  });
});
