import { describe, expect, it } from "vitest";

import {
  deriveBettorDna,
  type ProfilePredictionItem,
} from "@/features/rankings/lib";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const team = { id: "bra", name: "Brasil", flagUrl: null };

function makeItem(
  homeScore: number,
  awayScore: number,
  matchId = "m001",
): ProfilePredictionItem {
  return {
    matchId,
    kickoffAt: "2026-06-15T13:00:00Z",
    stage: "grupos",
    groupId: "A",
    homeTeam: team,
    awayTeam: team,
    prediction: { homeScore, awayScore },
    actualScore: null,
    matchStatus: "scheduled",
    displayStatus: "pendente",
  };
}

// ---------------------------------------------------------------------------
// deriveBettorDna
// ---------------------------------------------------------------------------

describe("deriveBettorDna", () => {
  it("lista vazia: cauteloso, sem placar favorito, média 0", () => {
    const result = deriveBettorDna([]);
    expect(result).toEqual({
      tendency: "cauteloso",
      favoritePrediction: null,
      avgGoalsPerMatch: 0,
    });
  });

  it("único palpite: ele mesmo é o favorito", () => {
    const result = deriveBettorDna([makeItem(2, 1)]);
    expect(result.favoritePrediction).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("par mais frequente é o placar favorito", () => {
    const items = [
      makeItem(2, 1, "m1"),
      makeItem(2, 1, "m2"),
      makeItem(1, 0, "m3"),
    ];
    expect(deriveBettorDna(items).favoritePrediction).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("empate de frequência: vence o par com maior soma de gols", () => {
    // 2-1 (sum=3) vs 1-0 (sum=1) — ambos aparecem 1 vez
    const items = [makeItem(2, 1, "m1"), makeItem(1, 0, "m2")];
    expect(deriveBettorDna(items).favoritePrediction).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("empate de frequência e soma: vence menor homeScore", () => {
    // 1-2 (sum=3, home=1) vs 2-1 (sum=3, home=2) — ambos 1 vez, mesmo sum
    const items = [makeItem(2, 1, "m1"), makeItem(1, 2, "m2")];
    expect(deriveBettorDna(items).favoritePrediction).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it("avgGoalsPerMatch: média de gols total por jogo (2 casas decimais)", () => {
    // (2+1) + (1+1) + (0+0) = 5 gols em 3 jogos → 1.67
    const items = [makeItem(2, 1, "m1"), makeItem(1, 1, "m2"), makeItem(0, 0, "m3")];
    expect(deriveBettorDna(items).avgGoalsPerMatch).toBe(1.67);
  });

  it("avgGoalsPerMatch > 2.5 → tendency 'otimista'", () => {
    // (3+1) = 4 gols em 1 jogo = 4.0
    const items = [makeItem(3, 1, "m1")];
    expect(deriveBettorDna(items).tendency).toBe("otimista");
  });

  it("avgGoalsPerMatch === 2.5 → tendency 'cauteloso'", () => {
    // (2+1) + (1+1) = 5 gols em 2 jogos = 2.5 → cauteloso (not > 2.5)
    const items = [makeItem(2, 1, "m1"), makeItem(1, 1, "m2")];
    expect(deriveBettorDna(items).tendency).toBe("cauteloso");
  });

  it("avgGoalsPerMatch < 2.5 → tendency 'cauteloso'", () => {
    const items = [makeItem(1, 0, "m1"), makeItem(1, 1, "m2")];
    // (1+0) + (1+1) = 3 gols em 2 → 1.5
    expect(deriveBettorDna(items).tendency).toBe("cauteloso");
  });

  it("avgGoalsPerMatch exatamente 2 casas decimais (arredonda correto)", () => {
    // 1 jogo 1-1 = 2 gols → 2.00
    expect(deriveBettorDna([makeItem(1, 1)]).avgGoalsPerMatch).toBe(2);
  });

  it("todos os pares únicos: retorna par com maior soma de gols", () => {
    const items = [
      makeItem(1, 0, "m1"), // sum=1
      makeItem(2, 1, "m2"), // sum=3
      makeItem(1, 1, "m3"), // sum=2
    ];
    expect(deriveBettorDna(items).favoritePrediction).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("favoritePrediction reflete apenas palpites (não inclui resultado real)", () => {
    // Mesmo com actualScore diferente, favoritePrediction vem de prediction
    const item = makeItem(2, 1);
    const withScore: ProfilePredictionItem = {
      ...item,
      actualScore: { homeScore: 0, awayScore: 0 },
      displayStatus: "errou",
    };
    expect(deriveBettorDna([withScore]).favoritePrediction).toEqual({ homeScore: 2, awayScore: 1 });
  });
});
