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

  it("desempata por vitórias acertadas (correct + winner) DESC quando points iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 1, winner: 1 }), // 2 vitórias
      p("b", 10, { correct: 2, winner: 2 }), // 4 vitórias
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("vitórias = soma de correct + winner (não um campo só)", () => {
    // a tem mais correct, mas soma menor; b tem soma maior → b primeiro.
    const ranked = rankParticipants([
      p("a", 10, { correct: 3, winner: 0 }), // 3 vitórias
      p("b", 10, { correct: 2, winner: 3 }), // 5 vitórias
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("desempata por empates acertados (draw) DESC quando points e vitórias iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 2, winner: 1, draw: 1 }), // 3 vitórias, 1 empate
      p("b", 10, { correct: 1, winner: 2, draw: 4 }), // 3 vitórias, 4 empates
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("cai para accuracy quando points, vitórias e empates iguais (cadeia preservada)", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 1, winner: 1, draw: 1, accuracy: 50 }),
      p("b", 10, { correct: 1, winner: 1, draw: 1, accuracy: 80 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("vitórias/empates ausentes contam como 0 (determinístico, sem NaN)", () => {
    // Sem correct/winner/draw, desempata direto por accuracy.
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50 }),
      p("b", 10, { accuracy: 80 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("vitórias têm prioridade sobre accuracy no desempate", () => {
    // a tem accuracy maior, mas menos vitórias → b (mais vitórias) vem primeiro.
    const ranked = rankParticipants([
      p("a", 10, { correct: 0, winner: 1, accuracy: 90 }), // 1 vitória
      p("b", 10, { correct: 2, winner: 1, accuracy: 10 }), // 3 vitórias
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("empates têm prioridade sobre accuracy (points e vitórias iguais)", () => {
    // a tem accuracy maior, mas menos empates → b (mais empates) primeiro.
    const ranked = rankParticipants([
      p("a", 10, { correct: 1, winner: 1, draw: 1, accuracy: 90 }),
      p("b", 10, { correct: 1, winner: 1, draw: 3, accuracy: 10 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("cadeia completa: points > vitórias > empates > accuracy em ranking misto", () => {
    const ranked = rankParticipants([
      // pontos diferentes primeiro
      p("low", 8, { correct: 5, winner: 5, draw: 5, accuracy: 99 }),
      // empatados em pontos: desempate por vitórias, depois empates, depois accuracy
      p("c", 10, { correct: 1, winner: 1, draw: 0, accuracy: 40 }), // 2 vit
      p("a", 10, { correct: 2, winner: 1, draw: 2, accuracy: 10 }), // 3 vit, 2 emp
      p("b", 10, { correct: 1, winner: 2, draw: 5, accuracy: 20 }), // 3 vit, 5 emp
      p("d", 10, { correct: 1, winner: 1, draw: 3, accuracy: 70 }), // 2 vit, 3 emp
    ]);
    // 10pts: b(3v,5e) > a(3v,2e) > d(2v,3e) > c(2v,0e); depois low(8pts).
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a", "d", "c", "low"]);
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
