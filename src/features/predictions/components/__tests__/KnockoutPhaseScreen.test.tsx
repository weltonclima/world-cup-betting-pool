// @vitest-environment jsdom
/**
 * Testes da tela de fase eliminatória (TASK-14, PRD03-07..11).
 *
 * Cobre:
 * - render: heading da fase + Bracket com os confrontos.
 * - bloqueio (A6): isBlocked → estado "Fase bloqueada", sem inputs/CTA salvar.
 * - persist: clicar "Salvar Fase" chama onSave.
 * - final: duas seções (Final + Disputa de 3º lugar) renderizadas.
 * - estados loading/error/empty.
 *
 * Componente apresentacional puro; sem mock de rede.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BracketMatchup as BracketMatchupData } from "@/features/predictions/lib";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

import {
  KnockoutPhaseScreen,
  type KnockoutSection,
} from "../KnockoutPhaseScreen";

const TEAM_NAMES: Record<string, string> = { BRA: "Brasil", ARG: "Argentina" };
function resolveTeamName(teamId: string): ResolvedTeam {
  return { name: TEAM_NAMES[teamId] ?? teamId, flagUrl: undefined };
}

function matchup(matchId: string, stage: BracketMatchupData["stage"]): BracketMatchupData {
  return {
    matchId,
    stage,
    home: { teamId: "BRA", origin: "resolved", meta: {} },
    away: { teamId: "ARG", origin: "resolved", meta: {} },
  };
}

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof KnockoutPhaseScreen>> = {},
) {
  const props: React.ComponentProps<typeof KnockoutPhaseScreen> = {
    phaseTitle: "16 avos de final",
    sections: [{ matchups: [matchup("m73", "dezesseis-avos")] }],
    scores: {},
    lockedMatchIds: new Set(),
    resolveTeamName,
    onScoreChange: vi.fn(),
    onSave: vi.fn(),
    onRetry: vi.fn(),
    isLoading: false,
    isError: false,
    isSaving: false,
    isBlocked: false,
    hasSavable: true,
    ...overrides,
  };
  return { props, ...render(<KnockoutPhaseScreen {...props} />) };
}

describe("KnockoutPhaseScreen — render", () => {
  it("exibe o título da fase e os confrontos do Bracket", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: "16 avos de final", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Gols Brasil" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar Fase" })).toBeTruthy();
  });

  it("renderiza navegação entre fases (prev/next)", () => {
    renderScreen({
      prev: { href: "/predictions/groups", label: "Grupos" },
      next: { href: "/predictions/knockout/oitavas", label: "Oitavas" },
    });
    const nav = screen.getByRole("navigation", { name: "Navegação entre fases" });
    expect(nav).toBeTruthy();
    expect(screen.getByRole("link", { name: /Oitavas/ })).toBeTruthy();
  });
});

describe("KnockoutPhaseScreen — bloqueio A6", () => {
  it("isBlocked → estado bloqueado, sem inputs nem CTA salvar", () => {
    renderScreen({
      isBlocked: true,
      prev: { href: "/predictions/knockout/dezesseis-avos", label: "16 avos" },
    });
    expect(screen.getByText("Fase bloqueada")).toBeTruthy();
    expect(screen.getByText(/Os jogos de 16 avos precisam terminar/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Gols Brasil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar Fase" })).toBeNull();
  });
});

describe("KnockoutPhaseScreen — persistência", () => {
  it("clicar 'Salvar Fase' chama onSave", () => {
    const onSave = vi.fn();
    renderScreen({ onSave });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Fase" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("CTA desabilitado quando não há salvável", () => {
    renderScreen({ hasSavable: false });
    const cta = screen.getByRole("button", {
      name: "Salvar Fase",
    }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it("CTA exibe 'Salvando…' quando isSaving", () => {
    renderScreen({ isSaving: true });
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeTruthy();
  });
});

describe("KnockoutPhaseScreen — final com 3º lugar", () => {
  it("renderiza as duas seções (Final + Disputa de 3º lugar)", () => {
    const sections: KnockoutSection[] = [
      { title: "Final", matchups: [matchup("m104", "final")] },
      { title: "Disputa de 3º lugar", matchups: [matchup("m103", "terceiro")] },
    ];
    renderScreen({ phaseTitle: "Final e 3º lugar", sections });
    expect(screen.getByRole("heading", { name: "Final", level: 2 })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Disputa de 3º lugar", level: 2 }),
    ).toBeTruthy();
  });
});

describe("KnockoutPhaseScreen — estados", () => {
  it("loading exibe skeleton (status)", () => {
    renderScreen({ isLoading: true });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar Fase" })).toBeNull();
  });

  it("error exibe alerta + retry", () => {
    const onRetry = vi.fn();
    renderScreen({ isError: true, onRetry });
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("empty (sem confrontos) exibe mensagem e link voltar", () => {
    renderScreen({ sections: [{ matchups: [] }] });
    expect(
      screen.getByText("Os jogos desta fase ainda não estão disponíveis."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toBeTruthy();
  });
});
