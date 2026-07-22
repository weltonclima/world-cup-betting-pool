import type { z } from "zod";

import type {
  championshipPublicSchema,
  championshipSchema,
  championshipStateSchema,
  championshipStatusSchema,
  championshipTypeSchema,
} from "@/schemas/championships";

export type ChampionshipType = z.infer<typeof championshipTypeSchema>;
export type ChampionshipStatus = z.infer<typeof championshipStatusSchema>;
export type Championship = z.infer<typeof championshipSchema>;
/** State override de runtime (`championships/{id}`) — multi-championship TASK-13. */
export type ChampionshipState = z.infer<typeof championshipStateSchema>;
/** Forma pública do catálogo (TASK-06/08): sem campos internos de fetch/compat. */
export type ChampionshipPublic = z.infer<typeof championshipPublicSchema>;
