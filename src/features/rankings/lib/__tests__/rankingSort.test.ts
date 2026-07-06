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

  it("desempata por acerto (correct) DESC quando points iguais — acerto tem mais peso", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 2 }), // A2
      p("b", 10, { correct: 4 }), // A4
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("acerto tem mais peso que vitória (cenário da tela: A4 V7 vence A2 V11)", () => {
    // Reproduz o empate real de 75 pts: quem tem mais acertos exatos (A) fica à frente,
    // mesmo com menos vitórias (V).
    const ranked = rankParticipants([
      p("welton", 75, { correct: 4, winner: 7, draw: 0 }), // A4 V7 E0
      p("kaique", 75, { correct: 2, winner: 11, draw: 0 }), // A2 V11 E0
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["welton", "kaique"]);
  });

  it("desempata por vitória (winner) DESC quando points e acerto iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 2, winner: 3 }), // A2 V3
      p("b", 10, { correct: 2, winner: 6 }), // A2 V6
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("desempata por empate (draw) DESC quando points, acerto e vitória iguais", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 2, winner: 3, draw: 1 }), // A2 V3 E1
      p("b", 10, { correct: 2, winner: 3, draw: 4 }), // A2 V3 E4
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("cai para accuracy quando points, acerto, vitória e empate iguais (cadeia preservada)", () => {
    const ranked = rankParticipants([
      p("a", 10, { correct: 1, winner: 1, draw: 1, accuracy: 50 }),
      p("b", 10, { correct: 1, winner: 1, draw: 1, accuracy: 80 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("A/V/E ausentes contam como 0 (determinístico, sem NaN)", () => {
    // Sem correct/winner/draw, desempata direto por accuracy.
    const ranked = rankParticipants([
      p("a", 10, { accuracy: 50 }),
      p("b", 10, { accuracy: 80 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("acerto tem prioridade sobre accuracy no desempate", () => {
    // a tem accuracy maior, mas menos acertos exatos → b (mais A) vem primeiro.
    const ranked = rankParticipants([
      p("a", 10, { correct: 1, accuracy: 90 }), // A1
      p("b", 10, { correct: 3, accuracy: 10 }), // A3
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("cadeia completa: points > acerto > vitória > empate > accuracy em ranking misto", () => {
    const ranked = rankParticipants([
      // pontos diferentes primeiro
      p("low", 8, { correct: 5, winner: 5, draw: 5, accuracy: 99 }),
      // empatados em pontos: A > V > E > accuracy
      p("c", 10, { correct: 1, winner: 9, draw: 9, accuracy: 40 }), // A1
      p("a", 10, { correct: 3, winner: 1, draw: 2, accuracy: 10 }), // A3 V1 E2
      p("b", 10, { correct: 3, winner: 5, draw: 0, accuracy: 20 }), // A3 V5
      p("d", 10, { correct: 3, winner: 1, draw: 9, accuracy: 70 }), // A3 V1 E9
    ]);
    // 10pts: b(A3 V5) > d(A3 V1 E9) > a(A3 V1 E2) > c(A1); depois low(8pts).
    expect(ranked.map((r) => r.uid)).toEqual(["b", "d", "a", "c", "low"]);
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
