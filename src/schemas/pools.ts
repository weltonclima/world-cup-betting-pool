import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `pools` (`pools/{id}`) — grupo de bolão ("pool") da PRD-09.
// Nome `pools` evita colisão com `groups` (grupos do torneio Copa). UI continua dizendo "grupo".

// Status do pool: pending (recém-criado, fora da busca) · active (disponível p/ cadastro)
// · blocked (não aceita novos membros). Transição de status é server-side (TASK-05).
export const poolStatusSchema = z.enum(["pending", "active", "blocked"]);

// Slug: minúsculas, dígitos e hífen. Unicidade é validada no servidor (TASK-04), não aqui.
// O regex já rejeita string vazia.
export const poolSlugSchema = z.string().regex(/^[a-z0-9-]+$/);

// Limite de tamanho da foto inline (base64, compat Firebase Spark — sem Storage).
// ~512 KB binário, bem abaixo do teto de 1 MB do doc Firestore (que ainda carrega os demais campos).
export const MAX_POOL_PHOTO_BASE64_LENGTH = 700_000;

export const poolSchema = z
  .object({
    id: nonEmptyString, // = id do doc
    name: nonEmptyString,
    slug: poolSlugSchema,
    description: z.string().max(160).optional(),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
    status: poolStatusSchema,
    adminId: nonEmptyString, // referência users.uid (criador/admin do pool)
    createdAt: isoDateTime,
    // Auditoria de mutações server-side (status/troca de admin, TASK-05). Opcional:
    // pools criados na TASK-04 nascem sem ele. Aditivo — não quebra parse de docs antigos.
    updatedAt: isoDateTime.optional(),
    // NET-NEW PRD-10 (TASK-01) — aditivos: pools criados na PRD-09 continuam fazendo
    // parse. Defaults aplicados NA LEITURA (não no schema): `maxParticipants` ausente
    // = sem limite; `allowInvites` ausente = `true`.
    maxParticipants: z.int().min(1).optional(), // limite de participantes (PRD10-05)
    allowInvites: z.boolean().optional(), // flag "permitir convites" (PRD10-05)
  })
  .strict();

// Input de criação: id/status/createdAt são definidos na escrita pelo servidor (TASK-04).
// Não-strict (espelha notificationInputSchema) — extras são ignorados, não rejeitados.
export const poolInputSchema = z.object({
  name: nonEmptyString,
  slug: poolSlugSchema,
  description: z.string().max(160).optional(),
  photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
  adminId: nonEmptyString,
});

// Input de criação no CLIENT: igual ao acima, sem `adminId` (definido pela sessão
// no servidor). Usado pela camada de serviço p/ revalidar Zod antes do POST
// (review WR-01 — falha cedo, sem round-trip inútil).
export const poolCreateClientSchema = poolInputSchema.omit({ adminId: true });

// PATCH parcial de um pool pelo super_admin (PRD-11 — editar grupo). Todos os
// campos opcionais (envia só o que mudou); `maxParticipants: null` limpa o limite
// (apaga o campo no servidor). Exige ao menos um campo. `slug`/`status`/`adminId`
// NÃO são editáveis aqui (slug = doc-id imutável; status e admin têm rotas próprias).
export const poolEditSchema = z
  .object({
    name: nonEmptyString,
    description: z.string().max(160),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH),
    maxParticipants: z.int().min(1).nullable(),
    allowInvites: z.boolean(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
