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
  .object({
    abbreviation: z.string(),
    // Campos de linkagem da chave (TASK-01). Opcionais — placeholders de slot
    // (`isActive:false`) trazem `displayName` codificando o slot
    // ("Round of 32 3 Winner"); times resolvidos trazem `isActive:true` + dados
    // reais. Derivação de slot/label fica para TASK-02 (aqui só validação).
    id: z.string().optional(),
    displayName: z.string().optional(),
    shortDisplayName: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

/** Endereço da venue ESPN — campos tolerantes (API não-oficial). */
export const espnAddressSchema = z
  .object({
    city: z.string().optional(),
    country: z.string().optional(),
  })
  .passthrough();

/** Venue da competition ESPN — local da partida. */
export const espnVenueSchema = z
  .object({
    id: z.string().optional(),
    fullName: z.string().optional(),
    address: espnAddressSchema.optional(),
  })
  .passthrough();

/** Season do evento ESPN — `slug` identifica o stage ("group-stage", "round-of-32"). */
export const espnSeasonSchema = z
  .object({
    year: z.number().optional(),
    type: z.number().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

export const espnCompetitorSchema = z
  .object({
    homeAway: z.enum(["home", "away"]),
    // ESPN entrega score como string ("1", "0") em pre/in/post → coerção.
    score: z.coerce.number().int().min(0),
    winner: z.boolean().optional(),
    // Campos de desempate/avanço (TASK-01). Opcionais — só presentes no mata-mata.
    // `advance`: quem avançou (autoritativo). `shootoutScore`: placar de pênaltis
    // (int já numérico na ESPN). INVARIANTE (TASK-02): jamais somado a `score`.
    advance: z.boolean().optional(),
    shootoutScore: z.number().int().min(0).optional(),
    team: espnTeamSchema,
  })
  .passthrough();

export const espnStatusTypeSchema = z
  .object({
    state: z.enum(["pre", "in", "post"]),
    detail: z.string(),
    // Status técnico (TASK-01). Opcional — ex.: "STATUS_FULL_TIME",
    // "STATUS_FINAL_PEN", "STATUS_OVERTIME". Só validado aqui; interpretação
    // PEN/OT → outcome fica para TASK-02.
    name: z.string().optional(),
  })
  .passthrough();

export const espnStatusSchema = z
  .object({ type: espnStatusTypeSchema })
  .passthrough();

export const espnCompetitionSchema = z
  .object({
    status: espnStatusSchema,
    competitors: z.array(espnCompetitorSchema).length(2),
    venue: espnVenueSchema.optional(),
    // Fonte do grupo: "FIFA World Cup, Group A" (mata-mata: "FIFA World Cup").
    altGameNote: z.string().optional(),
  })
  .passthrough();

export const espnEventSchema = z
  .object({
    // ID numérico do evento (ex.: "760415") — presente em todos os eventos.
    id: z.string(),
    uid: z.string().optional(),
    date: z.string(),
    season: espnSeasonSchema.optional(),
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
export type EspnTeam = z.infer<typeof espnTeamSchema>;
export type EspnSeason = z.infer<typeof espnSeasonSchema>;
export type EspnVenue = z.infer<typeof espnVenueSchema>;
export type EspnAddress = z.infer<typeof espnAddressSchema>;

/** Parsing seguro do scoreboard ESPN — nunca lança, retorna `SafeParseReturnType`. */
export function parseEspnScoreboard(raw: unknown) {
  return espnScoreboardSchema.safeParse(raw);
}
