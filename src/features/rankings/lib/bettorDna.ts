import type { ProfilePredictionItem } from "./profileTypes";

export interface BettorDna {
  tendency: "otimista" | "cauteloso";
  favoritePrediction: { homeScore: number; awayScore: number } | null;
  avgGoalsPerMatch: number;
}

export function deriveBettorDna(predictions: ProfilePredictionItem[]): BettorDna {
  if (predictions.length === 0) {
    return { tendency: "cauteloso", favoritePrediction: null, avgGoalsPerMatch: 0 };
  }

  const totalGoals = predictions.reduce(
    (sum, p) => sum + p.prediction.homeScore + p.prediction.awayScore,
    0,
  );
  const avgGoalsPerMatch = Math.round((totalGoals / predictions.length) * 100) / 100;
  const tendency = avgGoalsPerMatch > 2.5 ? "otimista" : "cauteloso";

  const counts = new Map<string, { homeScore: number; awayScore: number; count: number }>();
  for (const p of predictions) {
    const { homeScore, awayScore } = p.prediction;
    const key = `${homeScore}:${awayScore}`;
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { homeScore, awayScore, count: 1 });
    }
  }

  const sorted = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const sumDiff = b.homeScore + b.awayScore - (a.homeScore + a.awayScore);
    if (sumDiff !== 0) return sumDiff;
    return a.homeScore - b.homeScore;
  });

  const winner = sorted[0]!;
  return {
    tendency,
    favoritePrediction: { homeScore: winner.homeScore, awayScore: winner.awayScore },
    avgGoalsPerMatch,
  };
}
