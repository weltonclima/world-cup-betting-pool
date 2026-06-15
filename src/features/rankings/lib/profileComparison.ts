import type { MatchWithId } from "@/types/matches";
import type { RankingEntry } from "@/types/rankings";
import type { PredictionDisplayStatus } from "@/features/predictions/lib";

import type { ProfilePredictionItem } from "./profileTypes";

export interface ProfileComparison {
  pointsDiff: number;
  positionDiff: number;
  otherCorrectMyWrong: number;
}

export interface PredictionsCount {
  made: number;
  ofTotal: number;
}

const OTHER_CORRECT_STATUSES = new Set<PredictionDisplayStatus>([
  "acertou",
  "acertou_vencedor",
  "acertou_empate",
]);

export function deriveProfileComparison(
  myEntry: RankingEntry,
  otherEntry: RankingEntry,
  myFinishedPredictions: ProfilePredictionItem[],
  otherFinishedPredictions: ProfilePredictionItem[],
): ProfileComparison {
  const myByMatchId = new Map(myFinishedPredictions.map((p) => [p.matchId, p]));

  let otherCorrectMyWrong = 0;
  for (const otherPred of otherFinishedPredictions) {
    const myPred = myByMatchId.get(otherPred.matchId);
    if (!myPred) continue;
    if (OTHER_CORRECT_STATUSES.has(otherPred.displayStatus) && myPred.displayStatus === "errou") {
      otherCorrectMyWrong++;
    }
  }

  return {
    pointsDiff: otherEntry.points - myEntry.points,
    positionDiff: myEntry.position - otherEntry.position,
    otherCorrectMyWrong,
  };
}

export function derivePredictionsCount(
  predictions: ProfilePredictionItem[],
  matches: MatchWithId[],
  now: Date,
): PredictionsCount {
  const ofTotal = matches.filter((m) => new Date(m.kickoffAt) <= now).length;
  return { made: predictions.length, ofTotal };
}
