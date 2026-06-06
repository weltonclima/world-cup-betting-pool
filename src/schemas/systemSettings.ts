import { z } from "zod";

import { isoDateTime, stageSchema } from "@/schemas/shared";

// Coleção `system_settings` (doc único, ex.: `system_settings/global`).
// Flags administrativas globais do MVP (assumido).
export const systemSettingsSchema = z
  .object({
    registrationOpen: z.boolean(), // (assumido) cadastro aberto/fechado
    predictionsLocked: z.boolean(), // (assumido) trava global de palpites
    currentStage: stageSchema.optional(), // (assumido) fase corrente do torneio
    updatedAt: isoDateTime.optional(), // (assumido)
  })
  .strict();
