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
    createdAt: isoDateTime.optional(), // (assumido) auditoria
    updatedAt: isoDateTime.optional(), // (assumido) auditoria
  })
  .strict();
