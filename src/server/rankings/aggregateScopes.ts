import { computeAccuracy, type RankableParticipant } from "@/features/rankings/lib";

/**
 * TASK-12 — agregação do ranking "geral" multi-campeonato (soma bruta).
 *
 * Recebe, por campeonato habilitado/pontuável do pool, os `RankableParticipant`
 * já computados (saída de `champGeralPart`/`geralPart`) mais o total de partidas
 * finalizadas daquele campeonato, e produz UM participante agregado por uid.
 *
 * Regras (spec §6):
 *  - `points`/`correct`/`winner`/`draw`/`wrong` são SOMADOS entre campeonatos
 *    (soma bruta — a unidade já é homogênea; um acerto pesa igual em qualquer
 *    campeonato). Sem normalização.
 *  - `accuracy` NÃO é somável: recomputada de `Σcorrect / Σfinished`, onde o
 *    denominador é a soma das finalizadas de TODOS os campeonatos habilitados,
 *    independente de o uid ter palpitado em cada um.
 *  - `firstPredictionAt` agregado = menor ISO presente entre os campeonatos.
 *
 * Função pura (sem I/O): a ordenação/posição fica a cargo de `rankParticipants`.
 */

export interface ChampionshipScopeSource {
  /** Total de partidas finalizadas do campeonato — compõe o denominador de aproveitamento. */
  finished: number;
  /** Participantes já pontuados no escopo `geral` daquele campeonato. */
  participants: RankableParticipant[];
}

interface Acc {
  points: number;
  correct: number;
  winner: number;
  draw: number;
  wrong: number;
  firstPredictionAt: string | undefined;
}

export function aggregateChampionshipScopes(
  sources: ChampionshipScopeSource[],
): RankableParticipant[] {
  const totalFinished = sources.reduce((sum, s) => sum + s.finished, 0);

  const accByUid = new Map<string, Acc>();
  for (const source of sources) {
    for (const part of source.participants) {
      const acc = accByUid.get(part.uid) ?? {
        points: 0,
        correct: 0,
        winner: 0,
        draw: 0,
        wrong: 0,
        firstPredictionAt: undefined,
      };
      acc.points += part.points;
      acc.correct += part.correct ?? 0;
      acc.winner += part.winner ?? 0;
      acc.draw += part.draw ?? 0;
      acc.wrong += part.wrong;
      if (
        part.firstPredictionAt !== undefined &&
        (acc.firstPredictionAt === undefined || part.firstPredictionAt < acc.firstPredictionAt)
      ) {
        acc.firstPredictionAt = part.firstPredictionAt;
      }
      accByUid.set(part.uid, acc);
    }
  }

  return Array.from(accByUid, ([uid, acc]) => ({
    uid,
    points: acc.points,
    accuracy: computeAccuracy(acc.correct, totalFinished),
    wrong: acc.wrong,
    correct: acc.correct,
    winner: acc.winner,
    draw: acc.draw,
    firstPredictionAt: acc.firstPredictionAt,
  }));
}
