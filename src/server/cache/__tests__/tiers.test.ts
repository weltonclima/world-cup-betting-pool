/**
 * TDD RED phase — TASK-03 (integracao-api-football)
 * Constantes de cache (REVALIDATE/STALE_TIME) + helper revalidateForMatch.
 * O módulo de implementação ainda NÃO existe — os testes devem falhar no import.
 */
import { describe, expect, it } from "vitest";

import type { Match, MatchWithId } from "@/types/matches";

import { REVALIDATE, STALE_TIME, revalidateForMatch } from "../tiers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id: "match-01",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-15T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "group-a",
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constantes — valores absolutos do PRD-07
// ---------------------------------------------------------------------------

describe("REVALIDATE (segundos)", () => {
  it("grupos = 24h", () => {
    expect(REVALIDATE.grupos).toBe(24 * 60 * 60);
  });
  it("selecoes = 24h", () => {
    expect(REVALIDATE.selecoes).toBe(24 * 60 * 60);
  });
  it("jogoFuturo = 6h", () => {
    expect(REVALIDATE.jogoFuturo).toBe(6 * 60 * 60);
  });
  it("jogoDia = 30min", () => {
    expect(REVALIDATE.jogoDia).toBe(30 * 60);
  });
  it("jogoAoVivo = 1min", () => {
    expect(REVALIDATE.jogoAoVivo).toBe(60);
  });
  it("jogoEncerrado = 5min", () => {
    expect(REVALIDATE.jogoEncerrado).toBe(5 * 60);
  });
});

// ---------------------------------------------------------------------------
// Coerência REVALIDATE <-> STALE_TIME
// ---------------------------------------------------------------------------

describe("STALE_TIME (ms) deriva de REVALIDATE * 1000", () => {
  it("possui exatamente as mesmas chaves de REVALIDATE", () => {
    expect(Object.keys(STALE_TIME).sort()).toEqual(
      Object.keys(REVALIDATE).sort(),
    );
  });

  it("cada valor é o segundo correspondente * 1000", () => {
    for (const key of Object.keys(REVALIDATE) as Array<keyof typeof REVALIDATE>) {
      expect(STALE_TIME[key]).toBe(REVALIDATE[key] * 1000);
    }
  });
});

// ---------------------------------------------------------------------------
// revalidateForMatch — um teste por ramo
// ---------------------------------------------------------------------------

describe("revalidateForMatch", () => {
  const now = new Date("2026-06-15T20:00:00.000Z");

  it("status 'live' → jogoAoVivo (1min)", () => {
    const match = makeMatch({ status: "live", homeScore: 1, awayScore: 0 });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoAoVivo);
  });

  it("status 'finished' há 2h (< 6h) → jogoEncerrado (5min)", () => {
    const match = makeMatch({
      status: "finished",
      kickoffAt: "2026-06-15T18:00:00.000Z", // 2h antes de now
      homeScore: 2,
      awayScore: 1,
    });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoEncerrado);
  });

  it("status 'finished' há 10h (>= 6h) → jogoFuturo (6h, tier longo)", () => {
    const match = makeMatch({
      status: "finished",
      kickoffAt: "2026-06-15T10:00:00.000Z", // 10h antes de now
      homeScore: 2,
      awayScore: 1,
    });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoFuturo);
  });

  it("status 'finished' exatamente 6h → jogoFuturo (limite: < 6h é janela quente)", () => {
    const match = makeMatch({
      status: "finished",
      kickoffAt: "2026-06-15T14:00:00.000Z", // exatamente 6h antes de now
      homeScore: 0,
      awayScore: 0,
    });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoFuturo);
  });

  it("status 'scheduled' no mesmo dia (UTC) → jogoDia (30min)", () => {
    const match = makeMatch({
      status: "scheduled",
      kickoffAt: "2026-06-15T23:30:00.000Z", // mesmo dia de now
    });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoDia);
  });

  it("status 'scheduled' em dia futuro → jogoFuturo (6h)", () => {
    const match = makeMatch({
      status: "scheduled",
      kickoffAt: "2026-06-18T18:00:00.000Z", // 3 dias à frente
    });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoFuturo);
  });

  it("status 'postponed' hoje → jogoDia; outro dia → jogoFuturo", () => {
    const hoje = makeMatch({
      status: "postponed",
      kickoffAt: "2026-06-15T08:00:00.000Z",
    });
    const outroDia = makeMatch({
      status: "postponed",
      kickoffAt: "2026-06-20T08:00:00.000Z",
    });
    expect(revalidateForMatch(hoje, now)).toBe(REVALIDATE.jogoDia);
    expect(revalidateForMatch(outroDia, now)).toBe(REVALIDATE.jogoFuturo);
  });

  it("status 'canceled' → jogoFuturo (tier longo)", () => {
    const match = makeMatch({ status: "canceled" });
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoFuturo);
  });

  it("aceita Match sem id (não só MatchWithId)", () => {
    const { id: _id, ...matchSemId } = makeMatch({ status: "live", homeScore: 0, awayScore: 0 });
    const match: Match = matchSemId;
    expect(revalidateForMatch(match, now)).toBe(REVALIDATE.jogoAoVivo);
  });
});
