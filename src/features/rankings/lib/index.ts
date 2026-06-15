// Barrel dos helpers puros de ranking.
export type { ProfilePredictionItem, ResolvedTeam } from "./profileTypes";
export {
  groupProfilePredictions,
  type PredictionPhaseBucket,
  type PredictionSubBucket,
} from "./profilePredictionsGrouping";
export { deriveBettorDna, type BettorDna } from "./bettorDna";
export {
  deriveProfileComparison,
  derivePredictionsCount,
  type ProfileComparison,
  type PredictionsCount,
} from "./profileComparison";
export {
  compareRanking,
  rankParticipants,
  type RankableParticipant,
  type RankedParticipant,
} from "./rankingSort";
export { computeAccuracy } from "./accuracy";
export {
  evolutionIndicator,
  type EvolutionDirection,
  type EvolutionResult,
} from "./evolution";
export { buildDistribution } from "./distribution";
export { paginate, type Page } from "./pagination";
export {
  geralHistory,
  toEvolutionPoints,
  bestPosition,
  roundsCount,
  averagePointsPerRound,
  type BestPosition,
} from "./myRankingDerivations";
