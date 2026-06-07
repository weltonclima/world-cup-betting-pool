import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `bonus_predictions` (palpites bônus: campeão, artilheiro etc.).
// Modela só a escolha — o cálculo de pontuação do bônus não está definido no PRD (assumido).
export const bonusPredictionSchema = z
  .object({
    uid: nonEmptyString, // autor
    championTeamId: nonEmptyString.optional(), // palpite de campeão (seleção)
    topScorerName: nonEmptyString.optional(), // palpite de artilheiro (nome livre)
    createdAt: isoDateTime.optional(), // (assumido)
    updatedAt: isoDateTime.optional(), // (assumido)
  })
  .strict();
