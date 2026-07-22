/**
 * Feature `championships` (multi-championship TASK-09): estado do campeonato ATIVO
 * compartilhado pelo app + seletor visual. Fonte da verdade = `?championship=` na URL.
 */

export { ActiveChampionshipProvider } from "./ActiveChampionshipProvider";
export {
  useActiveChampionship,
  ActiveChampionshipContext,
  type ActiveChampionshipContextValue,
} from "./useActiveChampionship";
export {
  useActiveChampionshipType,
  useIsCupActive,
} from "./useActiveChampionshipType";
export { usePoolChampionships } from "./usePoolChampionships";
export { ChampionshipSelector } from "./components/ChampionshipSelector";
export { CupOnlyNotice, type CupOnlyNoticeProps } from "./components/CupOnlyNotice";
export {
  SeasonEndedNotice,
  type SeasonEndedNoticeProps,
} from "./components/SeasonEndedNotice";
