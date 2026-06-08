import type { z } from "zod";

import type {
  groupRankingSchema,
  rankingEntrySchema,
  rankingSchema,
} from "@/schemas/rankings";

export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type GroupRanking = z.infer<typeof groupRankingSchema>;
