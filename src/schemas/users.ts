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
  })
  .strict();
