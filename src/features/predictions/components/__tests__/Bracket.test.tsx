// @vitest-environment jsdom
/**
 * Testes do componente de Chave Interativa (TASK-13, PRD03-07..11).
 *
 * Cobre:
 * - humanizePlaceholder (pura): todos os formatos de placeholder + id real passthrough.
 * - BracketMatchup: render com time real, render com placeholder (rótulo humano),
 *   vencedor derivado exibido (ícone+texto), hint de empate, input locked.
 * - Bracket: render de N matchups + presença de classes responsivas (md:grid-cols-2).
 *
 * Componentes apresentacionais puros; sem mock de dados de rede.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { humanizePlaceholder } from "@/features/predictions/lib";
import type { BracketMatchup as BracketMatchupData } from "@/features/predictions/lib";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

import { Bracket } from "../Bracket";
import { BracketMatchup } from "../BracketMatchup";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEAM_NAMES: Record<string, string> = {
  BRA: "Brasil",
  ARG: "Argentina",
};

function resolveTeamName(teamId: string): ResolvedTeam {
  return { name: TEAM_NAMES[teamId] ?? teamId, flagUrl: undefined };
}

function resolvedMatchup(): BracketMatchupData {
  return {
    matchId: "m73",
    stage: "dezesseis-avos",
    home: { teamId: "BRA", origin: "resolved", meta: {} },
    away: { teamId: "ARG", origin: "resolved", meta: {} },
  };
}

function placeholderMatchup(): BracketMatchupData {
  return {
    matchId: "m74",
    stage: "dezesseis-avos",
    home: { teamId: "1A", origin: "group-winner", meta: { groupId: "A" } },
    away: { teamId: "W73", origin: "match-winner", meta: { matchNum: 73 } },
  };
}

// ── humanizePlaceholder ──────────────────────────────────────────────────────────

describe("humanizePlaceholder", () => {
  it("1A → 1º Grupo A", () => {
    expect(humanizePlaceholder("1A")).toBe("1º Grupo A");
  });
  it("2B → 2º Grupo B", () => {
    expect(humanizePlaceholder("2B")).toBe("2º Grupo B");
  });
  it("3ABC → 3º (Grupos A/B/C)", () => {
    expect(humanizePlaceholder("3ABC")).toBe("3º (Grupos A/B/C)");
  });
  it("W74 → Vencedor jogo 74", () => {
    expect(humanizePlaceholder("W74")).toBe("Vencedor jogo 74");
  });
  it("L101 → Perdedor jogo 101", () => {
    expect(humanizePlaceholder("L101")).toBe("Perdedor jogo 101");
  });
  it("teamId real passa direto", () => {
    expect(humanizePlaceholder("BRA")).toBe("BRA");
  });
});

// ── BracketMatchup ───────────────────────────────────────────────────────────────

describe("BracketMatchup", () => {
  it("renderiza times reais com inputs rotulados", () => {
    render(
      <BracketMatchup
        matchup={resolvedMatchup()}
        homeScore={null}
        awayScore={null}
        locked={false}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Gols Brasil" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Gols Argentina" })).toBeTruthy();
  });

  it("renderiza placeholder como rótulo humano (sem resolver time)", () => {
    render(
      <BracketMatchup
        matchup={placeholderMatchup()}
        homeScore={null}
        awayScore={null}
        locked={false}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    expect(screen.getByText("1º Grupo A")).toBeTruthy();
    expect(screen.getByText("Vencedor jogo 73")).toBeTruthy();
  });

  it("destaca o vencedor derivado do placar (ícone + texto)", () => {
    render(
      <BracketMatchup
        matchup={resolvedMatchup()}
        homeScore={2}
        awayScore={1}
        locked={false}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    // sr-text "— vence" presente apenas no vencedor (Brasil)
    expect(screen.getByText("— vence")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("exibe hint de empate quando placar é igual (role=status)", () => {
    render(
      <BracketMatchup
        matchup={resolvedMatchup()}
        homeScore={1}
        awayScore={1}
        locked={false}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    const hint = screen.getByRole("status");
    expect(hint.textContent).toMatch(/Empate não avança/);
  });

  it("input desabilitado quando locked", () => {
    render(
      <BracketMatchup
        matchup={resolvedMatchup()}
        homeScore={null}
        awayScore={null}
        locked
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "Gols Brasil",
    }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText("Encerrado")).toBeTruthy();
  });

  it("propaga alteração de placar com o matchId", () => {
    const onScoreChange = vi.fn();
    render(
      <BracketMatchup
        matchup={resolvedMatchup()}
        homeScore={null}
        awayScore={null}
        locked={false}
        resolveTeamName={resolveTeamName}
        onScoreChange={onScoreChange}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Gols Brasil" }), {
      target: { value: "3" },
    });
    expect(onScoreChange).toHaveBeenCalledWith("m73", 3, null);
  });
});

// ── Bracket ────────────────────────────────────────────────────────────────────

describe("Bracket", () => {
  it("renderiza N confrontos em uma lista", () => {
    render(
      <Bracket
        matchups={[resolvedMatchup(), placeholderMatchup()]}
        scores={{}}
        lockedMatchIds={new Set()}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("aplica classes responsivas (grid 1 col mobile → 2 col desktop)", () => {
    render(
      <Bracket
        matchups={[resolvedMatchup()]}
        scores={{}}
        lockedMatchIds={new Set()}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.className).toContain("grid-cols-1");
    expect(list.className).toContain("md:grid-cols-2");
  });

  it("aplica placares do mapa scores por matchId", () => {
    render(
      <Bracket
        matchups={[resolvedMatchup()]}
        scores={{ m73: { home: 2, away: 0 } }}
        lockedMatchIds={new Set()}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
      />,
    );
    const home = screen.getByRole("textbox", {
      name: "Gols Brasil",
    }) as HTMLInputElement;
    expect(home.value).toBe("2");
  });

  it("renderiza título quando fornecido", () => {
    render(
      <Bracket
        matchups={[resolvedMatchup()]}
        scores={{}}
        lockedMatchIds={new Set()}
        resolveTeamName={resolveTeamName}
        onScoreChange={vi.fn()}
        title="16 avos de final"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "16 avos de final", level: 2 }),
    ).toBeTruthy();
  });
});
