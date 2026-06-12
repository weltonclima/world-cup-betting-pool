/**
 * TDD RED phase — TASK-02 (palpites)
 * Testes das funções puras de predictionsHelpers.
 * Arquivo de implementação NÃO existe ainda — todos os testes devem falhar no import.
 */
import { describe, expect, it } from "vitest";

import type { Match, Prediction } from "@/types";

// Tipos locais auxiliares (espelham os do implementation)
type MatchWithId = Match & { id: string };

import {
  derivePredictionDisplayStatus,
  isPredictionLocked,
  scorePrediction,
  selectLockedMatches,
} from "@/features/predictions/lib";

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

function makeScheduledMatch(overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id: "match-01",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
    ...overrides,
  };
}

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

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    uid: "user-01",
    matchId: "match-01",
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. isPredictionLocked
// ---------------------------------------------------------------------------

describe("isPredictionLocked", () => {
  const kickoffAt = "2026-06-20T18:00:00.000Z";
  const kickoffMs = new Date(kickoffAt).getTime();

  it("não travado: scheduled + now 1ms antes do kickoff → false", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const now = new Date(kickoffMs - 1); // 1ms antes
    expect(isPredictionLocked(match, now)).toBe(false);
  });

  it("não travado: scheduled + now 1 hora antes do kickoff → false", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const now = new Date(kickoffMs - 3_600_000); // 1h antes
    expect(isPredictionLocked(match, now)).toBe(false);
  });

  it("travado: scheduled + now === kickoffAt (borda exata >= ) → true", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const now = new Date(kickoffMs); // exatamente no kickoff
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("travado: scheduled + now 1ms depois do kickoff → true", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const now = new Date(kickoffMs + 1);
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("travado: status live + now antes do kickoff → true (status !== scheduled)", () => {
    const match = makeScheduledMatch({
      kickoffAt,
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });
    const now = new Date(kickoffMs - 60_000); // 1min antes
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("travado: status finished + now antes do kickoff → true", () => {
    const match = makeFinishedMatch({ kickoffAt });
    const now = new Date(kickoffMs - 60_000);
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("travado: status postponed + now antes do kickoff → true", () => {
    const match = makeScheduledMatch({
      kickoffAt,
      status: "postponed",
    });
    const now = new Date(kickoffMs - 60_000);
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("travado: status canceled + now antes do kickoff → true", () => {
    const match = makeScheduledMatch({
      kickoffAt,
      status: "canceled",
    });
    const now = new Date(kickoffMs - 60_000);
    expect(isPredictionLocked(match, now)).toBe(true);
  });

  it("kickoffAt com offset negativo (-03:00) compara corretamente via getTime()", () => {
    // "2026-06-14T13:00:00-03:00" equivale a "2026-06-14T16:00:00.000Z"
    const kickoffWithOffset = "2026-06-14T13:00:00-03:00";
    const utcEquivalentMs = new Date(kickoffWithOffset).getTime(); // 2026-06-14T16:00:00Z

    const match = makeScheduledMatch({ kickoffAt: kickoffWithOffset });

    // 1ms antes (em UTC) → não travado
    const nowBefore = new Date(utcEquivalentMs - 1);
    expect(isPredictionLocked(match, nowBefore)).toBe(false);

    // exatamente no kickoff (em UTC) → travado
    const nowExact = new Date(utcEquivalentMs);
    expect(isPredictionLocked(match, nowExact)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1b. selectLockedMatches (PRD-12 — só jogos bloqueados p/ palpite manual)
// ---------------------------------------------------------------------------

describe("selectLockedMatches", () => {
  const kickoffFuturo = "2026-06-20T18:00:00.000Z";
  const kickoffMs = new Date(kickoffFuturo).getTime();
  const now = new Date(kickoffMs - 3_600_000); // 1h antes do jogo futuro

  it("inclui encerrado, ao vivo e kickoff-passado; exclui scheduled-futuro", () => {
    const agendadoFuturo = makeScheduledMatch({
      id: "futuro",
      kickoffAt: kickoffFuturo,
    });
    const encerrado = makeFinishedMatch({ id: "encerrado" });
    const aoVivo = makeScheduledMatch({
      id: "ao-vivo",
      status: "live",
      kickoffAt: kickoffFuturo,
    });
    const kickoffPassado = makeScheduledMatch({
      id: "passado",
      kickoffAt: new Date(now.getTime() - 60_000).toISOString(), // 1min antes de now
    });

    const result = selectLockedMatches(
      [agendadoFuturo, encerrado, aoVivo, kickoffPassado],
      now,
    );
    const ids = result.map((m) => m.id);

    expect(ids).toContain("encerrado");
    expect(ids).toContain("ao-vivo");
    expect(ids).toContain("passado");
    expect(ids).not.toContain("futuro");
  });

  it("lista vazia → vazia", () => {
    expect(selectLockedMatches([], now)).toEqual([]);
  });

  it("não muta o array de entrada", () => {
    const input = [makeFinishedMatch({ id: "x" })];
    const copy = [...input];
    selectLockedMatches(input, now);
    expect(input).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// 2. scorePrediction
// ---------------------------------------------------------------------------

describe("scorePrediction", () => {
  it("finished + placar exato (2×1 vs 2×1) → { status: 'correct', points: 1 }", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 2, awayScore: 1 });
    expect(scorePrediction(prediction, match)).toEqual({ status: "correct", points: 1 });
  });

  it("finished + placares corretos mas invertidos (2×1 previsto, 1×2 real) → { status: 'wrong', points: 0 }", () => {
    const match = makeFinishedMatch({ homeScore: 1, awayScore: 2 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 2, awayScore: 1 });
    expect(scorePrediction(prediction, match)).toEqual({ status: "wrong", points: 0 });
  });

  it("finished + empate exato (0×0 vs 0×0) → { status: 'correct', points: 1 }", () => {
    const match = makeFinishedMatch({ homeScore: 0, awayScore: 0 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 0, awayScore: 0 });
    expect(scorePrediction(prediction, match)).toEqual({ status: "correct", points: 1 });
  });

  it("finished + placar errado (1×0 previsto, 0×1 real) → { status: 'wrong', points: 0 }", () => {
    const match = makeFinishedMatch({ homeScore: 0, awayScore: 1 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 1, awayScore: 0 });
    expect(scorePrediction(prediction, match)).toEqual({ status: "wrong", points: 0 });
  });

  it("scheduled → { status: 'pending', points: 0 }", () => {
    const match = makeScheduledMatch({ homeScore: null, awayScore: null });
    const prediction = makePrediction({ matchId: match.id });
    expect(scorePrediction(prediction, match)).toEqual({ status: "pending", points: 0 });
  });

  it("live → { status: 'pending', points: 0 }", () => {
    const match = makeScheduledMatch({
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });
    const prediction = makePrediction({ matchId: match.id });
    expect(scorePrediction(prediction, match)).toEqual({ status: "pending", points: 0 });
  });

  it("postponed → { status: 'pending', points: 0 }", () => {
    const match = makeScheduledMatch({ status: "postponed" });
    const prediction = makePrediction({ matchId: match.id });
    expect(scorePrediction(prediction, match)).toEqual({ status: "pending", points: 0 });
  });

  it("idempotência: chamar duas vezes com os mesmos dados retorna o mesmo resultado", () => {
    const match = makeFinishedMatch({ homeScore: 3, awayScore: 2 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 3, awayScore: 2 });
    const result1 = scorePrediction(prediction, match);
    const result2 = scorePrediction(prediction, match);
    expect(result1).toEqual(result2);
    expect(result1).toEqual({ status: "correct", points: 1 });
  });

  it("finished + narrowing de null: homeScore null → { status: 'wrong', points: 0 } (conservador)", () => {
    // Simula inconsistência de dados (finished com scores null) — tratado como wrong
    const match = {
      ...makeFinishedMatch(),
      homeScore: null,
      awayScore: null,
    } as unknown as MatchWithId;
    const prediction = makePrediction({ matchId: match.id, homeScore: 0, awayScore: 0 });
    expect(scorePrediction(prediction, match)).toEqual({ status: "wrong", points: 0 });
  });
});

// ---------------------------------------------------------------------------
// 3. derivePredictionDisplayStatus
// ---------------------------------------------------------------------------

describe("derivePredictionDisplayStatus", () => {
  const kickoffAt = "2026-06-20T18:00:00.000Z";
  const kickoffMs = new Date(kickoffAt).getTime();

  it("finished + placar exato → 'acertou'", () => {
    const match = makeFinishedMatch({ kickoffAt, homeScore: 2, awayScore: 1 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 2, awayScore: 1 });
    const now = new Date(kickoffMs + 7_200_000); // 2h depois (pós-jogo)
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("acertou");
  });

  it("finished + placar errado → 'errou'", () => {
    const match = makeFinishedMatch({ kickoffAt, homeScore: 2, awayScore: 1 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 0, awayScore: 3 });
    const now = new Date(kickoffMs + 7_200_000);
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("errou");
  });

  it("finished tem prioridade sobre lock: finished + now >= kickoffAt → 'acertou' (não 'bloqueado')", () => {
    const match = makeFinishedMatch({ kickoffAt, homeScore: 1, awayScore: 1 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 1, awayScore: 1 });
    const now = new Date(kickoffMs + 3_600_000); // após kickoff
    // Mesmo que isPredictionLocked seja true, finished tem prioridade
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("acertou");
  });

  it("live + now antes de kickoffAt (race condition) → 'bloqueado' (status !== scheduled)", () => {
    const match = makeScheduledMatch({
      kickoffAt,
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });
    const prediction = makePrediction({ matchId: match.id });
    const now = new Date(kickoffMs - 60_000); // 1min antes (edge case de race condition)
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("bloqueado");
  });

  it("scheduled + now >= kickoffAt → 'bloqueado'", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const prediction = makePrediction({ matchId: match.id });
    const now = new Date(kickoffMs); // exatamente no kickoff
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("bloqueado");
  });

  it("scheduled + now < kickoffAt → 'pendente'", () => {
    const match = makeScheduledMatch({ kickoffAt });
    const prediction = makePrediction({ matchId: match.id });
    const now = new Date(kickoffMs - 3_600_000); // 1h antes
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("pendente");
  });

  it("postponed → 'bloqueado' (independente de now)", () => {
    const match = makeScheduledMatch({ kickoffAt, status: "postponed" });
    const prediction = makePrediction({ matchId: match.id });
    const now = new Date(kickoffMs - 60_000);
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("bloqueado");
  });

  it("canceled → 'bloqueado' (independente de now)", () => {
    const match = makeScheduledMatch({ kickoffAt, status: "canceled" });
    const prediction = makePrediction({ matchId: match.id });
    const now = new Date(kickoffMs - 60_000);
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("bloqueado");
  });

  it("finished + empate exato (0×0) → 'acertou'", () => {
    const match = makeFinishedMatch({ kickoffAt, homeScore: 0, awayScore: 0 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 0, awayScore: 0 });
    const now = new Date(kickoffMs + 7_200_000);
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("acertou");
  });

  it("finished + errou empate (previu 1×0, real 0×0) → 'errou'", () => {
    const match = makeFinishedMatch({ kickoffAt, homeScore: 0, awayScore: 0 });
    const prediction = makePrediction({ matchId: match.id, homeScore: 1, awayScore: 0 });
    const now = new Date(kickoffMs + 7_200_000);
    expect(derivePredictionDisplayStatus(prediction, match, now)).toBe("errou");
  });
});
