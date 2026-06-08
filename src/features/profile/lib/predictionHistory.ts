import type { z } from "zod";

import type { matchSchema } from "@/schemas/matches";
import type { predictionSchema } from "@/schemas/predictions";
import type { stageSchema } from "@/schemas/shared";

// Tipos derivados dos schemas Firestore (fonte única de verdade).
type Prediction = z.infer<typeof predictionSchema>;
type Match = z.infer<typeof matchSchema>;
type Stage = z.infer<typeof stageSchema>;

/**
 * Resultado de um palpite segundo a regra de pontuação BINÁRIA do projeto
 * (`.claude/CLAUDE.md`): placar exato = +1; qualquer outro = 0. Não existe
 * acerto de vencedor/parcial.
 *
 * NOTA (A1 do PRD-06): o mock `PRD06-03` exibe "+3 pts" e "Acertou Vencedor",
 * incompatível com a regra binária e com o modelo de dados (`predictions.points`
 * é `0 | 1`). Esta lib segue a regra binária — divergência sinalizada para
 * confirmação do produto.
 */
export type PredictionResult = "exact" | "wrong" | "pending";

export interface PredictionHistoryEntry {
  matchId: string;
  kickoffAt: string;
  stage: Stage;
  homeTeamId: string;
  awayTeamId: string;
  predicted: { home: number; away: number };
  official: { home: number; away: number } | null;
  result: PredictionResult;
  points: 0 | 1;
  /** Rótulo pt-BR para a UI (sem "Vencedor" — ver NOTA A1). */
  resultLabel: string;
}

const RESULT_LABELS: Record<PredictionResult, string> = {
  exact: "Acertou Resultado",
  wrong: "Errou Resultado",
  pending: "Aguardando resultado",
};

/** Partida finalizada com ambos os placares oficiais presentes. */
function hasOfficialScore(
  match: Match,
): match is Match & { homeScore: number; awayScore: number } {
  return (
    match.status === "finished" &&
    match.homeScore !== null &&
    match.awayScore !== null
  );
}

/**
 * Deriva a entrada de histórico de um palpite combinando-o com a partida.
 * Pura e determinística — base testável da tela Histórico de Palpites.
 */
export function derivePredictionEntry(
  prediction: Pick<Prediction, "matchId" | "homeScore" | "awayScore">,
  match: Match,
): PredictionHistoryEntry {
  const predicted = { home: prediction.homeScore, away: prediction.awayScore };

  if (!hasOfficialScore(match)) {
    return {
      matchId: prediction.matchId,
      kickoffAt: match.kickoffAt,
      stage: match.stage,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      predicted,
      official: null,
      result: "pending",
      points: 0,
      resultLabel: RESULT_LABELS.pending,
    };
  }

  const official = { home: match.homeScore, away: match.awayScore };
  const isExact =
    predicted.home === official.home && predicted.away === official.away;
  const result: PredictionResult = isExact ? "exact" : "wrong";

  return {
    matchId: prediction.matchId,
    kickoffAt: match.kickoffAt,
    stage: match.stage,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    predicted,
    official,
    result,
    points: isExact ? 1 : 0,
    resultLabel: RESULT_LABELS[result],
  };
}

export type HistoryFilter = "all" | "hits" | "misses";

/**
 * Filtra entradas para as tabs Todos/Acertos/Erros (PRD06-03).
 * `pending` (sem resultado oficial) aparece só em "Todos".
 */
export function filterHistory<T extends PredictionHistoryEntry>(
  entries: readonly T[],
  filter: HistoryFilter,
): T[] {
  switch (filter) {
    case "hits":
      return entries.filter((e) => e.result === "exact");
    case "misses":
      return entries.filter((e) => e.result === "wrong");
    case "all":
    default:
      return [...entries];
  }
}
