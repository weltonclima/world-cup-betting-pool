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

// Tela Seleção de Grupo (TASK-08).
export { GroupSelectionGrid, buildGroupSummaries } from "./GroupSelectionGrid";
export type {
  GroupSelectionGridProps,
  GroupSummary,
} from "./GroupSelectionGrid";

// Tela Palpite em Massa do Grupo (TASK-09).
export { GroupMatchRow } from "./GroupMatchRow";
export type { GroupMatchRowProps } from "./GroupMatchRow";
export { GroupQuickFill, buildSaveFeedback } from "./GroupQuickFill";
export type {
  GroupQuickFillProps,
  SaveFeedback,
  SaveFeedbackTone,
} from "./GroupQuickFill";

// Tela Classificação Prevista (TASK-10).
export { PredictedStandings, deriveQualification } from "./PredictedStandings";
export type {
  PredictedStandingsProps,
  Qualification,
} from "./PredictedStandings";

// Tela Resumo dos 12 Grupos (TASK-11).
export { GroupsSummary } from "./GroupsSummary";
export type { GroupsSummaryProps } from "./GroupsSummary";
export {
  buildGroupsSummary,
  normalizeGroupId,
} from "./groupsSummaryData";
export type {
  GroupsSummaryData,
  GroupSummaryItem,
  GroupSummaryTeam,
} from "./groupsSummaryData";

// Tela Ranking dos Melhores Terceiros (TASK-12).
export { BestThirdsRanking, buildThirdsRanking } from "./BestThirdsRanking";
export type {
  BestThirdsRankingProps,
  ThirdRankingEntry,
  ThirdsRankingResult,
} from "./BestThirdsRanking";

// Componente de Chave Interativa (TASK-13).
export { BracketMatchup } from "./BracketMatchup";
export type { BracketMatchupProps } from "./BracketMatchup";
export { Bracket } from "./Bracket";
export type { BracketProps, BracketScores } from "./Bracket";
