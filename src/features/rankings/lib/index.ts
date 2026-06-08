// Barrel dos helpers puros de ranking (TASK-02).
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
