import { z } from "zod";

import {
  isoDateTime,
  matchStatusSchema,
  nonEmptyString,
  scoreSchema,
  stageSchema,
} from "@/schemas/shared";

// Estádio do jogo (origem: fixture.venue da API-Football).
// Nullable/optional: pode ser TBD em jogos ainda não confirmados.
const venueSchema = z
  .object({
    name: nonEmptyString, // nome do estádio
    city: nonEmptyString, // cidade
  })
  .strict();

// Coleção `matches` (partidas).
// Refinement (assumido): placares são `null` enquanto a partida não está finalizada;
// quando `status === "finished"`, ambos os placares devem ser inteiros ≥ 0.
export const matchSchema = z
  .object({
    homeTeamId: nonEmptyString,                      // seleção mandante
    awayTeamId: nonEmptyString,                      // seleção visitante
    kickoffAt: isoDateTime,                          // data/hora do jogo
    stage: stageSchema,                              // fase do torneio
    round: z.int().min(1).nullable().optional(),     // número da rodada (ex.: 2 em "Group Stage - 2"); null em fases únicas
    groupId: nonEmptyString.nullable().optional(),   // (assumido) só na fase de grupos
    venue: venueSchema.nullable().optional(),        // estádio; null/ausente quando TBD
    status: matchStatusSchema,                       // situação
    homeScore: scoreSchema.nullable(),               // (assumido) null enquanto não finalizado
    awayScore: scoreSchema.nullable(),               // (assumido) null enquanto não finalizado
    // NET-NEW PRD-11 (TASK-01) — campos de edição manual + persistência.
    // Todos OPCIONAIS: `mapOpenFootballMatch` não os emite, então o parse de um
    // match vindo do openfootball (sem estes campos) continua válido. Eles só
    // aparecem em docs persistidos na coleção `matches` (sync/edição manual).
    editedBy: nonEmptyString.nullable().optional(),  // uid do super_admin que editou; null até a 1ª edição
    editedAt: isoDateTime.nullable().optional(),     // carimbo da última edição manual; null até a 1ª edição
    isManualOverride: z.boolean().optional(),        // true = blindado do sync (default false na leitura)
    syncedAt: isoDateTime.optional(),                // último carimbo de sincronização (auditoria)
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

/**
 * Helper de proteção de override (PRD-11 TASK-01). Um match é "protegido" do sync
 * quando tem `isManualOverride === true` — o sync OpenFootball NUNCA deve
 * sobrescrever placar/status/venue/kickoff de um match protegido. Total e puro:
 * `isManualOverride` ausente/false → não protegido (default seguro: o sync escreve).
 */
export function isMatchProtected(match: {
  isManualOverride?: boolean | undefined;
}): boolean {
  return match.isManualOverride === true;
}
