/**
 * TDD RED phase — TASK-01 (scoring-write-cost)
 * Funções puras de otimização de custo do cron de pontuação.
 * Implementação NÃO existe ainda — testes devem falhar no import.
 */
import { describe, expect, it } from "vitest";

import type { Match } from "@/types";

import {
  matchResultFingerprint,
  predictionScoreChanged,
} from "@/features/predictions/lib";

type MatchWithId = Match & { id: string };

function makeFinishedMatch(overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id: "match-02",
    homeTeamId: "team-fra",
    awayTeamId: "team-ger",
    kickoffAt: "2026-06-15T14:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    groupId: "group-b",
    venue: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// matchResultFingerprint — filtro grosso (B)
// ---------------------------------------------------------------------------
describe("matchResultFingerprint", () => {
  it("é determinístico: mesma partida → mesma string em chamadas repetidas", () => {
    const match = makeFinishedMatch();
    expect(matchResultFingerprint(match)).toBe(matchResultFingerprint(match));
  });

  it("muda quando o status muda", () => {
    const finished = makeFinishedMatch({ status: "finished" });
    const live = makeFinishedMatch({ status: "live" });
    expect(matchResultFingerprint(finished)).not.toBe(
      matchResultFingerprint(live),
    );
  });

  it("muda quando o homeScore muda (correção de placar invalida cache)", () => {
    const a = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const b = makeFinishedMatch({ homeScore: 3, awayScore: 1 });
    expect(matchResultFingerprint(a)).not.toBe(matchResultFingerprint(b));
  });

  it("muda quando o awayScore muda", () => {
    const a = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const b = makeFinishedMatch({ homeScore: 2, awayScore: 2 });
    expect(matchResultFingerprint(a)).not.toBe(matchResultFingerprint(b));
  });

  it("distingue placar null de 0", () => {
    const nullScores = makeFinishedMatch({ homeScore: null, awayScore: null });
    const zeroScores = makeFinishedMatch({ homeScore: 0, awayScore: 0 });
    expect(matchResultFingerprint(nullScores)).not.toBe(
      matchResultFingerprint(zeroScores),
    );
  });

  it("independe da ordem das chaves do objeto de entrada", () => {
    const a = makeFinishedMatch();
    // Mesmo conteúdo, ordem de inserção diferente
    const b: MatchWithId = {
      awayScore: a.awayScore,
      homeScore: a.homeScore,
      status: a.status,
      venue: a.venue,
      groupId: a.groupId,
      round: a.round,
      stage: a.stage,
      kickoffAt: a.kickoffAt,
      awayTeamId: a.awayTeamId,
      homeTeamId: a.homeTeamId,
      id: a.id,
    };
    expect(matchResultFingerprint(a)).toBe(matchResultFingerprint(b));
  });

  it("não depende de campos fora de {status, homeScore, awayScore}", () => {
    const a = makeFinishedMatch();
    const b = makeFinishedMatch({
      id: "outro-id",
      homeTeamId: "team-x",
      awayTeamId: "team-y",
      venue: { name: "Maracanã", city: "Rio de Janeiro" },
      groupId: "group-z",
    });
    expect(matchResultFingerprint(a)).toBe(matchResultFingerprint(b));
  });
});

// ---------------------------------------------------------------------------
// predictionScoreChanged — filtro fino (A)
// ---------------------------------------------------------------------------
describe("predictionScoreChanged", () => {
  it("false quando status e points são iguais", () => {
    expect(
      predictionScoreChanged(
        { status: "correct", points: 10 },
        { status: "correct", points: 10 },
      ),
    ).toBe(false);
  });

  it("true quando points difere", () => {
    expect(
      predictionScoreChanged(
        { status: "partial", points: 5 },
        { status: "partial", points: 10 },
      ),
    ).toBe(true);
  });

  it("true quando status difere", () => {
    expect(
      predictionScoreChanged(
        { status: "wrong", points: 0 },
        { status: "partial", points: 0 },
      ),
    ).toBe(true);
  });

  it("true quando persistido não tem status (palpite nunca pontuado)", () => {
    expect(
      predictionScoreChanged({ points: 0 }, { status: "wrong", points: 0 }),
    ).toBe(true);
  });

  it("true quando persistido não tem points (undefined ≠ 0)", () => {
    expect(
      predictionScoreChanged(
        { status: "wrong" },
        { status: "wrong", points: 0 },
      ),
    ).toBe(true);
  });

  it("true quando persistido é totalmente vazio", () => {
    expect(predictionScoreChanged({}, { status: "pending", points: 0 })).toBe(
      true,
    );
  });

  it("false para pending/0 idêntico", () => {
    expect(
      predictionScoreChanged(
        { status: "pending", points: 0 },
        { status: "pending", points: 0 },
      ),
    ).toBe(false);
  });
});
