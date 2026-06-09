// @vitest-environment jsdom
/**
 * Testes da tela Seleção de Grupo (TASK-08, PRD03-02).
 *
 * Cobre:
 * - buildGroupSummaries (pura): agrupa por groupId, conta filled/total, deriva
 *   status, ignora partidas não-grupo / sem groupId, ordena A→L, gera href.
 * - GroupSelectionGrid: render (header + cards), links de navegação, status
 *   visual (✓ no aria-label), aria, loading (role=status), error (role=alert +
 *   retry), vazio.
 *
 * Padrão de asserção: espelha MassPredictionPrimitives.test.tsx. Componente puro.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MatchWithId, Prediction } from "@/types";

import {
  GroupSelectionGrid,
  buildGroupSummaries,
  type GroupSummary,
} from "../GroupSelectionGrid";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id: "m-1",
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-06-11T16:00:00Z",
    stage: "grupos",
    groupId: "A",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    round: null,
    venue: null,
    ...overrides,
  } as MatchWithId;
}

function makePrediction(matchId: string): Prediction {
  return { uid: "u1", matchId, homeScore: 1, awayScore: 0 } as Prediction;
}

/** Gera 6 jogos para um grupo com ids estáveis. */
function groupMatches(groupId: string): MatchWithId[] {
  return Array.from({ length: 6 }, (_, i) =>
    makeMatch({ id: `${groupId}-${i}`, groupId, stage: "grupos" }),
  );
}

// ── buildGroupSummaries ─────────────────────────────────────────────────────────

describe("buildGroupSummaries", () => {
  it("agrupa por groupId e conta total/filled", () => {
    const matches = groupMatches("A");
    const predictions = [makePrediction("A-0"), makePrediction("A-1")];
    const out = buildGroupSummaries(matches, predictions);
    expect(out).toHaveLength(1);
    expect(out[0]!.groupId).toBe("A");
    expect(out[0]!.totalCount).toBe(6);
    expect(out[0]!.filledCount).toBe(2);
  });

  it("deriva status nao-iniciado / andamento / concluido", () => {
    const matches = groupMatches("A");
    expect(buildGroupSummaries(matches, [])[0]!.status).toBe("nao-iniciado");
    expect(
      buildGroupSummaries(matches, [makePrediction("A-0")])[0]!.status,
    ).toBe("andamento");
    const all = matches.map((m) => makePrediction(m.id));
    expect(buildGroupSummaries(matches, all)[0]!.status).toBe("concluido");
  });

  it("ignora partidas de outras fases e sem groupId", () => {
    const matches = [
      makeMatch({ id: "g1", groupId: "A", stage: "grupos" }),
      makeMatch({ id: "k1", groupId: null, stage: "oitavas" }),
      makeMatch({ id: "g2", groupId: undefined, stage: "grupos" }),
    ];
    const out = buildGroupSummaries(matches, []);
    expect(out).toHaveLength(1);
    expect(out[0]!.groupId).toBe("A");
    expect(out[0]!.totalCount).toBe(1);
  });

  it("ordena os grupos por groupId ASC (A→L)", () => {
    const matches = [
      ...groupMatches("C"),
      ...groupMatches("A"),
      ...groupMatches("B"),
    ];
    const out = buildGroupSummaries(matches, []);
    expect(out.map((g) => g.groupId)).toEqual(["A", "B", "C"]);
  });

  it("gera href e name corretos", () => {
    const out = buildGroupSummaries(groupMatches("D"), []);
    expect(out[0]!.href).toBe("/predictions/grupos/D");
    expect(out[0]!.name).toBe("Grupo D");
  });
});

// ── GroupSelectionGrid render ─────────────────────────────────────────────────────

function makeSummaries(): GroupSummary[] {
  const ids = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  return ids.map((groupId, idx) => ({
    groupId,
    name: `Grupo ${groupId}`,
    totalCount: 6,
    filledCount: idx === 0 ? 6 : idx === 1 ? 3 : 0,
    status: idx === 0 ? "concluido" : idx === 1 ? "andamento" : "nao-iniciado",
    href: `/predictions/grupos/${groupId}`,
  }));
}

function renderGrid(
  overrides: Partial<React.ComponentProps<typeof GroupSelectionGrid>> = {},
) {
  const props: React.ComponentProps<typeof GroupSelectionGrid> = {
    summaries: makeSummaries(),
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...overrides,
  };
  return render(<GroupSelectionGrid {...props} />);
}

describe("GroupSelectionGrid — render", () => {
  it("renderiza header, label e os 12 cards de grupo", () => {
    renderGrid();
    expect(screen.getByRole("heading", { name: "Fase de Grupos", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Selecione um grupo", level: 2 })).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(12);
    expect(screen.getByText("Grupo A")).toBeTruthy();
    expect(screen.getByText("Grupo L")).toBeTruthy();
  });

  it("cada card navega para /predictions/grupos/{id}", () => {
    renderGrid();
    const a = screen.getByRole("link", { name: /Grupo A/ });
    expect(a.getAttribute("href")).toBe("/predictions/grupos/A");
    const l = screen.getByRole("link", { name: /Grupo L/ });
    expect(l.getAttribute("href")).toBe("/predictions/grupos/L");
  });

  it("status no aria-label do card (concluído / em andamento / não iniciado)", () => {
    renderGrid();
    expect(screen.getByRole("link", { name: /Grupo A.*concluído/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Grupo B.*em andamento/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Grupo C.*não iniciado/ })).toBeTruthy();
  });

  it("exibe a caixa de dica informativa", () => {
    renderGrid();
    expect(screen.getByText(/qualquer ordem/)).toBeTruthy();
  });
});

// ── Estados ──────────────────────────────────────────────────────────────────────

describe("GroupSelectionGrid — estados", () => {
  it("loading: role=status e sem cards", () => {
    renderGrid({ isLoading: true });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Grupo A")).toBeNull();
  });

  it("error: role=alert + 'Tentar novamente' chama onRetry", () => {
    const onRetry = vi.fn();
    renderGrid({ isError: true, onRetry });
    const alert = screen.getByRole("alert");
    const retry = within(alert).getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("vazio: mensagem de indisponibilidade e sem cards", () => {
    renderGrid({ summaries: [] });
    expect(screen.getByText(/ainda não estão disponíveis/)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
