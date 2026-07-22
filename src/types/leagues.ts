import type { z } from "zod";

import type {
  leagueStandingSchema,
  leagueStandingTeamSchema,
  leagueStandingsResponseSchema,
} from "@/schemas/leagues";

/**
 * Tipos derivados dos schemas de classificação de liga (TASK-20).
 *
 * Nota: `LeagueStanding`/`LeagueStandingTeam` do domínio puro
 * (`src/server/leagues/standings.ts`) são estruturalmente compatíveis com estes
 * (o schema é a fronteira de serialização; o domínio é a fonte de cálculo).
 */
export type LeagueStandingTeam = z.infer<typeof leagueStandingTeamSchema>;
export type LeagueStanding = z.infer<typeof leagueStandingSchema>;
export type LeagueStandingsResponse = z.infer<typeof leagueStandingsResponseSchema>;
