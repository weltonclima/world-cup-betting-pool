import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `fcm_tokens` (`fcm_tokens/{token}`). Token FCM por dispositivo
// (multi-device) usado pelo envio de Web Push (web-push-pwa TASK-04). Doc id = o
// próprio token. Escrita exclusiva via Admin SDK no Route Handler /api/push/tokens
// (Rules negam acesso client). `userAgent` pode ser vazio se ausente no request.
export const fcmTokenSchema = z
  .object({
    token: nonEmptyString, // = id do doc
    userId: nonEmptyString, // dono (referência users.uid) — sempre da sessão
    userAgent: z.string(), // header do device no registro (pode ser "")
    createdAt: isoDateTime,
    lastSeenAt: isoDateTime,
  })
  .strict();

// Input do POST /api/push/tokens — só o token; `userId`/`userAgent`/datas são
// definidos no servidor (uid da sessão, userAgent do header).
export const fcmTokenInputSchema = z
  .object({
    token: nonEmptyString,
  })
  .strict();

export type FcmToken = z.infer<typeof fcmTokenSchema>;
export type FcmTokenInput = z.infer<typeof fcmTokenInputSchema>;
