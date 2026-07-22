import type { z } from "zod";

import type {
  championshipRankingSchema,
  groupRankingSchema,
  poolRankingResponseSchema,
  rankingEntrySchema,
  rankingSchema,
} from "@/schemas/rankings";

export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type GroupRanking = z.infer<typeof groupRankingSchema>;
// Doc de ranking por campeonato (multi-championship TASK-21).
export type ChampionshipRanking = z.infer<typeof championshipRankingSchema>;
// Resposta de /api/rankings/pool: Ranking + flag de exibição do pool (TASK-02).
export type PoolRanking = z.infer<typeof poolRankingResponseSchema>;
