import { z } from "zod";

import {
  isoDateTime,
  matchStatusSchema,
  nonEmptyString,
  scoreSchema,
  stageSchema,
} from "@/schemas/shared";

// Coleção `matches` (partidas).
// Refinement (assumido): placares são `null` enquanto a partida não está finalizada;
// quando `status === "finished"`, ambos os placares devem ser inteiros ≥ 0.
export const matchSchema = z
  .object({
    homeTeamId: nonEmptyString, // seleção mandante
    awayTeamId: nonEmptyString, // seleção visitante
    kickoffAt: isoDateTime, // data/hora do jogo
    stage: stageSchema, // fase do torneio
    groupId: nonEmptyString.nullable().optional(), // (assumido) só na fase de grupos
    status: matchStatusSchema, // situação
    homeScore: scoreSchema.nullable(), // (assumido) null enquanto não finalizado
    awayScore: scoreSchema.nullable(), // (assumido) null enquanto não finalizado
  })
  .strict()
  .refine(
    (match) => {
      const { status, homeScore, awayScore } = match;
      const ambosNumeros = homeScore !== null && awayScore !== null;
      const ambosNulos = homeScore === null && awayScore === null;

      if (status === "finished") {
        // Finalizada → ambos os placares devem estar presentes.
        return ambosNumeros;
      }
      if (status === "live") {
        // Em andamento → placares parciais permitidos (ambos presentes) ou ainda null (início do tempo).
        // Placar assimétrico (um null, outro não) nunca é válido.
        return ambosNumeros || ambosNulos;
      }
      // scheduled, postponed, canceled → nenhum placar (ambos null).
      return ambosNulos;
    },
    {
      message:
        "Placares: obrigatórios quando 'finished'; permitidos (ambos) ou null quando 'live'; null obrigatório para 'scheduled', 'postponed' e 'canceled'.",
      path: ["homeScore"],
    },
  );
