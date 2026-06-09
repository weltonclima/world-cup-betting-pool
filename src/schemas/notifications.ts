import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Categoria da notificação (PRD-08). Slug inglês estável; rótulos pt-BR na UI.
export const notificationTypeSchema = z.enum([
  "system", // cadastro aprovado/rejeitado, conta bloqueada/reativada
  "games", // novos jogos, prazo encerrando, fase liberada
  "ranking", // ranking atualizado, mudança de posição, top 10
  "pool", // início da Copa, encerramento de fase/bolão
]);

// Coleção `notifications` (`notifications/{id}`).
// `userId` = destinatário (referência users.uid). Lida/criada client-side
// (sem Cloud Function — compat. Firebase Spark).
export const notificationSchema = z
  .object({
    id: nonEmptyString, // = id do doc
    userId: nonEmptyString, // destinatário
    type: notificationTypeSchema,
    title: nonEmptyString,
    message: nonEmptyString,
    isRead: z.boolean(),
    createdAt: isoDateTime,
  })
  .strict();

// Input de criação (id/createdAt definidos na escrita; isRead default false).
export const notificationInputSchema = z.object({
  userId: nonEmptyString,
  type: notificationTypeSchema,
  title: nonEmptyString,
  message: nonEmptyString,
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationInput = z.infer<typeof notificationInputSchema>;
