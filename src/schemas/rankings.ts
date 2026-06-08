import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  percentageSchema,
  rankingScopeSchema,
} from "@/schemas/shared";

// Entrada de ranking (objeto aninhado).
// Pontuação binária: `points` === acertos exatos no escopo (não há campo `correct` separado).
// Campos de exibição (name/wrong/accuracy) são OPCIONAIS para compat retroativa com docs
// já gravados no formato antigo {uid,nickname,position,points}; o recalc (TASK-03) passa
// a gravá-los sempre.
export const rankingEntrySchema = z
  .object({
    uid: nonEmptyString, // usuário
    nickname: nonEmptyString, // desnormalizado para exibição
    name: nonEmptyString.optional(), // nome completo desnormalizado (users.name)
    position: z.int().min(1), // posição
    points: z.int().min(0), // total de acertos exatos no escopo (binário) === acertos
    wrong: z.int().min(0).optional(), // palpites errados (partidas finalizadas) no escopo
    accuracy: percentageSchema.optional(), // aproveitamento 0–100
  })
  .strict();

// Coleção `rankings`: documento por escopo contendo as entradas ordenadas.
export const rankingSchema = z
  .object({
    scope: rankingScopeSchema, // "geral" ou uma das 5 fases
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking ordenado
  })
  .strict();

// Ranking por grupo individual (A–L). Doc `rankings/grupo-{groupId}`.
// Reaproveita `rankingEntrySchema`; identificado por `groupId` (alinhado a match.groupId).
export const groupRankingSchema = z
  .object({
    groupId: nonEmptyString, // id do grupo (ex.: "A"…"L")
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking do grupo, ordenado
  })
  .strict();
