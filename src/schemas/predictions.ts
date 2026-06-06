import { z } from "zod";

import { isoDateTime, nonEmptyString, scoreSchema } from "@/schemas/shared";

// Coleção `predictions` (palpites). Guarda só a previsão; a pontuação é calculada em outra camada.
// Unicidade (uid, matchId) é regra de id do doc / Security Rules (TASK-08), não validada aqui.
export const predictionSchema = z
  .object({
    uid: nonEmptyString, // autor do palpite (referência users.uid)
    matchId: nonEmptyString, // partida alvo
    homeScore: scoreSchema, // placar previsto mandante (inteiro ≥ 0)
    awayScore: scoreSchema, // placar previsto visitante (inteiro ≥ 0)
    createdAt: isoDateTime.optional(), // (assumido)
    updatedAt: isoDateTime.optional(), // (assumido)
  })
  .strict();
