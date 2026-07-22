/**
 * TASK-12 — helper puro de agregação do ranking "geral" multi-campeonato.
 *
 * `aggregateChampionshipScopes` soma, por uid, os `RankableParticipant` já
 * computados por campeonato (saída de `champGeralPart`), produzindo um único
 * participante agregado por uid. `accuracy` NÃO é somável: é recomputada de
 * `Σcorrect / Σfinished`, onde o denominador é a soma das finalizadas de TODOS
 * os campeonatos habilitados (spec §6.2), independente de o uid ter palpitado.
 */

import { describe, expect, it } from "vitest";

import { computeAccuracy, type RankableParticipant } from "@/features/rankings/lib";
import { aggregateChampionshipScopes } from "@/server/rankings/aggregateScopes";

const p = (over: Partial<RankableParticipant> & { uid: string }): RankableParticipant => ({
  points: 0,
  accuracy: 0,
  wrong: 0,
  correct: 0,
  winner: 0,
  draw: 0,
  ...over,
});

const byUid = (list: RankableParticipant[]) => new Map(list.map((x) => [x.uid, x]));

describe("aggregateChampionshipScopes", () => {
  it("soma points/correct/winner/draw/wrong por uid entre 2 campeonatos", () => {
    const out = byUid(
      aggregateChampionshipScopes([
        {
          finished: 10,
          participants: [p({ uid: "u1", points: 30, correct: 3, winner: 0, draw: 0, wrong: 2 })],
        },
        {
          finished: 5,
          participants: [p({ uid: "u1", points: 15, correct: 1, winner: 1, draw: 0, wrong: 1 })],
        },
      ]),
    );

    const u1 = out.get("u1")!;
    expect(u1.points).toBe(45); // 30 + 15
    expect(u1.correct).toBe(4); // 3 + 1
    expect(u1.winner).toBe(1); // 0 + 1
    expect(u1.draw).toBe(0);
    expect(u1.wrong).toBe(3); // 2 + 1
  });

  it("accuracy = Σcorrect / Σfinished (denominador somado entre campeonatos)", () => {
    const out = byUid(
      aggregateChampionshipScopes([
        { finished: 10, participants: [p({ uid: "u1", correct: 3 })] },
        { finished: 5, participants: [p({ uid: "u1", correct: 1 })] },
      ]),
    );

    // 4 exatos de 15 finalizadas → computeAccuracy(4, 15)
    expect(out.get("u1")!.accuracy).toBe(computeAccuracy(4, 15));
  });

  it("uid presente em um campeonato e ausente no outro → soma parcial correta", () => {
    const out = byUid(
      aggregateChampionshipScopes([
        { finished: 10, participants: [p({ uid: "u1", points: 20, correct: 2 })] },
        { finished: 8, participants: [p({ uid: "u2", points: 30, correct: 3 })] },
      ]),
    );

    // Ambos re-normalizam sobre o total de finalizadas do pool (10 + 8 = 18).
    const u1 = out.get("u1")!;
    expect(u1.points).toBe(20);
    expect(u1.accuracy).toBe(computeAccuracy(2, 18));

    const u2 = out.get("u2")!;
    expect(u2.points).toBe(30);
    expect(u2.accuracy).toBe(computeAccuracy(3, 18));
  });

  it("fonte sem finalizadas (0) não quebra e contribui 0", () => {
    const out = byUid(
      aggregateChampionshipScopes([
        { finished: 0, participants: [p({ uid: "u1", points: 0, correct: 0 })] },
        { finished: 4, participants: [p({ uid: "u1", points: 20, correct: 2 })] },
      ]),
    );

    const u1 = out.get("u1")!;
    expect(u1.points).toBe(20);
    expect(u1.accuracy).toBe(computeAccuracy(2, 4)); // denominador só as 4 reais
  });

  it("firstPredictionAt agregado = menor ISO entre os campeonatos", () => {
    const out = byUid(
      aggregateChampionshipScopes([
        { finished: 4, participants: [p({ uid: "u1", firstPredictionAt: "2026-06-10T00:00:00.000Z" })] },
        { finished: 4, participants: [p({ uid: "u1", firstPredictionAt: "2026-05-01T00:00:00.000Z" })] },
      ]),
    );

    expect(out.get("u1")!.firstPredictionAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("lista de fontes vazia → mapa vazio", () => {
    expect(aggregateChampionshipScopes([])).toEqual([]);
  });

  it("todas as fontes vazias de participantes → nenhum uid", () => {
    expect(
      aggregateChampionshipScopes([
        { finished: 5, participants: [] },
        { finished: 3, participants: [] },
      ]),
    ).toEqual([]);
  });
});
