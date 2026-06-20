/**
 * TDD RED phase — TASK-01 (home-revamp)
 * Testes da derivação pura `deriveHeroSummary`.
 * A função NÃO existe ainda — todos os testes devem falhar no import.
 * Regras: ai/spec/task-home-revamp-01.md §6.
 */
import { describe, expect, it } from "vitest";

import type { PoolStats, Ranking, Statistics } from "@/types";

import { deriveHeroSummary } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UID = "user-01";

function makeRanking(entries: Ranking["entries"] = []): Ranking {
  return { scope: "geral", updatedAt: "2026-06-15T00:00:00.000Z", entries };
}

function entry(overrides: Partial<Ranking["entries"][number]> = {}): Ranking["entries"][number] {
  return { uid: UID, nickname: "Zé", position: 3, points: 128, ...overrides };
}

function makeStatistics(overrides: Partial<Statistics> = {}): Statistics {
  return {
    uid: UID,
    totalCorrect: 18,
    accuracy: 72,
    longestStreak: 5,
    correctByStage: { grupos: 18 },
    positionHistory: [],
    ...overrides,
  };
}

function makePoolStats(overrides: Partial<PoolStats> = {}): PoolStats {
  return {
    updatedAt: "2026-06-15T00:00:00.000Z",
    totalParticipants: 24,
    highestPoints: 210,
    lowestPoints: 12,
    averagePoints: 96,
    totalCorrect: 300,
    distribution: [],
    ...overrides,
  };
}

function ph(at: string, position: number, round?: number) {
  return { at, scope: "geral" as const, position, ...(round != null ? { round } : {}) };
}

// ---------------------------------------------------------------------------
// Posição + pontos
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — posição/pontos", () => {
  it("extrai posição, total de participantes e pontos do ranking do usuário", () => {
    const r = deriveHeroSummary(makeRanking([entry({ position: 3, points: 128 })]), null, null, UID);
    expect(r.position).toBe(3);
    expect(r.totalParticipants).toBe(1);
    expect(r.points).toBe(128);
  });

  it("posição/pontos null quando ranking ausente", () => {
    const r = deriveHeroSummary(null, makeStatistics(), null, UID);
    expect(r.position).toBeNull();
    expect(r.points).toBeNull();
    expect(r.totalParticipants).toBeNull();
  });

  it("posição/pontos null quando uid não está nas entries", () => {
    const r = deriveHeroSummary(makeRanking([entry({ uid: "outro" })]), null, null, UID);
    expect(r.position).toBeNull();
    expect(r.points).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tendência
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — tendência", () => {
  it("trend null com 0 snapshots", () => {
    const r = deriveHeroSummary(null, makeStatistics({ positionHistory: [] }), null, UID);
    expect(r.trend).toBeNull();
  });

  it("trend null com 1 snapshot", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({ positionHistory: [ph("2026-06-10T00:00:00.000Z", 5)] }),
      null,
      UID,
    );
    expect(r.trend).toBeNull();
  });

  it("subiu: posição melhora (5 → 3) → direction up, delta 2", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 5),
          ph("2026-06-11T00:00:00.000Z", 3),
        ],
      }),
      null,
      UID,
    );
    expect(r.trend).toEqual(expect.objectContaining({ direction: "up", delta: 2 }));
  });

  it("caiu: posição piora (3 → 5) → direction down, delta 2", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 3),
          ph("2026-06-11T00:00:00.000Z", 5),
        ],
      }),
      null,
      UID,
    );
    expect(r.trend).toEqual(expect.objectContaining({ direction: "down", delta: 2 }));
  });

  it("estável: posição igual (4 → 4) → direction stable, delta 0", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 4),
          ph("2026-06-11T00:00:00.000Z", 4),
        ],
      }),
      null,
      UID,
    );
    expect(r.trend).toEqual(expect.objectContaining({ direction: "stable", delta: 0 }));
  });

  it("ordena por `at` antes de comparar os 2 últimos (entrada fora de ordem)", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-11T00:00:00.000Z", 3), // mais recente, fora de ordem
          ph("2026-06-10T00:00:00.000Z", 5),
        ],
      }),
      null,
      UID,
    );
    // últimos dois por `at`: 5 (dia 10) → 3 (dia 11) = subiu
    expect(r.trend?.direction).toBe("up");
  });

  it("roundLabel 'R{n}' quando a última entrada tem round", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 5, 4),
          ph("2026-06-11T00:00:00.000Z", 3, 5),
        ],
      }),
      null,
      UID,
    );
    expect(r.trend?.roundLabel).toBe("R5");
  });

  it("roundLabel null quando a última entrada não tem round", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 5),
          ph("2026-06-11T00:00:00.000Z", 3),
        ],
      }),
      null,
      UID,
    );
    expect(r.trend?.roundLabel).toBeNull();
  });

  it("ignora snapshots de escopo != geral (§6.2)", () => {
    // Mistura geral + grupos: só os geral contam p/ tendência e sparkline.
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 8),
          { at: "2026-06-11T00:00:00.000Z", scope: "grupos", position: 1 },
          ph("2026-06-12T00:00:00.000Z", 5),
        ],
      }),
      null,
      UID,
    );
    // geral: 8 -> 5 (subiu 3). Se "grupos" vazasse, o último seria 5 vs 1 etc.
    expect(r.trend).toEqual({ direction: "up", delta: 3, roundLabel: null });
    expect(r.sparkline).toEqual([8, 5]);
  });

  it("tendência null quando só há 1 snapshot geral entre escopos", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-10T00:00:00.000Z", 5),
          { at: "2026-06-11T00:00:00.000Z", scope: "oitavas", position: 2 },
        ],
      }),
      null,
      UID,
    );
    expect(r.trend).toBeNull();
    expect(r.sparkline).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Aproveitamento + denominador
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — aproveitamento/denominador", () => {
  it("denominador = totalCorrect + totalWrong quando sem parciais", () => {
    const r = deriveHeroSummary(null, makeStatistics({ totalCorrect: 18, totalWrong: 7 }), null, UID);
    expect(r.denominator).toBe(25);
    expect(r.totalCorrect).toBe(18);
  });

  it("denominador inclui PARCIAIS (exatos + parciais + erros)", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({ totalCorrect: 18, totalPartial: 9, totalWrong: 7 }),
      null,
      UID,
    );
    expect(r.denominator).toBe(34); // 18 + 9 + 7
    expect(r.totalCorrect).toBe(18); // numerador segue só exatos
  });

  it("denominador null quando totalWrong ausente (fallback = omitir)", () => {
    const r = deriveHeroSummary(null, makeStatistics({ totalCorrect: 18, totalWrong: undefined }), null, UID);
    expect(r.denominator).toBeNull();
  });

  it("accuracy/totalCorrect/longestStreak passam direto; 0 sem statistics", () => {
    const com = deriveHeroSummary(null, makeStatistics({ accuracy: 72, longestStreak: 5 }), null, UID);
    expect(com.accuracy).toBe(72);
    expect(com.longestStreak).toBe(5);

    const sem = deriveHeroSummary(null, null, null, UID);
    expect(sem.accuracy).toBe(0);
    expect(sem.totalCorrect).toBe(0);
    expect(sem.longestStreak).toBe(0);
    expect(sem.denominator).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — sparkline", () => {
  it("null com menos de 2 pontos", () => {
    expect(deriveHeroSummary(null, makeStatistics({ positionHistory: [] }), null, UID).sparkline).toBeNull();
    expect(
      deriveHeroSummary(null, makeStatistics({ positionHistory: [ph("2026-06-10T00:00:00.000Z", 5)] }), null, UID)
        .sparkline,
    ).toBeNull();
  });

  it("array de posições na ordem de `at` quando ≥2 pontos", () => {
    const r = deriveHeroSummary(
      null,
      makeStatistics({
        positionHistory: [
          ph("2026-06-11T00:00:00.000Z", 3),
          ph("2026-06-09T00:00:00.000Z", 8),
          ph("2026-06-10T00:00:00.000Z", 5),
        ],
      }),
      null,
      UID,
    );
    expect(r.sparkline).toEqual([8, 5, 3]);
  });
});

// ---------------------------------------------------------------------------
// Régua de percentil (bullet)
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — régua", () => {
  it("null sem poolStats", () => {
    const r = deriveHeroSummary(makeRanking([entry({ points: 128 })]), null, null, UID);
    expect(r.ruler).toBeNull();
  });

  it("null sem pontos do usuário (sem ranking)", () => {
    const r = deriveHeroSummary(null, null, makePoolStats(), UID);
    expect(r.ruler).toBeNull();
  });

  it("calcula fraction na escala [lowest, highest] e marca média", () => {
    const r = deriveHeroSummary(
      makeRanking([entry({ points: 150 })]),
      null,
      makePoolStats({ lowestPoints: 12, highestPoints: 210, averagePoints: 96 }),
      UID,
    );
    expect(r.ruler).not.toBeNull();
    expect(r.ruler?.lowest).toBe(12);
    expect(r.ruler?.highest).toBe(210);
    expect(r.ruler?.average).toBe(96);
    expect(r.ruler?.userPoints).toBe(150);
    // (150 - 12) / (210 - 12) = 138/198 ≈ 0.6970
    expect(r.ruler?.fraction).toBeCloseTo(0.697, 3);
    // média: (96 - 12) / 198 = 84/198 ≈ 0.4242 — distinta da fraction do usuário
    expect(r.ruler?.averageFraction).toBeCloseTo(0.4242, 3);
  });

  it("averageFraction = 1 quando highest === lowest", () => {
    const r = deriveHeroSummary(
      makeRanking([entry({ points: 50 })]),
      null,
      makePoolStats({ lowestPoints: 50, highestPoints: 50, averagePoints: 50 }),
      UID,
    );
    expect(r.ruler?.averageFraction).toBe(1);
  });

  it("clampa fraction em 0 e 1", () => {
    const baixo = deriveHeroSummary(
      makeRanking([entry({ points: 5 })]),
      null,
      makePoolStats({ lowestPoints: 12, highestPoints: 210 }),
      UID,
    );
    expect(baixo.ruler?.fraction).toBe(0);

    const alto = deriveHeroSummary(
      makeRanking([entry({ points: 999 })]),
      null,
      makePoolStats({ lowestPoints: 12, highestPoints: 210 }),
      UID,
    );
    expect(alto.ruler?.fraction).toBe(1);
  });

  it("highest === lowest → fraction 1 (todos empatados)", () => {
    const r = deriveHeroSummary(
      makeRanking([entry({ points: 50 })]),
      null,
      makePoolStats({ lowestPoints: 50, highestPoints: 50, averagePoints: 50 }),
      UID,
    );
    expect(r.ruler?.fraction).toBe(1);
    expect(r.ruler?.label).toBe("na média");
  });

  it("rótulo qualitativo: acima / na / abaixo da média", () => {
    const acima = deriveHeroSummary(
      makeRanking([entry({ points: 150 })]),
      null,
      makePoolStats({ averagePoints: 96 }),
      UID,
    );
    expect(acima.ruler?.label).toBe("acima da média");

    const na = deriveHeroSummary(
      makeRanking([entry({ points: 96 })]),
      null,
      makePoolStats({ averagePoints: 96 }),
      UID,
    );
    expect(na.ruler?.label).toBe("na média");

    const abaixo = deriveHeroSummary(
      makeRanking([entry({ points: 40 })]),
      null,
      makePoolStats({ averagePoints: 96 }),
      UID,
    );
    expect(abaixo.ruler?.label).toBe("abaixo da média");
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("deriveHeroSummary — empty", () => {
  it("isEmpty true quando sem ranking, sem statistics e sem poolStats", () => {
    expect(deriveHeroSummary(null, null, null, UID).isEmpty).toBe(true);
  });

  it("isEmpty false quando há ranking do usuário", () => {
    expect(deriveHeroSummary(makeRanking([entry()]), null, null, UID).isEmpty).toBe(false);
  });

  it("isEmpty false quando há statistics relevante", () => {
    expect(deriveHeroSummary(null, makeStatistics({ totalCorrect: 3 }), null, UID).isEmpty).toBe(false);
  });
});
