import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  roleSchema,
  userStatusSchema,
} from "@/schemas/shared";

// Coleção `users` (`users/{uid}`). Perfil, role e status do usuário.
export const userSchema = z
  .object({
    uid: nonEmptyString, // = id do doc (Firebase Auth)
    name: nonEmptyString,
    nickname: nonEmptyString,
    email: z.email(),
    role: roleSchema,
    status: userStatusSchema,
    // Pool do usuário (PRD-09). Opcional na transição; obrigatório só na TASK-12 (pós-backfill).
    groupId: nonEmptyString.optional(),
    // Avatar do usuário (PRD-06, D-A2): data URL JPEG base64 comprimido no client
    // (sem Firebase Storage). Opcional — usuário sem foto cai no fallback de iniciais.
    avatarUrl: z.string().optional(),
    createdAt: isoDateTime.optional(), // (assumido) auditoria
    updatedAt: isoDateTime.optional(), // (assumido) auditoria
    // NET-NEW PRD-10 (TASK-01) — aditivos/opcionais: usuários da PRD-09 continuam
    // fazendo parse. `blockReason` capturado no bloqueio (PRD10-03/04);
    // `removedFromGroupAt` marca o soft-delete (D4) sem apagar o doc.
    blockReason: z.string().max(280).optional(), // motivo do bloqueio (PRD10-04)
    removedFromGroupAt: isoDateTime.optional(), // soft-delete do grupo (D4)
  })
  .strict();
