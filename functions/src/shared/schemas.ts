/**
 * Schemas Zod espelhados de src/schemas/ (Abordagem A — D11).
 *
 * Este arquivo reexporta apenas os schemas usados pelos mappers das Functions.
 * IMPORTANTE: manter em sincronia com src/schemas/teams.ts e src/schemas/matches.ts.
 * Migração para monorepo (packages/schemas/) é refinamento futuro — ver spec D11.
 */

import { z } from "zod";

// ─── Primitivos compartilhados (espelho de src/schemas/shared.ts) ──────────────

export const nonEmptyString = z.string().min(1);
export const scoreSchema = z.number().int().min(0); // placar inteiro ≥ 0

export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);

export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
  "canceled",
]);

export const isoDateTime = z.string().datetime(); // data/hora em ISO 8601

// ─── Schema da coleção `teams` (espelho de src/schemas/teams.ts) ──────────────

export const teamSchema = z
  .object({
    name: nonEmptyString,
    code: z.string().length(3),
    flagUrl: z.string().url().optional(),
    groupId: nonEmptyString.optional(),
  })
  .strict();

// ─── Schema da coleção `matches` (espelho de src/schemas/matches.ts) ─────────

export const matchSchema = z
  .object({
    homeTeamId: nonEmptyString,
    awayTeamId: nonEmptyString,
    kickoffAt: isoDateTime,
    stage: stageSchema,
    groupId: nonEmptyString.nullable().optional(),
    status: matchStatusSchema,
    homeScore: scoreSchema.nullable(),
    awayScore: scoreSchema.nullable(),
  })
  .strict()
  .refine(
    (match) => {
      const finished = match.status === "finished";
      const ambosNumeros =
        match.homeScore !== null && match.awayScore !== null;
      const ambosNulos =
        match.homeScore === null && match.awayScore === null;
      // Finalizada → ambos preenchidos; caso contrário → ambos null.
      return finished ? ambosNumeros : ambosNulos;
    },
    {
      message:
        "Placares devem ser inteiros ≥ 0 quando a partida está finalizada e null caso contrário.",
      path: ["homeScore"],
    },
  );

export type TeamSchema = z.infer<typeof teamSchema>;
export type MatchSchema = z.infer<typeof matchSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
