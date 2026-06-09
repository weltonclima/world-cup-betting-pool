import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// Coleção `notificationPreferences` (`notificationPreferences/{uid}`).
// Switch On/Off por categoria (PRD-08, Tela 03). Default = tudo ligado.
export const notificationPreferencesSchema = z
  .object({
    userId: nonEmptyString,
    system: z.boolean(),
    games: z.boolean(),
    ranking: z.boolean(),
    pool: z.boolean(),
  })
  .strict();

// Categorias editáveis (sem userId) — usado pelo form de preferências (RHF).
export const notificationPreferencesInputSchema = z.object({
  system: z.boolean(),
  games: z.boolean(),
  ranking: z.boolean(),
  pool: z.boolean(),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesInputSchema
>;

/** Preferências padrão (todas as categorias habilitadas) quando o doc não existe. */
export function defaultPreferences(userId: string): NotificationPreferences {
  return { userId, system: true, games: true, ranking: true, pool: true };
}
