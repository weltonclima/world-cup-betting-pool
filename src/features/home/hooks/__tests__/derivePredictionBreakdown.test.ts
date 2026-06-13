/**
 * TDD RED phase — TASK-03 (home-revamp)
 * Testes da derivação pura `derivePredictionBreakdown`.
 * A função NÃO existe ainda — todos os testes devem falhar no import.
 * Regras: ai/spec/task-home-revamp-03.md §6 (R1–R7).
 *
 * Tabula os palpites do usuário sobre jogos `finished` em 3 categorias
 * via `scorePrediction`: correct (10) / partial (5) / wrong (0).
 */
import { describe, expect, it } from "vitest";

import { derivePredictionBreakdown } from "@/features/home/lib/homeDashboardHelpers";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";
import type { Prediction } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Cria um MatchListItem finalizado com placar (default 2x1 → vencedor mandante).
 */
function makeFinished(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: "match-1",
    kickoffAt: "2026-06-15T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "group-a",
    venue: null,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Argentina", flagUrl: undefined },
    predictionStatus: "bloqueado",
    ...overrides,
  };
}

function makeScheduled(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return makeFinished({
    id: "match-sched",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    predictionStatus: "pendente",
    ...overrides,
  });
}

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    uid: "user-01",
    matchId: "match-1",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R5/R6 — Empty-state
// ---------------------------------------------------------------------------

describe("derivePredictionBreakdown — empty", () => {
  it("lista vazia → tudo zero e isEmpty true", () => {
    const result = derivePredictionBreakdown([], []);
    expect(result).toEqual({
      correct: 0,
      partial: 0,
      wrong: 0,
      total: 0,
      isEmpty: true,
    });
  });

  it("apenas jogos scheduled → isEmpty true (nenhum finished)", () => {
    const matches = [makeScheduled({ id: "a" }), makeScheduled({ id: "b" })];
    const predictions = [makePrediction({ matchId: "a" })];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result.total).toBe(0);
    expect(result.isEmpty).toBe(true);
  });

  it("jogo finished sem palpite do usuário → ignorado (não conta como wrong)", () => {
    const matches = [makeFinished({ id: "m1" })];
    const result = derivePredictionBreakdown(matches, []);
    expect(result.total).toBe(0);
    expect(result.wrong).toBe(0);
    expect(result.isEmpty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R3 — Tabulação por status
// ---------------------------------------------------------------------------

describe("derivePredictionBreakdown — tabulação", () => {
  it("palpite com placar exato → incrementa correct", () => {
    const matches = [makeFinished({ id: "m1", homeScore: 2, awayScore: 1 })];
    const predictions = [makePrediction({ matchId: "m1", homeScore: 2, awayScore: 1 })];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result.correct).toBe(1);
    expect(result.partial).toBe(0);
    expect(result.wrong).toBe(0);
    expect(result.total).toBe(1);
  });

  it("palpite só com vencedor certo (placar diferente) → incrementa partial", () => {
    // Resultado real 2x1 (vence mandante). Palpite 3x0 → mesmo vencedor, placar errado.
    const matches = [makeFinished({ id: "m1", homeScore: 2, awayScore: 1 })];
    const predictions = [makePrediction({ matchId: "m1", homeScore: 3, awayScore: 0 })];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result.partial).toBe(1);
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(0);
  });

  it("palpite com vencedor errado → incrementa wrong", () => {
    // Resultado real 2x1 (vence mandante). Palpite 0x2 → vencedor errado.
    const matches = [makeFinished({ id: "m1", homeScore: 2, awayScore: 1 })];
    const predictions = [makePrediction({ matchId: "m1", homeScore: 0, awayScore: 2 })];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result.wrong).toBe(1);
    expect(result.correct).toBe(0);
    expect(result.partial).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mix — cenário composto
// ---------------------------------------------------------------------------

describe("derivePredictionBreakdown — mix", () => {
  it("2 correct + 1 partial + 1 wrong → contagens e total corretos, isEmpty false", () => {
    const matches = [
      makeFinished({ id: "m1", homeScore: 2, awayScore: 1 }),
      makeFinished({ id: "m2", homeScore: 0, awayScore: 0 }),
      makeFinished({ id: "m3", homeScore: 3, awayScore: 1 }),
      makeFinished({ id: "m4", homeScore: 1, awayScore: 0 }),
    ];
    const predictions = [
      makePrediction({ matchId: "m1", homeScore: 2, awayScore: 1 }), // exato → correct
      makePrediction({ matchId: "m2", homeScore: 0, awayScore: 0 }), // exato empate → correct
      makePrediction({ matchId: "m3", homeScore: 4, awayScore: 2 }), // vencedor certo, placar errado → partial
      makePrediction({ matchId: "m4", homeScore: 0, awayScore: 2 }), // vencedor errado → wrong
    ];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result).toEqual({
      correct: 2,
      partial: 1,
      wrong: 1,
      total: 4,
      isEmpty: false,
    });
  });

  it("total > 0 implica isEmpty false", () => {
    const matches = [makeFinished({ id: "m1" })];
    const predictions = [makePrediction({ matchId: "m1", homeScore: 0, awayScore: 5 })];
    const result = derivePredictionBreakdown(matches, predictions);
    expect(result.total).toBe(1);
    expect(result.isEmpty).toBe(false);
  });
});
