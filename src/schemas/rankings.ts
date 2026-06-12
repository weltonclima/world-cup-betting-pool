import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  percentageSchema,
  rankingScopeSchema,
} from "@/schemas/shared";

// Entrada de ranking (objeto aninhado).
// Pontuação ponderada: `points` === total de PONTOS ponderados (5/10) no escopo,
// não a contagem de acertos exatos (esta é separada no recalc — TASK-03).
// Campos de exibição (name/wrong/accuracy) são OPCIONAIS para compat retroativa com docs
// já gravados no formato antigo {uid,nickname,position,points}; o recalc (TASK-03) passa
// a gravá-los sempre.
export const rankingEntrySchema = z
  .object({
    uid: nonEmptyString, // usuário
    nickname: nonEmptyString, // desnormalizado para exibição
    name: nonEmptyString.optional(), // nome completo desnormalizado (users.name)
    position: z.int().min(1), // posição
    points: z.int().min(0), // total de pontos ponderados (5/10) no escopo
    wrong: z.int().min(0).optional(), // palpites errados (partidas finalizadas) no escopo
    accuracy: percentageSchema.optional(), // aproveitamento 0–100
    // Foto de perfil (PRD-06, data URL base64). Aditivo/opcional — propagado pelo
    // recalc (TASK-05) sob orçamento de bytes por doc; omitido quando o orçamento
    // estoura (cai no fallback de iniciais na UI). Docs antigos sem o campo seguem válidos.
    avatarUrl: z.string().optional(),
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

// Ranking por grupo individual (A–L). Doc `rankings/group-{groupId}`.
// Reaproveita `rankingEntrySchema`; identificado por `groupId` (alinhado a match.groupId).
export const groupRankingSchema = z
  .object({
    groupId: nonEmptyString, // id do grupo (ex.: "A"…"L")
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking do grupo, ordenado
  })
  .strict();
