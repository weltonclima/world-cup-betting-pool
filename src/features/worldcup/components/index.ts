/**
 * Barrel de componentes da feature worldcup (TASK-06+).
 *
 * Reexporta componentes visuais para consumo externo (layouts, páginas).
 */
export { CompetitionTabs } from "./CompetitionTabs";

// TASK-07: tela Grupos + estados compartilhados (reutilizados pela TASK-08)
export { GroupsView } from "./GroupsView";
export { GroupSelector } from "./GroupSelector";
export { GroupStandingsTable } from "./GroupStandingsTable";
export { QualificationBadge } from "./QualificationBadge";
export { StandingsLegend } from "./StandingsLegend";
export { WorldcupSkeleton } from "./WorldcupSkeleton";
export { WorldcupEmptyState } from "./WorldcupEmptyState";
export { WorldcupErrorState } from "./WorldcupErrorState";
