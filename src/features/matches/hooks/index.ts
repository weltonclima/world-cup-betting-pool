// Barrel de hooks da feature matches.
// Baixo nível (integracao-api-football, TASK-06)
export { matchesKeys } from "./matchesKeys";
export { useMatches } from "./useMatches";
export { useMatch } from "./useMatch";
export { useTeams } from "./useTeams";
// Compositor de view-model (TASK-02)
export { usePredictions } from "./usePredictions";
export { useMatchesList } from "./useMatchesList";
export type { MatchListItem, MatchListItemDaySection, MatchesListData } from "./useMatchesList";
export { useMatchDetail } from "./useMatchDetail";
export type { MatchDetailItem, MatchDetailData } from "./useMatchDetail";
// Agrupadores derivados (TASK-05)
export { useGroupMatches } from "./useGroupMatches";
export { usePhaseMatches } from "./usePhaseMatches";
