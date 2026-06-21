import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// Coleção `notificationPreferences` (`notificationPreferences/{uid}`).
// Switch On/Off por categoria (PRD-08, Tela 03). Categorias default = ligadas.
// `pushEnabled` (web-push-pwa TASK-05): master switch de push, default DESLIGADO
// (opt-in explícito). `.default(false)` torna a migração tolerante — docs legados
// sem o campo parseiam OK e caem em `false`, preservando `.strict()`.
export const notificationPreferencesSchema = z
  .object({
    userId: nonEmptyString,
    system: z.boolean(),
    games: z.boolean(),
    ranking: z.boolean(),
    pushEnabled: z.boolean().default(false),
  })
  .strict();

// Categorias editáveis (sem userId) — usado pelo form de preferências (RHF).
export const notificationPreferencesInputSchema = z.object({
  system: z.boolean(),
  games: z.boolean(),
  ranking: z.boolean(),
  pushEnabled: z.boolean().default(false),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesInputSchema
>;

/**
 * Preferências padrão quando o doc não existe: categorias habilitadas, push
 * DESLIGADO (opt-in explícito — nunca push sem ação do usuário).
 */
export function defaultPreferences(userId: string): NotificationPreferences {
  return { userId, system: true, games: true, ranking: true, pushEnabled: false };
}
