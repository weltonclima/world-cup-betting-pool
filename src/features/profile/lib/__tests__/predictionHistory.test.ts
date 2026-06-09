import { describe, expect, it } from "vitest";

import {
  derivePredictionEntry,
  filterHistory,
  type PredictionHistoryEntry,
} from "@/features/profile/lib/predictionHistory";

type Match = Parameters<typeof derivePredictionEntry>[1];

function makeMatch(over: Partial<Match> = {}): Match {
  return {
    homeTeamId: "BRA",
    awayTeamId: "SRB",
    kickoffAt: "2026-05-20T18:00:00+00:00",
    stage: "grupos",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    ...over,
  } as Match;
}

const pred = { matchId: "m1", homeScore: 2, awayScore: 1 };

describe("derivePredictionEntry (regra binária)", () => {
  it("placar exato → +1 e 'Acertou Resultado'", () => {
    const e = derivePredictionEntry(pred, makeMatch());
    expect(e.result).toBe("exact");
    expect(e.points).toBe(1);
    expect(e.resultLabel).toBe("Acertou Resultado");
  });

  it("placar não-exato → 0 e 'Errou Resultado' (sem acerto de vencedor)", () => {
    // Palpite 2x1, oficial 3x0: mesmo vencedor, mas placar errado → 0.
    const e = derivePredictionEntry(pred, makeMatch({ homeScore: 3, awayScore: 0 }));
    expect(e.result).toBe("wrong");
    expect(e.points).toBe(0);
    expect(e.resultLabel).toBe("Errou Resultado");
  });

  it("partida não finalizada → pending (0 pts, sem oficial)", () => {
    const e = derivePredictionEntry(
      pred,
      makeMatch({ status: "scheduled", homeScore: null, awayScore: null }),
    );
    expect(e.result).toBe("pending");
    expect(e.points).toBe(0);
    expect(e.official).toBeNull();
    expect(e.resultLabel).toBe("Aguardando resultado");
  });

  it("propaga metadados da partida", () => {
    const e = derivePredictionEntry(pred, makeMatch({ stage: "final" }));
    expect(e.matchId).toBe("m1");
    expect(e.stage).toBe("final");
    expect(e.homeTeamId).toBe("BRA");
    expect(e.predicted).toEqual({ home: 2, away: 1 });
  });
});

describe("filterHistory", () => {
  const entries = [
    { result: "exact" },
    { result: "wrong" },
    { result: "pending" },
    { result: "exact" },
  ] as PredictionHistoryEntry[];

  it("all → todas", () => {
    expect(filterHistory(entries, "all")).toHaveLength(4);
  });
  it("hits → só exact", () => {
    expect(filterHistory(entries, "hits")).toHaveLength(2);
  });
  it("misses → só wrong (pending excluído)", () => {
    expect(filterHistory(entries, "misses")).toHaveLength(1);
  });
});
