import type { z } from "zod";

import type {
  poolInputSchema,
  poolSchema,
  poolStatusSchema,
} from "@/schemas/pools";

export type PoolStatus = z.infer<typeof poolStatusSchema>;
export type Pool = z.infer<typeof poolSchema>;
export type PoolInput = z.infer<typeof poolInputSchema>;
