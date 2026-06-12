import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Tipo de evento auditado (PRD-07, Tela Logs). Slug inglês estável.
// PRD-11 (TASK-02): enum ESTENDIDO de forma aditiva (append-only) — os tipos da
// PRD-07 permanecem válidos; os novos cobrem as ações administrativas globais
// (sync da Copa, edição manual de partida e moderação de grupos/admins).
export const systemLogTypeSchema = z.enum([
  // PRD-07 (auditoria de usuários / sistema)
  "login_admin",
  "user_approved",
  "user_blocked",
  "user_unblocked",
  "api_error",
  "ranking_update",
  // PRD-11 (auditoria global de plataforma)
  "worldcup_synced",
  "match_edited",
  "group_approved",
  "group_rejected",
  "group_blocked",
  "group_reactivated",
  "pool_admin_changed",
  "group_created",
  "group_updated",
  "user_group_assigned",
]);

export const systemLogLevelSchema = z.enum(["info", "warning", "error"]);

// Coleção `system_logs` (`system_logs/{id}`). Auditoria administrativa.
// Criada client-side pelo admin (sem Cloud Function); leitura admin-only via Rules.
export const systemLogSchema = z
  .object({
    id: nonEmptyString,
    type: systemLogTypeSchema,
    actorUid: nonEmptyString, // quem disparou (admin/sistema)
    targetUid: nonEmptyString.nullable().optional(), // alvo (ex.: usuário aprovado)
    message: nonEmptyString,
    level: systemLogLevelSchema,
    createdAt: isoDateTime,
  })
  .strict();

// Input de criação (id/createdAt definidos na escrita).
export const systemLogInputSchema = z.object({
  type: systemLogTypeSchema,
  actorUid: nonEmptyString,
  targetUid: nonEmptyString.nullable().optional(),
  message: nonEmptyString,
  level: systemLogLevelSchema.default("info"),
});

export type SystemLogType = z.infer<typeof systemLogTypeSchema>;
export type SystemLogLevel = z.infer<typeof systemLogLevelSchema>;
export type SystemLog = z.infer<typeof systemLogSchema>;
export type SystemLogInput = z.infer<typeof systemLogInputSchema>;
