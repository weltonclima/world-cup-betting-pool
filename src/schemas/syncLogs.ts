import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `sync_logs` (`sync_logs/{id}`) — PRD-11 (TASK-02).
// Resumo numérico de cada sincronização OpenFootball → Firestore. Separado de
// `system_logs` por carregar contadores específicos (jogos/seleções/groups
// atualizados + jogos preservados por override) lidos no painel "Última
// Sincronização" (PRD11-01) e em "Detalhes do Log" (PRD11-10).

// Resultado da sincronização: success (tudo escrito), partial (falha parcial,
// alguns docs não escritos) ou error (sync abortado). Alimenta o badge de status.
export const syncLogStatusSchema = z.enum(["success", "partial", "error"]);

export const syncLogSchema = z
  .object({
    id: nonEmptyString,                 // = id do doc
    executedBy: nonEmptyString,         // uid do super_admin que disparou
    executedAt: isoDateTime,            // carimbo de execução (ISO 8601)
    matchesUpdated: z.int().min(0),     // partidas escritas/atualizadas
    matchesSkipped: z.int().min(0),     // partidas preservadas por isManualOverride
    teamsUpdated: z.int().min(0),       // seleções atualizadas
    groupsUpdated: z.int().min(0),      // grupos do torneio atualizados
    status: syncLogStatusSchema,
    message: z.string(),                // detalhe humano (pode ser vazio em success)
  })
  .strict();

// Input de criação: id é definido na escrita (doc ref do Admin SDK).
export const syncLogInputSchema = z.object({
  executedBy: nonEmptyString,
  executedAt: isoDateTime,
  matchesUpdated: z.int().min(0),
  matchesSkipped: z.int().min(0),
  teamsUpdated: z.int().min(0),
  groupsUpdated: z.int().min(0),
  status: syncLogStatusSchema,
  message: z.string().default(""),
});

export type SyncLogStatus = z.infer<typeof syncLogStatusSchema>;
export type SyncLog = z.infer<typeof syncLogSchema>;
export type SyncLogInput = z.infer<typeof syncLogInputSchema>;
