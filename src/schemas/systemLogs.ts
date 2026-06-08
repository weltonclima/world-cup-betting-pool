import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Tipo de evento auditado (PRD-07, Tela Logs). Slug inglês estável.
export const systemLogTypeSchema = z.enum([
  "login_admin",
  "user_approved",
  "user_blocked",
  "user_unblocked",
  "api_error",
  "ranking_update",
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
