// @vitest-environment jsdom
/**
 * Testes da tela Resumo Final + Enviado (TASK-15 · PRD03-12 / PRD03-15).
 *
 * Cobre:
 * - Helper puro `deriveFinalists` (campeão/vice/3º/4º; empate→null; placeholder→humanizado).
 * - Componente `FinalSummary`: render dos 4 papéis, contagem, CTA "Confirmar e Enviar"
 *   (chama onConfirm; disabled quando !hasPending/saving), estado "Enviado" (isComplete),
 *   loading e error.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MatchWithId, TeamWithId } from "@/types";

import {
  FinalSummary,
  deriveFinalists,
  type Finalists,
  type ScoresByMatchId,
} from "@/features/predictions/components/FinalSummary";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<MatchWithId> & { id: string }): MatchWithId {
  return {
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-07-19T16:00:00Z",
    stage: "final",
    round: null,
    groupId: null,
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

function makeTeam(id: string, name: string): TeamWithId {
  return { id, name, code: id.slice(0, 3).toUpperCase(), flagUrl: `https://flags/${id}.png` };
}

const TEAMS: TeamWithId[] = [
  makeTeam("BRA", "Brasil"),
  makeTeam("ARG", "Argentina"),
  makeTeam("FRA", "França"),
  makeTeam("POR", "Portugal"),
];

// ---------------------------------------------------------------------------
// deriveFinalists
// ---------------------------------------------------------------------------

describe("deriveFinalists", () => {
  const matches: MatchWithId[] = [
    makeMatch({ id: "m104", stage: "final", homeTeamId: "BRA", awayTeamId: "ARG" }),
    makeMatch({ id: "m103", stage: "terceiro", homeTeamId: "FRA", awayTeamId: "POR" }),
  ];

  it("deriva campeão/vice da final e 3º/4º do terceiro a partir do placar", () => {
    const scores: ScoresByMatchId = {
      m104: { home: 2, away: 1 }, // BRA campeão, ARG vice
      m103: { home: 0, away: 3 }, // POR 3º, FRA 4º
    };
    const [champ, vice, third, fourth] = deriveFinalists(matches, scores, TEAMS);
    expect(champ.role).toBe("Campeão");
    expect(champ.teamName).toBe("Brasil");
    expect(vice.teamName).toBe("Argentina");
    expect(third.role).toBe("3º Lugar");
    expect(third.teamName).toBe("Portugal");
    expect(fourth.teamName).toBe("França");
  });

  it("retorna null para slots em empate (sem vencedor derivável)", () => {
    const scores: ScoresByMatchId = { m104: { home: 1, away: 1 } };
    const [champ, vice] = deriveFinalists(matches, scores, TEAMS);
    expect(champ.teamName).toBeNull();
    expect(vice.teamName).toBeNull();
  });

  it("retorna null quando não há placar para a partida", () => {
    const [champ, , third] = deriveFinalists(matches, {}, TEAMS);
    expect(champ.teamName).toBeNull();
    expect(third.teamName).toBeNull();
  });

  it("humaniza placeholder quando o time da chave ainda não foi resolvido", () => {
    const placeholderMatches: MatchWithId[] = [
      makeMatch({ id: "m104", stage: "final", homeTeamId: "W101", awayTeamId: "W102" }),
    ];
    const scores: ScoresByMatchId = { m104: { home: 3, away: 0 } };
    const [champ] = deriveFinalists(placeholderMatches, scores, TEAMS);
    expect(champ.teamName).toBe("Vencedor jogo 101");
    expect(champ.flagUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FinalSummary component
// ---------------------------------------------------------------------------

const FINALISTS: Finalists = [
  { role: "Campeão", teamName: "Brasil", flagUrl: undefined },
  { role: "Vice-Campeão", teamName: "Argentina", flagUrl: undefined },
  { role: "3º Lugar", teamName: "Portugal", flagUrl: undefined },
  { role: "4º Lugar", teamName: "França", flagUrl: undefined },
];

function renderSummary(overrides: Partial<React.ComponentProps<typeof FinalSummary>> = {}) {
  const onConfirm = vi.fn();
  const onRetry = vi.fn();
  render(
    <FinalSummary
      finalists={FINALISTS}
      filled={100}
      total={104}
      isComplete={false}
      hasPending
      hubHref="/predictions"
      isLoading={false}
      isError={false}
      isSaving={false}
      onConfirm={onConfirm}
      onRetry={onRetry}
      {...overrides}
    />,
  );
  return { onConfirm, onRetry };
}

describe("FinalSummary", () => {
  it("renderiza os quatro papéis com seus times", () => {
    renderSummary();
    expect(screen.getByLabelText("Campeão: Brasil")).toBeTruthy();
    expect(screen.getByLabelText("Vice-Campeão: Argentina")).toBeTruthy();
    expect(screen.getByLabelText("3º Lugar: Portugal")).toBeTruthy();
    expect(screen.getByLabelText("4º Lugar: França")).toBeTruthy();
  });

  it("dispara onConfirm ao clicar em Confirmar e Enviar", () => {
    const { onConfirm } = renderSummary();
    fireEvent.click(screen.getByRole("button", { name: /confirmar e enviar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("desabilita o CTA quando não há pendentes", () => {
    renderSummary({ hasPending: false });
    const btn = screen.getByRole("button", { name: /tudo enviado/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("desabilita e mostra Enviando… durante o salvamento", () => {
    renderSummary({ isSaving: true });
    const btn = screen.getByRole("button", { name: /enviando/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("renderiza o estado Enviado quando isComplete", () => {
    renderSummary({ isComplete: true, total: 104 });
    expect(screen.getByText("Palpites enviados!")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /confirmar e enviar/i }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: /voltar ao hub/i })).toBeTruthy();
  });

  it("renderiza loading e error", () => {
    const { rerender } = render(
      <FinalSummary
        finalists={FINALISTS}
        filled={0}
        total={104}
        isComplete={false}
        hasPending={false}
        hubHref="/predictions"
        isLoading
        isError={false}
        isSaving={false}
        onConfirm={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Carregando resumo")).toBeTruthy();

    const onRetry = vi.fn();
    rerender(
      <FinalSummary
        finalists={FINALISTS}
        filled={0}
        total={104}
        isComplete={false}
        hasPending={false}
        hubHref="/predictions"
        isLoading={false}
        isError
        isSaving={false}
        onConfirm={vi.fn()}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
