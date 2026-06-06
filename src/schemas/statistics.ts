import { z } from "zod";

import {
  isoDateTime,
  percentageSchema,
  rankingScopeSchema,
  nonEmptyString,
  stageSchema,
} from "@/schemas/shared";

// Entrada de histórico de posições (objeto aninhado).
export const positionHistoryEntrySchema = z
  .object({
    at: isoDateTime, // (assumido) momento do snapshot
    scope: rankingScopeSchema, // (assumido) qual ranking
    position: z.int().min(1), // posição registrada
  })
  .strict();

// Coleção `statistics` (`statistics/{uid}`). Estatísticas agregadas por usuário.
export const statisticsSchema = z
  .object({
    uid: nonEmptyString, // dono das estatísticas
    totalCorrect: z.int().min(0), // total de acertos
    accuracy: percentageSchema, // aproveitamento (%) 0–100 — fonte única de verdade em shared.ts
    longestStreak: z.int().min(0), // maior sequência de acertos
    // acertos por fase; chaves restritas às 5 fases, podendo vir parcial
    correctByStage: z.partialRecord(stageSchema, z.int().min(0)),
    positionHistory: z.array(positionHistoryEntrySchema), // histórico de posições
  })
  .strict();
