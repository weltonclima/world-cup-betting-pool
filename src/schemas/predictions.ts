import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  predictionStatusSchema,
  scoreSchema,
} from "@/schemas/shared";

// ---------------------------------------------------------------------------
// Schema completo do doc Firestore (coleção `predictions`).
// Os campos `status` e `points` são gravados EXCLUSIVAMENTE pelo servidor
// (Route Handler com Admin SDK). O cliente NUNCA os envia.
// ---------------------------------------------------------------------------
export const predictionSchema = z
  .object({
    uid: nonEmptyString,           // autor do palpite — referência users.uid
    matchId: nonEmptyString,       // partida alvo — API-Football fixture id
    homeScore: scoreSchema,        // placar previsto mandante (inteiro ≥ 0)
    awayScore: scoreSchema,        // placar previsto visitante (inteiro ≥ 0)
    createdAt: isoDateTime.optional(),
    updatedAt: isoDateTime.optional(),
    // Gravados somente pelo Route Handler de pontuação (Admin SDK):
    status: predictionStatusSchema.optional(),
    points: z.literal(0).or(z.literal(1)).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Schema de input do cliente — body do POST /api/predictions.
// `uid` é omitido (vem da sessão no servidor, não do body).
// `status` e `points` são omitidos (nunca aceitos do cliente).
// ---------------------------------------------------------------------------
export const predictionInputSchema = z.object({
  matchId: nonEmptyString,
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});
