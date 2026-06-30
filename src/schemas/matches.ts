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

// Slot da chave (TASK-02). Identifica o jogo-fonte de um lado placeholder do
// mata-mata, derivado do `displayName` ESPN ("Round of 32 3 Winner"). `round`
// é o slug ESPN da fase-fonte; `game` é o número do jogo-fonte (≥ 1).
const bracketSlotSchema = z
  .object({
    round: nonEmptyString,
    game: z.int().min(1),
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
    // Todos OPCIONAIS: a fonte ESPN não os emite, então o parse de um match
    // vindo da base ESPN (sem estes campos) continua válido. Eles só aparecem
    // em docs persistidos na coleção `matches` (edição manual).
    editedBy: nonEmptyString.nullable().optional(),  // uid do super_admin que editou; null até a 1ª edição
    editedAt: isoDateTime.nullable().optional(),     // carimbo da última edição manual; null até a 1ª edição
    isManualOverride: z.boolean().optional(),        // true = blindado do sync (default false na leitura)
    syncedAt: isoDateTime.optional(),                // último carimbo de sincronização (auditoria)
    // NET-NEW TASK-02 (espn-fonte-unica-bracket) — linkagem da chave + desempate.
    // Todos OPCIONAIS: matches de grupo e do openfootball não os emitem. Slot/label
    // são POR-LADO porque um jogo de mata-mata pode ter ambos os lados ainda
    // indefinidos (dois placeholders). `bracketSlot` carrega o jogo-fonte do slot;
    // `placeholderLabel` é o rótulo pt-BR exibível. Presentes só no lado placeholder.
    homeBracketSlot: bracketSlotSchema.optional(),
    awayBracketSlot: bracketSlotSchema.optional(),
    homePlaceholderLabel: nonEmptyString.optional(),
    awayPlaceholderLabel: nonEmptyString.optional(),
    // Pênaltis (shootout) — placar da disputa, SEPARADO do tempo normal.
    // INVARIANTE: jamais somado a homeScore/awayScore. null = não houve desempate.
    homeShootout: z.int().min(0).nullable().optional(),
    awayShootout: z.int().min(0).nullable().optional(),
    // Quem avançou (autoritativo ESPN); null quando não finalizado/sem advance.
    advanceSide: z.enum(["home", "away"]).nullable().optional(),
    // Como o jogo foi decidido. Só em mata-mata encerrado; ausente em grupo.
    outcome: z.enum(["normal", "overtime", "penalties"]).optional(),
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
  )
  .refine(
    (match) => {
      // INVARIANTE de pênaltis: outcome "penalties" ⇔ ambos shootouts numéricos.
      // Fora de "penalties", shootouts devem estar ausentes/null.
      const ambosShootout =
        typeof match.homeShootout === "number" &&
        typeof match.awayShootout === "number";
      const nenhumShootout =
        (match.homeShootout === null || match.homeShootout === undefined) &&
        (match.awayShootout === null || match.awayShootout === undefined);

      if (match.outcome === "penalties") {
        return ambosShootout;
      }
      return nenhumShootout;
    },
    {
      message:
        "Pênaltis: 'penalties' exige homeShootout e awayShootout numéricos; demais outcomes não devem ter shootout.",
      path: ["homeShootout"],
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
