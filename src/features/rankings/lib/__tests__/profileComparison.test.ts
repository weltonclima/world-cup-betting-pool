import { describe, expect, it } from "vitest";

import {
  deriveProfileComparison,
  derivePredictionsCount,
  type ProfilePredictionItem,
} from "@/features/rankings/lib";
import type { RankingEntry } from "@/types/rankings";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const team = { id: "bra", name: "Brasil", flagUrl: null };

function makeEntry(
  uid: string,
  points: number,
  position: number,
): RankingEntry {
  return { uid, nickname: uid, points, position, wrong: 0, accuracy: 100 };
}

function makeItem(
  matchId: string,
  displayStatus: ProfilePredictionItem["displayStatus"],
): ProfilePredictionItem {
  return {
    matchId,
    kickoffAt: "2026-06-15T13:00:00Z",
    stage: "grupos",
    groupId: "A",
    homeTeam: team,
    awayTeam: team,
    prediction: { homeScore: 2, awayScore: 1 },
    actualScore: { homeScore: 2, awayScore: 1 },
    matchStatus: "finished",
    displayStatus,
  };
}

function makeMatch(matchId: string, kickoffAt: string) {
  return {
    id: matchId,
    homeTeamId: "bra",
    awayTeamId: "srb",
    kickoffAt,
    stage: "grupos" as const,
    groupId: "A",
    status: "finished" as const,
    homeScore: 2,
    awayScore: 1,
  };
}

const me = makeEntry("me", 20, 3);
const other = makeEntry("other", 26, 1);

// ---------------------------------------------------------------------------
// deriveProfileComparison
// ---------------------------------------------------------------------------

describe("deriveProfileComparison", () => {
  it("outro à frente: pointsDiff e positionDiff positivos", () => {
    const result = deriveProfileComparison(me, other, [], []);
    expect(result.pointsDiff).toBe(6);      // 26 - 20
    expect(result.positionDiff).toBe(2);    // 3 - 1
  });

  it("eu à frente: pointsDiff e positionDiff negativos", () => {
    const result = deriveProfileComparison(other, me, [], []);
    expect(result.pointsDiff).toBe(-6);
    expect(result.positionDiff).toBe(-2);
  });

  it("empate: ambos zero", () => {
    const equal = makeEntry("x", 20, 3);
    const result = deriveProfileComparison(me, equal, [], []);
    expect(result.pointsDiff).toBe(0);
    expect(result.positionDiff).toBe(0);
  });

  it("otherCorrectMyWrong = 0 quando não há matchIds em comum", () => {
    const myItems = [makeItem("m001", "errou")];
    const otherItems = [makeItem("m999", "acertou")]; // matchId diferente
    const result = deriveProfileComparison(me, other, myItems, otherItems);
    expect(result.otherCorrectMyWrong).toBe(0);
  });

  it("otherCorrectMyWrong conta matchIds onde outro acertou e eu errei", () => {
    const myItems = [makeItem("m001", "errou"), makeItem("m002", "errou")];
    const otherItems = [makeItem("m001", "acertou"), makeItem("m002", "acertou_vencedor")];
    const result = deriveProfileComparison(me, other, myItems, otherItems);
    expect(result.otherCorrectMyWrong).toBe(2);
  });

  it("acertou_empate conta como acerto do outro", () => {
    const myItems = [makeItem("m001", "errou")];
    const otherItems = [makeItem("m001", "acertou_empate")];
    expect(deriveProfileComparison(me, other, myItems, otherItems).otherCorrectMyWrong).toBe(1);
  });

  it("não conta quando eu acertei e outro errou", () => {
    const myItems = [makeItem("m001", "acertou")];
    const otherItems = [makeItem("m001", "errou")];
    expect(deriveProfileComparison(me, other, myItems, otherItems).otherCorrectMyWrong).toBe(0);
  });

  it("não conta quando ambos erraram no mesmo jogo", () => {
    const myItems = [makeItem("m001", "errou")];
    const otherItems = [makeItem("m001", "errou")];
    expect(deriveProfileComparison(me, other, myItems, otherItems).otherCorrectMyWrong).toBe(0);
  });

  it("não conta quando eu errei mas outro está pendente", () => {
    const myItems = [makeItem("m001", "errou")];
    const otherItems = [makeItem("m001", "pendente")];
    expect(deriveProfileComparison(me, other, myItems, otherItems).otherCorrectMyWrong).toBe(0);
  });

  it("jogo em que só eu tenho palpite é ignorado", () => {
    const myItems = [makeItem("m001", "errou")];
    const otherItems: ProfilePredictionItem[] = [];
    expect(deriveProfileComparison(me, other, myItems, otherItems).otherCorrectMyWrong).toBe(0);
  });

  it("não expõe palpites individuais — retorno contém apenas contagens", () => {
    const result = deriveProfileComparison(me, other, [], []);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["pointsDiff", "positionDiff", "otherCorrectMyWrong"]),
    );
    expect(Object.keys(result)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// derivePredictionsCount
// ---------------------------------------------------------------------------

describe("derivePredictionsCount", () => {
  const now = new Date("2026-06-20T12:00:00Z");

  it("sem palpites: made=0, ofTotal=N (jogos com kickoff passado)", () => {
    const matches = [
      makeMatch("m1", "2026-06-15T13:00:00Z"),
      makeMatch("m2", "2026-06-18T13:00:00Z"),
    ];
    const result = derivePredictionsCount([], matches, now);
    expect(result.made).toBe(0);
    expect(result.ofTotal).toBe(2);
  });

  it("jogos com kickoff futuro não entram no denominador", () => {
    const matches = [
      makeMatch("m1", "2026-06-15T13:00:00Z"), // passado
      makeMatch("m2", "2026-06-25T13:00:00Z"), // futuro
    ];
    expect(derivePredictionsCount([], matches, now).ofTotal).toBe(1);
  });

  it("kickoff exatamente no momento de 'now' entra no denominador (kickoffAt <= now)", () => {
    const matches = [makeMatch("m1", "2026-06-20T12:00:00Z")]; // === now
    expect(derivePredictionsCount([], matches, now).ofTotal).toBe(1);
  });

  it("made = número de palpites na lista (independente do kickoff)", () => {
    const predictions = [
      { matchId: "m1", kickoffAt: "2026-06-15T13:00:00Z", stage: "grupos" as const, groupId: "A", homeTeam: team, awayTeam: team, prediction: { homeScore: 1, awayScore: 0 }, actualScore: null, matchStatus: "finished" as const, displayStatus: "acertou" as const },
    ];
    const matches = [makeMatch("m1", "2026-06-15T13:00:00Z")];
    expect(derivePredictionsCount(predictions, matches, now).made).toBe(1);
  });

  it("lista de partidas vazia: ofTotal=0", () => {
    const result = derivePredictionsCount([], [], now);
    expect(result).toEqual({ made: 0, ofTotal: 0 });
  });

  it("múltiplos palpites: made conta todos independente de status", () => {
    const items: ProfilePredictionItem[] = [
      { matchId: "m1", kickoffAt: "2026-06-15T13:00:00Z", stage: "grupos", groupId: "A", homeTeam: team, awayTeam: team, prediction: { homeScore: 2, awayScore: 1 }, actualScore: null, matchStatus: "finished", displayStatus: "acertou" },
      { matchId: "m2", kickoffAt: "2026-06-18T13:00:00Z", stage: "grupos", groupId: "B", homeTeam: team, awayTeam: team, prediction: { homeScore: 1, awayScore: 1 }, actualScore: null, matchStatus: "finished", displayStatus: "errou" },
    ];
    const matches = [
      makeMatch("m1", "2026-06-15T13:00:00Z"),
      makeMatch("m2", "2026-06-18T13:00:00Z"),
    ];
    const result = derivePredictionsCount(items, matches, now);
    expect(result.made).toBe(2);
    expect(result.ofTotal).toBe(2);
  });
});
