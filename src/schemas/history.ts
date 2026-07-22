import { z } from "zod";

import { isoDateTime, nonEmptyString, percentageSchema } from "@/schemas/shared";
import { rankingEntrySchema } from "@/schemas/rankings";
import { championshipPublicSchema, championshipTypeSchema } from "@/schemas/championships";

// Snapshot congelado de arquivamento (multi-championship-launch TASK-13). Docs da
// coleção `history/*`, gravados SÓ pelo Admin SDK no pipeline de arquivamento e
// IMUNES a recalc/pesos futuros (o recalc ao vivo continua tocando só `rankings/*`).
// Um doc por bolão que habilita o campeonato + um global do campeonato.

// Recorte por participante de `statistics/{uid}` congelado no snapshot por-bolão.
// Só os agregados finais (sem `positionHistory` — timeline não entra no recorte,
// spec §14 default). `.strict()`.
export const historyParticipantStatSchema = z
  .object({
    uid: nonEmptyString,
    totalCorrect: z.int().min(0), // placares exatos (10 pts)
    totalPartial: z.int().min(0).optional(), // acertos parciais (5 pts)
    totalWrong: z.int().min(0).optional(), // palpites errados
    accuracy: percentageSchema, // aproveitamento 0–100
    longestStreak: z.int().min(0), // maior sequência
  })
  .strict();

// `docId` determinístico: `${championshipId}__${scopeKey}` — `scopeKey` = `poolId`
// (por bolão) ou `"geral"` (global do campeonato). `.strict()`.
export const historySnapshotSchema = z
  .object({
    championshipId: nonEmptyString, // campeonato arquivado
    scopeKey: nonEmptyString, // poolId | "geral"
    poolId: nonEmptyString.nullable(), // null quando scopeKey === "geral"
    archivedAt: isoDateTime, // carimbo do arquivamento
    finishedSignature: nonEmptyString, // assinatura do schedule encerrado
    ranking: z.array(rankingEntrySchema), // ranking final congelado (reusa schema)
    statistics: z.array(historyParticipantStatSchema).optional(), // só nos docs por-bolão
  })
  .strict();

export type HistoryParticipantStat = z.infer<typeof historyParticipantStatSchema>;
export type HistorySnapshot = z.infer<typeof historySnapshotSchema>;

// ─────────────────────── Contratos HTTP (TASK-15) ───────────────────────
// Schemas de RESPOSTA dos Route Handlers `/api/history/*` (Seção Histórico,
// read-only). Não confundir com `historySnapshotSchema` (forma do doc gravado
// pela TASK-13) — estes são a PROJEÇÃO servida ao cliente.

/** Item da listagem de campeonatos arquivados (`GET /api/history`). */
export const archivedChampionshipSummarySchema = z
  .object({
    championshipId: nonEmptyString,
    name: nonEmptyString,
    season: nonEmptyString,
    type: championshipTypeSchema,
    archivedAt: isoDateTime, // do snapshot `__geral`, do doc do pool, ou do override de estado
    hasPoolSnapshot: z.boolean(), // existe `history/{cid}__{poolId}` (traz estatísticas)
  })
  .strict();

export const archivedChampionshipsResponseSchema = z
  .object({ items: z.array(archivedChampionshipSummarySchema) })
  .strict();

/** Escopo do doc que serviu o ranking do detalhe: do pool (com estatísticas) ou geral. */
export const historyRankingScopeSchema = z.enum(["pool", "geral"]);

/**
 * Resposta de `GET /api/history/[championshipId]` SEM `matches` — o client
 * valida `matches` separadamente via `parseWithId(item, matchSchema)` por item
 * (o mesmo padrão do serviço de `matches`), porque `matchSchema` carrega um
 * `.refine` que não sobrevive a interseção/composição num schema maior (ver
 * nota em `services/_apiClient.ts`). O corpo HTTP real da rota inclui `matches`
 * como campo irmão — só não faz parte deste schema `.strict()`.
 */
export const championshipHistoryResponseSchema = z
  .object({
    championship: championshipPublicSchema,
    ranking: z.array(rankingEntrySchema),
    rankingScope: historyRankingScopeSchema,
    statistics: z.array(historyParticipantStatSchema).optional(),
    archivedAt: isoDateTime,
  })
  .strict();

export type ArchivedChampionshipSummary = z.infer<
  typeof archivedChampionshipSummarySchema
>;
export type ArchivedChampionshipsResponse = z.infer<
  typeof archivedChampionshipsResponseSchema
>;
export type HistoryRankingScope = z.infer<typeof historyRankingScopeSchema>;
export type ChampionshipHistoryResponse = z.infer<
  typeof championshipHistoryResponseSchema
>;
