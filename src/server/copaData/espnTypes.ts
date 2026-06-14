/**
 * Schema Zod do scoreboard ESPN (API pública não-oficial `site.api.espn.com`).
 *
 * Cobre APENAS os campos consumidos pelo pipeline de placar ao vivo
 * (client TASK-03, mapper TASK-04, matcher TASK-05). Tolerante a campos extras
 * (`.passthrough()`) — a API não-oficial pode adicionar campos sem aviso.
 *
 * Achados empíricos (spike TASK-00, 2026-06-14):
 * - `competitors[].score` é SEMPRE string (`"1"`, `"0"`) → coerção numérica.
 * - `status.type.state` é enum fechado `pre`/`in`/`post`.
 * - `status.type.detail` é texto livre/localizado (display-only) — não interpretar.
 * - `event.date` é ISO 8601 com `Z` sem segundos (`"2026-06-14T04:00Z"`).
 *
 * NÃO importa `server-only`: módulo de schema puro, usado em testes vitest
 * (fora de RSC) e nas tasks server-side seguintes.
 */

import { z } from "zod";

export const espnTeamSchema = z
  .object({ abbreviation: z.string() })
  .passthrough();

export const espnCompetitorSchema = z
  .object({
    homeAway: z.enum(["home", "away"]),
    // ESPN entrega score como string ("1", "0") em pre/in/post → coerção.
    score: z.coerce.number().int().min(0),
    winner: z.boolean().optional(),
    team: espnTeamSchema,
  })
  .passthrough();

export const espnStatusTypeSchema = z
  .object({
    state: z.enum(["pre", "in", "post"]),
    detail: z.string(),
  })
  .passthrough();

export const espnStatusSchema = z
  .object({ type: espnStatusTypeSchema })
  .passthrough();

export const espnCompetitionSchema = z
  .object({
    status: espnStatusSchema,
    competitors: z.array(espnCompetitorSchema).length(2),
  })
  .passthrough();

export const espnEventSchema = z
  .object({
    date: z.string(),
    competitions: z.array(espnCompetitionSchema).min(1),
  })
  .passthrough();

export const espnScoreboardSchema = z
  .object({ events: z.array(espnEventSchema) })
  .passthrough();

export type EspnScoreboard = z.infer<typeof espnScoreboardSchema>;
export type EspnEvent = z.infer<typeof espnEventSchema>;
export type EspnCompetition = z.infer<typeof espnCompetitionSchema>;
export type EspnCompetitor = z.infer<typeof espnCompetitorSchema>;

/** Parsing seguro do scoreboard ESPN — nunca lança, retorna `SafeParseReturnType`. */
export function parseEspnScoreboard(raw: unknown) {
  return espnScoreboardSchema.safeParse(raw);
}
