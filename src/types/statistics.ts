import type { z } from "zod";

import type {
  positionHistoryEntrySchema,
  statisticsSchema,
} from "@/schemas/statistics";

export type PositionHistoryEntry = z.infer<typeof positionHistoryEntrySchema>;
export type Statistics = z.infer<typeof statisticsSchema>;
