// Barrel de componentes da feature predictions (TASK-07 + TASK-08).
export { PredictionForm } from "./PredictionForm";
export { PredictionLockedState } from "./PredictionLockedState";
export { PredictionSuccess } from "./PredictionSuccess";
export { ScoreInput } from "./ScoreInput";
export { PredictionListCard } from "./PredictionListCard";
export { PredictionFilters, readStoredFilter } from "./PredictionFilters";
export type { FilterChip, PredictionFiltersProps } from "./PredictionFilters";
export { PredictionList } from "./PredictionList";

// Primitivas do fluxo de palpites em massa (TASK-06).
export { CompactScoreInput } from "./CompactScoreInput";
export type { CompactScoreInputProps } from "./CompactScoreInput";
export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps } from "./ProgressBar";
export { PhaseCard } from "./PhaseCard";
export type { PhaseCardProps, FillStatus, PhaseStatus } from "./PhaseCard";
export { GroupCard } from "./GroupCard";
export type { GroupCardProps } from "./GroupCard";

// Tela Hub de Palpites (TASK-07).
export { PredictionsHub, buildHubPhases } from "./PredictionsHub";
export type {
  PredictionsHubProps,
  PhaseHubItem,
  HubPhaseInput,
} from "./PredictionsHub";
