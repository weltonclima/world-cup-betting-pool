import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  rankingScopeSchema,
} from "@/schemas/shared";

// Entrada de ranking (objeto aninhado).
export const rankingEntrySchema = z
  .object({
    uid: nonEmptyString, // usuário
    nickname: nonEmptyString, // (assumido) desnormalizado para exibição
    position: z.int().min(1), // posição (assumido)
    points: z.int().min(0), // total de acertos no escopo (binário)
  })
  .strict();

// Coleção `rankings`: documento por escopo contendo as entradas ordenadas (assumido).
export const rankingSchema = z
  .object({
    scope: rankingScopeSchema, // "geral" ou uma das 5 fases
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking ordenado
  })
  .strict();
