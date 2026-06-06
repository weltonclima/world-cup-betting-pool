import type { z } from "zod";

import type {
  rankingEntrySchema,
  rankingSchema,
} from "@/schemas/rankings";

export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type Ranking = z.infer<typeof rankingSchema>;
