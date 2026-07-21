import type { z } from "zod";

import type {
  championshipSchema,
  championshipStatusSchema,
  championshipTypeSchema,
} from "@/schemas/championships";

export type ChampionshipType = z.infer<typeof championshipTypeSchema>;
export type ChampionshipStatus = z.infer<typeof championshipStatusSchema>;
export type Championship = z.infer<typeof championshipSchema>;
