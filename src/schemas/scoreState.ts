import { z } from "zod";

import { isoDateTime } from "@/schemas/shared";

// Coleção `score_state` (doc único `score_state/cron`) — scoring-write-cost (TASK-02).
// Estado "o que já foi pontuado" do cron de pontuação: mapa { matchId: resultHash },
// onde resultHash = fingerprint de { status, homeScore, awayScore } da partida
// (gerado pelos helpers puros da TASK-01). Lido 1× no início do run e gravado 1×
// no fim (só se mudou) pelo Admin SDK — sustenta o filtro grosso (B): partida com
// hash inalterado é pulada inteira (sem query de palpites, sem write).
//
// Escrita EXCLUSIVA do Admin SDK (rules `if false`). Doc nasce vazio: a 1ª run da
// TASK-03 popula. Limite de 1MB/doc é trivial (~104 partidas × hash curto).
export const scoreStateSchema = z
  .object({
    // chave = matchId (não-vazio); valor = resultHash (fingerprint do resultado).
    matches: z.record(z.string().min(1), z.string()),
    updatedAt: isoDateTime, // carimbo da última escrita (ISO 8601)
  })
  .strict();

export type ScoreState = z.infer<typeof scoreStateSchema>;
