import { z } from "zod";

import {
  isoDateTime,
  percentageSchema,
  rankingScopeSchema,
  nonEmptyString,
  stageSchema,
} from "@/schemas/shared";

// Entrada de histórico de posições (objeto aninhado).
// `round` é OPCIONAL (compat retroativa): rótulo da execução de recalc que gerou o snapshot,
// usado nas Telas 02/04 ("R1", "Rodada 5"). Copa não tem rodadas lineares → round = nº da jornada de recalc.
export const positionHistoryEntrySchema = z
  .object({
    at: isoDateTime, // momento do snapshot
    scope: rankingScopeSchema, // qual ranking
    position: z.int().min(1), // posição registrada
    round: z.int().min(1).optional(), // nº/rótulo da execução de recalc
  })
  .strict();

// Coleção `statistics` (`statistics/{uid}`). Estatísticas agregadas por usuário.
export const statisticsSchema = z
  .object({
    uid: nonEmptyString, // dono das estatísticas
    totalCorrect: z.int().min(0), // total de acertos
    totalWrong: z.int().min(0).optional(), // total de palpites errados (partidas finalizadas) — Telas 02/05
    accuracy: percentageSchema, // aproveitamento (%) 0–100 — fonte única de verdade em shared.ts
    longestStreak: z.int().min(0), // maior sequência de acertos
    // acertos por fase; chaves restritas às 6 fases (stageSchema), podendo vir parcial
    correctByStage: z.partialRecord(stageSchema, z.int().min(0)),
    positionHistory: z.array(positionHistoryEntrySchema), // histórico de posições
  })
  .strict();

// Faixa de distribuição de pontuação (Tela 06 — Estatísticas Gerais).
export const distributionBucketSchema = z
  .object({
    label: nonEmptyString, // ex.: "90-100 pts"
    min: z.int().min(0), // limite inferior (inclusive)
    max: z.int().min(0), // limite superior (inclusive)
    count: z.int().min(0), // participantes na faixa
  })
  .strict()
  // TASK-14 (carry-forward WR-01 da TASK-01): faixa coerente (dados server-generated).
  .refine((b) => b.min <= b.max, {
    message: "min deve ser <= max",
    path: ["min"],
  });

// Estatísticas agregadas do bolão (doc único — path definido na TASK-03).
export const poolStatsSchema = z
  .object({
    updatedAt: isoDateTime, // quando foi recalculado
    totalParticipants: z.int().min(0), // só usuários aprovados
    highestPoints: z.int().min(0), // maior pontuação
    highestPointsName: nonEmptyString.optional(), // nome do líder (Tela 06)
    lowestPoints: z.int().min(0), // menor pontuação
    averagePoints: z.number().min(0), // média geral (pode ser fracionária)
    totalCorrect: z.int().min(0), // total de placares exatos do bolão
    distribution: z.array(distributionBucketSchema), // faixas de pontuação
  })
  .strict()
  // TASK-14 (carry-forward WR-02 da TASK-01): menor <= maior (dados server-generated).
  .refine((p) => p.lowestPoints <= p.highestPoints, {
    message: "lowestPoints deve ser <= highestPoints",
    path: ["lowestPoints"],
  });
