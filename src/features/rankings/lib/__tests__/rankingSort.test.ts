import { describe, expect, it } from "vitest";

import {
  compareRanking,
  rankParticipants,
  type RankableParticipant,
} from "@/features/rankings/lib";

function p(
  uid: string,
  points: number,
  overrides: Partial<RankableParticipant> = {},
): RankableParticipant {
  return { uid, points, accuracy: 0, wrong: 0, ...overrides };
}

describe("rankingSort", () => {
  it("ordena por points DESC", () => {
    const ranked = rankParticipants([p("a", 5), p("b", 10), p("c", 7)]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "c", "a"]);
  });

  it("atribui position 1-indexed sequencial", () => {
    const ranked = rankParticipants([p("a", 5), p("b", 10)]);
    expect(ranked.map((r) => r.position)).toEqual([1, 2]);
    expect(ranked[0]?.uid).toBe("b");
  });

  it("desempata por accuracy DESC quando points iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50 }),
      p("b", 10, { accuracy: 80 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("desempata por wrong ASC quando points e accuracy iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50, wrong: 9 }),
      p("b", 10, { accuracy: 50, wrong: 3 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("desempata por firstPredictionAt ASC (mais antigo primeiro)", () => {
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-05T10:00:00Z" }),
      p("b", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("coloca firstPredictionAt ausente por último entre empatados", () => {
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50, wrong: 3 }), // sem data
      p("b", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("fallback final por uid quando tudo igual", () => {
    const ranked = rankParticipants([
      p("zeta", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" }),
      p("alpha", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["alpha", "zeta"]);
  });

  it("compara firstPredictionAt por instante, não por string (offsets ISO)", () => {
    // "2026-06-01T07:00:00-03:00" == "2026-06-01T10:00:00Z" (mesmo instante)
    // "2026-06-01T09:00:00Z" é mais cedo → deve vir primeiro apesar da string maior.
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T07:00:00-03:00" }),
      p("b", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T09:00:00Z" }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("mesmo instante com offsets diferentes desempata por uid", () => {
    const ranked = rankParticipants([
      p("zeta", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" }),
      p("alpha", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T07:00:00-03:00" }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["alpha", "zeta"]);
  });

  it("não muta a entrada", () => {
    const input = [p("a", 5), p("b", 10)];
    const snapshot = JSON.stringify(input);
    rankParticipants(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("lista vazia retorna []", () => {
    expect(rankParticipants([])).toEqual([]);
  });

  it("compareRanking retorna 0 só quando uid igual (ordem total)", () => {
    const a = p("x", 10, { accuracy: 50, wrong: 3, firstPredictionAt: "2026-06-01T10:00:00Z" });
    expect(compareRanking(a, { ...a })).toBe(0);
    expect(compareRanking(p("a", 10), p("b", 10))).toBeLessThan(0);
  });
});
