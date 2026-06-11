// @vitest-environment jsdom
/**
 * Testes da tela Palpite em Massa do Grupo (TASK-09, PRD03-03).
 *
 * Cobre:
 * - GroupMatchRow: render (nomes + 2 inputs com aria-label), onChange dos inputs,
 *   estado locked (disabled + "Encerrado").
 * - GroupQuickFill: render de N linhas, ordem TAB (mandante→visitante por linha),
 *   onScoreChange dispara com valores corretos, onSave no clique, CTA disabled
 *   (saving / sem item salvável), estados loading/error/empty.
 * - buildSaveFeedback (pura): 4 ramificações (success/warning/error/info).
 *
 * Componentes apresentacionais puros; sem mock de dados.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroupPredictionItem } from "@/features/predictions/hooks/useGroupPredictions";
import type { BatchUpsertResult } from "@/services/predictions";

import { GroupMatchRow } from "../GroupMatchRow";
import { GroupQuickFill, buildSaveFeedback } from "../GroupQuickFill";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<GroupPredictionItem> = {}): GroupPredictionItem {
  return {
    matchId: "m-1",
    kickoffAt: "2026-06-11T16:00:00Z",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Argentina", flagUrl: undefined },
    currentScores: undefined,
    savedPrediction: undefined,
    draftPrediction: undefined,
    isLocked: false,
    isDirty: false,
    ...overrides,
  };
}

function makeItems(n: number): GroupPredictionItem[] {
  return Array.from({ length: n }, (_, i) =>
    makeItem({
      matchId: `m-${i}`,
      homeTeam: { name: `Home${i}`, flagUrl: undefined },
      awayTeam: { name: `Away${i}`, flagUrl: undefined },
    }),
  );
}

function renderFill(
  overrides: Partial<React.ComponentProps<typeof GroupQuickFill>> = {},
) {
  const props: React.ComponentProps<typeof GroupQuickFill> = {
    groupId: "C",
    items: makeItems(6),
    isLoading: false,
    isError: false,
    isSaving: false,
    onRetry: vi.fn(),
    onScoreChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<GroupQuickFill {...props} />) };
}

// ── GroupMatchRow ───────────────────────────────────────────────────────────────

describe("GroupMatchRow", () => {
  it("renderiza nomes e 2 inputs com aria-label corretos", () => {
    render(
      <GroupMatchRow
        homeTeam={{ name: "Brasil", flagUrl: undefined }}
        awayTeam={{ name: "Sérvia", flagUrl: undefined }}
        homeScore={null}
        awayScore={null}
        locked={false}
        onHomeChange={vi.fn()}
        onAwayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Sérvia")).toBeTruthy();
    expect(screen.getByLabelText("Gols Brasil")).toBeTruthy();
    expect(screen.getByLabelText("Gols Sérvia")).toBeTruthy();
  });

  it("digitar dispara onHomeChange/onAwayChange com o número", () => {
    const onHomeChange = vi.fn();
    const onAwayChange = vi.fn();
    render(
      <GroupMatchRow
        homeTeam={{ name: "Brasil", flagUrl: undefined }}
        awayTeam={{ name: "Sérvia", flagUrl: undefined }}
        homeScore={null}
        awayScore={null}
        locked={false}
        onHomeChange={onHomeChange}
        onAwayChange={onAwayChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Gols Brasil"), {
      target: { value: "2" },
    });
    expect(onHomeChange).toHaveBeenCalledWith(2);
    fireEvent.change(screen.getByLabelText("Gols Sérvia"), {
      target: { value: "1" },
    });
    expect(onAwayChange).toHaveBeenCalledWith(1);
  });

  it("locked: inputs desabilitados + marcador 'Encerrado'", () => {
    render(
      <GroupMatchRow
        homeTeam={{ name: "Brasil", flagUrl: undefined }}
        awayTeam={{ name: "Sérvia", flagUrl: undefined }}
        homeScore={1}
        awayScore={0}
        locked
        onHomeChange={vi.fn()}
        onAwayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Encerrado")).toBeTruthy();
    expect((screen.getByLabelText("Gols Brasil") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Gols Sérvia") as HTMLInputElement).disabled).toBe(true);
  });
});

// ── GroupQuickFill — render ───────────────────────────────────────────────────────

describe("GroupQuickFill — render", () => {
  it("renderiza título, instrução, 6 linhas e 12 inputs", () => {
    renderFill();
    expect(screen.getByRole("heading", { name: "Grupo C", level: 1 })).toBeTruthy();
    expect(screen.getByText(/Digite todos os resultados/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getAllByRole("textbox")).toHaveLength(12);
  });

  it("ordem TAB: inputs no DOM seguem mandante→visitante por linha", () => {
    renderFill({ items: makeItems(2) });
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const labels = inputs.map((i) => i.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Gols Home0",
      "Gols Away0",
      "Gols Home1",
      "Gols Away1",
    ]);
    // Nenhum tabIndex positivo.
    for (const input of inputs) {
      const ti = input.getAttribute("tabindex");
      expect(ti === null || Number(ti) <= 0).toBe(true);
    }
  });

  it("auto-save: digitar dispara onScoreChange com (matchId, home, away)", () => {
    const onScoreChange = vi.fn();
    renderFill({ items: makeItems(1), onScoreChange });
    fireEvent.change(screen.getByLabelText("Gols Home0"), {
      target: { value: "3" },
    });
    expect(onScoreChange).toHaveBeenCalledWith("m-0", 3, null);
  });

  it("preserva o outro lado ao alterar um input (par parcial)", () => {
    const onScoreChange = vi.fn();
    renderFill({
      items: [
        makeItem({
          matchId: "m-0",
          homeTeam: { name: "Home0", flagUrl: undefined },
          awayTeam: { name: "Away0", flagUrl: undefined },
          currentScores: { homeScore: 2, awayScore: 1 },
        }),
      ],
      onScoreChange,
    });
    fireEvent.change(screen.getByLabelText("Gols Away0"), {
      target: { value: "4" },
    });
    expect(onScoreChange).toHaveBeenCalledWith("m-0", 2, 4);
  });
});

// ── GroupQuickFill — CTA / save ───────────────────────────────────────────────────

describe("GroupQuickFill — CTA salvar", () => {
  it("clicar 'Salvar Grupo' chama onSave", () => {
    const onSave = vi.fn();
    renderFill({
      items: [makeItem({ currentScores: { homeScore: 1, awayScore: 0 } })],
      onSave,
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Grupo" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("saving: CTA desabilitado e texto 'Salvando…'", () => {
    renderFill({
      items: [makeItem({ currentScores: { homeScore: 1, awayScore: 0 } })],
      isSaving: true,
    });
    const btn = screen.getByRole("button", { name: "Salvando…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("sem item salvável: CTA desabilitado", () => {
    renderFill({ items: makeItems(6) }); // nenhum currentScores
    const btn = screen.getByRole("button", { name: "Salvar Grupo" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("item salvável apenas se desbloqueado", () => {
    renderFill({
      items: [
        makeItem({ isLocked: true, currentScores: { homeScore: 1, awayScore: 0 } }),
      ],
    });
    const btn = screen.getByRole("button", { name: "Salvar Grupo" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

// ── GroupQuickFill — estados ──────────────────────────────────────────────────────

describe("GroupQuickFill — estados", () => {
  it("loading: role=status e sem linhas", () => {
    renderFill({ isLoading: true });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("error: role=alert + 'Tentar novamente' chama onRetry", () => {
    const onRetry = vi.fn();
    renderFill({ isError: true, onRetry });
    const alert = screen.getByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("empty: mensagem + link de volta aos grupos", () => {
    renderFill({ items: [] });
    expect(screen.getByText(/ainda não estão disponíveis/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Voltar para os grupos" });
    expect(link.getAttribute("href")).toBe("/predictions/groups");
  });
});

// ── buildSaveFeedback ─────────────────────────────────────────────────────────────

function result(saved: number, rejected: number): BatchUpsertResult {
  return {
    saved: Array.from({ length: saved }, (_, i) => ({
      id: `u_${i}`,
      matchId: `m-${i}`,
      homeScore: 1,
      awayScore: 0,
      created: true,
    })),
    rejected: Array.from({ length: rejected }, (_, i) => ({
      index: i,
      matchId: `r-${i}`,
      reason: "locked" as const,
      message: "x",
    })),
  };
}

describe("buildSaveFeedback", () => {
  it("success: salvos > 0, rejeitados 0", () => {
    const fb = buildSaveFeedback(result(6, 0));
    expect(fb.tone).toBe("success");
    expect(fb.message).toContain("6");
  });

  it("singular: 1 palpite salvo", () => {
    expect(buildSaveFeedback(result(1, 0)).message).toBe("1 palpite salvo.");
  });

  it("warning: parcial (salvos > 0, rejeitados > 0)", () => {
    const fb = buildSaveFeedback(result(4, 2));
    expect(fb.tone).toBe("warning");
    expect(fb.message).toContain("4 salvos");
    expect(fb.message).toContain("2 não salvos");
  });

  it("error: nada salvo, só rejeitados", () => {
    const fb = buildSaveFeedback(result(0, 3));
    expect(fb.tone).toBe("error");
    expect(fb.message).toContain("Nenhum palpite salvo");
  });

  it("info: payload vazio (nada salvo, nada rejeitado)", () => {
    const fb = buildSaveFeedback(result(0, 0));
    expect(fb.tone).toBe("info");
  });
});
