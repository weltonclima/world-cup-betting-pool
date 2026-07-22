/**
 * TASK-01 (perf-hardening) — testes das derivações puras `deriveNextMatch` e
 * `deriveRecentResults`. Substituem o comportamento antes provido pelos services
 * `getNextScheduledMatch`/`getRecentFinishedMatches` (agora derivado do flatList).
 */
import { describe, expect, it } from "vitest";

import {
  deriveNextMatch,
  deriveRecentResults,
} from "@/features/home/lib/homeDashboardHelpers";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";

/** Referência temporal fixa injetada em deriveNextMatch. */
const NOW = new Date("2026-06-15T12:00:00.000Z");

function isoFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString();
}

function makeItem(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: "match-1",
    championshipId: "fifa.world",
    kickoffAt: isoFromNow(120),
    stage: "grupos",
    round: 1,
    groupId: "group-a",
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    homeTeamId: "team-bra",
    awayTeamId: "team-srb",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Sérvia", flagUrl: undefined },
    predictionStatus: "pendente",
    userPrediction: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deriveNextMatch
// ---------------------------------------------------------------------------

describe("deriveNextMatch", () => {
  it("retorna o jogo agendado futuro mais próximo", () => {
    const matches = [
      makeItem({ id: "tarde", kickoffAt: isoFromNow(300) }),
      makeItem({ id: "cedo", kickoffAt: isoFromNow(60) }),
      makeItem({ id: "medio", kickoffAt: isoFromNow(180) }),
    ];
    expect(deriveNextMatch(matches, NOW)?.id).toBe("cedo");
  });

  it("ignora jogos no passado (kickoff <= now)", () => {
    const matches = [
      makeItem({ id: "passado", kickoffAt: isoFromNow(-60) }),
      makeItem({ id: "futuro", kickoffAt: isoFromNow(120) }),
    ];
    expect(deriveNextMatch(matches, NOW)?.id).toBe("futuro");
  });

  it("ignora jogos não-scheduled (live/finished/postponed/canceled)", () => {
    const matches = [
      makeItem({ id: "live", status: "live", kickoffAt: isoFromNow(30) }),
      makeItem({ id: "finished", status: "finished", kickoffAt: isoFromNow(40) }),
      makeItem({ id: "scheduled", status: "scheduled", kickoffAt: isoFromNow(120) }),
    ];
    expect(deriveNextMatch(matches, NOW)?.id).toBe("scheduled");
  });

  it("retorna null quando não há agendado futuro", () => {
    const matches = [
      makeItem({ id: "passado", kickoffAt: isoFromNow(-60) }),
      makeItem({ id: "live", status: "live", kickoffAt: isoFromNow(30) }),
    ];
    expect(deriveNextMatch(matches, NOW)).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(deriveNextMatch([], NOW)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveRecentResults
// ---------------------------------------------------------------------------

describe("deriveRecentResults", () => {
  it("retorna só finished, do mais recente ao mais antigo", () => {
    const matches = [
      makeItem({ id: "f1", status: "finished", kickoffAt: "2026-06-10T18:00:00.000Z" }),
      makeItem({ id: "f2", status: "finished", kickoffAt: "2026-06-14T18:00:00.000Z" }),
      makeItem({ id: "sched", status: "scheduled", kickoffAt: "2026-06-20T18:00:00.000Z" }),
    ];
    expect(deriveRecentResults(matches).map((m) => m.id)).toEqual(["f2", "f1"]);
  });

  it("limita a 5 resultados (os mais recentes)", () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      makeItem({
        id: `f${i}`,
        status: "finished",
        // i maior = mais recente
        kickoffAt: new Date(2026, 5, 1 + i, 18).toISOString(),
      }),
    );
    const result = deriveRecentResults(matches);
    expect(result).toHaveLength(5);
    expect(result.map((m) => m.id)).toEqual(["f7", "f6", "f5", "f4", "f3"]);
  });

  it("retorna [] quando não há jogo finalizado", () => {
    const matches = [
      makeItem({ id: "s", status: "scheduled" }),
      makeItem({ id: "l", status: "live" }),
    ];
    expect(deriveRecentResults(matches)).toEqual([]);
  });
});
