// Barrel de hooks da feature predictions (TASK-06 + TASK-08 + TASK-05).
export { predictionsKeys } from "./predictionsKeys";
export { usePredictions } from "./usePredictions";
export { useUpsertPrediction } from "./useUpsertPrediction";
export { usePredictionsList } from "./usePredictionsList";
export type { PredictionListItem, PredictionsListData } from "./usePredictionsList";
// TASK-05
export { useUpsertPredictionsBatch } from "./useUpsertPredictionsBatch";
export { usePredictionDraft } from "./usePredictionDraft";
export type { PredictionDraftAPI } from "./usePredictionDraft";
export { useGroupPredictions } from "./useGroupPredictions";
export type { GroupPredictionItem, GroupPredictionsData } from "./useGroupPredictions";
