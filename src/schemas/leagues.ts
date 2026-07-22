import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

/**
 * Schemas da classificação de liga de pontos corridos (TASK-20,
 * multi-championship-launch).
 *
 * Espelha `groupStandingSchema` (worldcup) sem os campos Copa-específicos:
 *  - team: `{ id, name, crestUrl? }` (sem `code`/`flagUrl` de seleção);
 *  - sem `qualification` (liga tem só posição numérica).
 *
 * Todos `.strict()` — rejeitam chave extra (defesa em profundidade client+server).
 */

/** Time de uma linha da tabela — display resolvido dos competidores ESPN. */
export const leagueStandingTeamSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    crestUrl: z.url().optional(),
  })
  .strict();

/** Uma linha da tabela de classificação. */
export const leagueStandingSchema = z
  .object({
    position: z.int().min(1),
    team: leagueStandingTeamSchema,
    played: z.int().min(0),
    wins: z.int().min(0),
    draws: z.int().min(0),
    losses: z.int().min(0),
    goalsFor: z.int().min(0),
    goalsAgainst: z.int().min(0),
    goalDifference: z.int(), // pode ser negativo
    points: z.int().min(0),
  })
  .strict();

/** Resposta da rota `GET /api/leagues/standings`. */
export const leagueStandingsResponseSchema = z
  .object({
    table: z.array(leagueStandingSchema),
    hasLiveMatch: z.boolean(),
  })
  .strict();
