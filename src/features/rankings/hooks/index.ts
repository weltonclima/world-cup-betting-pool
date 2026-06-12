// Barrel dos hooks de ranking (TASK-05).
export { rankingKeys } from "./rankingKeys";
export { useRanking } from "./useRanking";
export { usePoolRanking } from "./usePoolRanking";
export { useGroupRanking } from "./useGroupRanking";
export { useMyRanking } from "./useMyRanking";
export { useParticipantProfile } from "./useParticipantProfile";
export { usePoolStats } from "./usePoolStats";
// Reusa o hook (e a query-key) da Home para o ranking geral — sem cache duplicado.
export { useGeneralRanking } from "@/features/home/hooks/useGeneralRanking";
