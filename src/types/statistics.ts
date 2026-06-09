import type { z } from "zod";

import type {
  distributionBucketSchema,
  poolStatsSchema,
  positionHistoryEntrySchema,
  statisticsSchema,
} from "@/schemas/statistics";

export type PositionHistoryEntry = z.infer<typeof positionHistoryEntrySchema>;
export type Statistics = z.infer<typeof statisticsSchema>;
export type DistributionBucket = z.infer<typeof distributionBucketSchema>;
export type PoolStats = z.infer<typeof poolStatsSchema>;
