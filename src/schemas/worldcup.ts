import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// ─── Código FIFA ─────────────────────────────────────────────────────────────
// Reutiliza o mesmo padrão de src/schemas/teams.ts: exatamente 3 letras maiúsculas.
const fifaCode = z
  .string()
  .regex(
    /^[A-Z]{3}$/,
    "Código FIFA deve conter exatamente 3 letras maiúsculas (ex.: BRA)",
  );

// ─── Fase de grupos ──────────────────────────────────────────────────────────

/** Situação de classificação da seleção na fase de grupos. */
export const qualificationSchema = z.enum([
  "classificado",
  "possivel",
  "eliminado",
  "indefinido",
]);

/** Seleção dentro de uma tabela de grupo (sem groupId — o grupo é o agrupador externo). */
export const standingTeamSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    code: fifaCode,
    flagUrl: z.url().optional(),
  })
  .strict();

/** Linha de posição na tabela de um grupo. */
export const groupStandingSchema = z
  .object({
    position: z.int().min(1),
    team: standingTeamSchema,
    played: z.int().min(0),
    wins: z.int().min(0),
    draws: z.int().min(0),
    losses: z.int().min(0),
    goalsFor: z.int().min(0),
    goalsAgainst: z.int().min(0),
    goalDifference: z.int(), // pode ser negativo
    points: z.int().min(0),
    qualification: qualificationSchema,
  })
  .strict();

/** Tabela completa de um grupo (todas as seleções + posições). */
export const groupTableSchema = z
  .object({
    groupId: nonEmptyString,
    standings: z.array(groupStandingSchema),
  })
  .strict();

// ─── Venue (local) ───────────────────────────────────────────────────────────

/**
 * Estádio de uma partida de mata-mata.
 * Mesma shape de venueSchema em matches.ts — definida localmente para evitar
 * acoplamento entre módulos de schema.
 */
const knockoutVenueSchema = z
  .object({
    name: nonEmptyString,
    city: nonEmptyString,
  })
  .strict();

// ─── Mata-mata ───────────────────────────────────────────────────────────────

/**
 * Fase mata-mata. Slugs espelham o stageSchema em src/schemas/shared.ts
 * (exclui "grupos" — fase de grupos não é mata-mata).
 */
export const knockoutPhaseSchema = z.enum([
  "dezesseis-avos",
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro",
  "final",
]);

/** Status de uma partida de mata-mata. */
export const knockoutMatchStatusSchema = z.enum([
  "aguardando",    // time(s) ainda não definido(s) — placeholder
  "definido",      // ambas as seleções conhecidas, partida não iniciada
  "em-andamento",  // partida em andamento (ao vivo) — placar parcial presente
  "encerrado",     // partida finalizada com placar
]);

/**
 * Lado de uma partida de mata-mata (mandante ou visitante).
 * `defined: false` indica que `name` é um rótulo placeholder em pt-BR
 * (ex.: "Vencedor Jogo 74") — seleção ainda não apurada.
 */
export const knockoutSideSchema = z
  .object({
    name: nonEmptyString,
    code: fifaCode.optional(),
    flagUrl: z.url().optional(),
    defined: z.boolean(),
  })
  .strict();

/**
 * Partida de mata-mata com regras de consistência placar ↔ status ↔ lados.
 *
 * Regras:
 * 1. status "encerrado" ou "em-andamento" → ambos os placares presentes.
 * 2. status "aguardando" ou "definido" → ambos os placares ausentes.
 * 3. status "aguardando" → pelo menos um lado com defined:false.
 * 4. Qualquer lado com defined:false → status deve ser "aguardando".
 */
export const knockoutMatchSchema = z
  .object({
    id: nonEmptyString,
    phase: knockoutPhaseSchema,
    homeTeam: knockoutSideSchema,
    awayTeam: knockoutSideSchema,
    homeScore: z.int().min(0).optional(),
    awayScore: z.int().min(0).optional(),
    status: knockoutMatchStatusSchema,
    kickoffAt: z.string().optional(),
    venue: knockoutVenueSchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.status === "encerrado" || v.status === "em-andamento"
        ? v.homeScore !== undefined && v.awayScore !== undefined
        : true,
    {
      message:
        'Partida "encerrada" ou "em-andamento" deve ter ambos os placares preenchidos',
      path: ["homeScore"],
    },
  )
  .refine(
    (v) =>
      v.status === "aguardando" || v.status === "definido"
        ? v.homeScore === undefined && v.awayScore === undefined
        : true,
    {
      message:
        'Partida "aguardando" ou "definida" não deve ter placares preenchidos',
      path: ["homeScore"],
    },
  )
  .refine(
    (v) =>
      v.status === "aguardando"
        ? !v.homeTeam.defined || !v.awayTeam.defined
        : true,
    {
      message:
        'Status "aguardando" exige pelo menos um lado com defined:false (time ainda não definido)',
      path: ["status"],
    },
  )
  .refine(
    (v) =>
      !v.homeTeam.defined || !v.awayTeam.defined
        ? v.status === "aguardando"
        : true,
    {
      message:
        'Lado com defined:false só é permitido quando status é "aguardando"',
      path: ["homeTeam"],
    },
  );

// ─── Respostas dos endpoints ─────────────────────────────────────────────────

/** Resposta de /api/worldcup/groups */
export const groupsResponseSchema = z
  .object({
    groups: z.array(groupTableSchema),
    hasLiveGroupMatch: z.boolean(),
  })
  .strict();

/** Resposta de /api/worldcup/bracket */
export const bracketResponseSchema = z
  .object({
    roundOf32: z.array(knockoutMatchSchema),
    roundOf16: z.array(knockoutMatchSchema),
    quarterFinals: z.array(knockoutMatchSchema),
    semiFinals: z.array(knockoutMatchSchema),
    thirdPlace: z.array(knockoutMatchSchema),
    final: z.array(knockoutMatchSchema),
  })
  .strict();
