import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `invites` (`invites/{id}`) — convites de entrada num pool (PRD-10, TASK-01).
// `code` é o identificador curto, único POR POOL e não-adivinhável, gerado no
// servidor (nunca aceito do client). doc-id = code resolve a unicidade sem índice
// e simplifica a redenção futura (A2). O isolamento entre pools é garantido por
// `groupId` (validado server-side em toda rota — D2).

// Código de convite: 6 caracteres maiúsculos alfanuméricos (slug curto). O regex
// já rejeita string vazia. Gerado server-side; o client nunca o envia.
export const inviteCodeSchema = z.string().regex(/^[A-Z0-9]{6}$/);

// Tetos de campo (guard-rails — evitam doc gigante e valores absurdos).
export const MAX_INVITE_LABEL_LENGTH = 60;
export const MAX_INVITE_MAX_USES = 100_000;

export const inviteSchema = z
  .object({
    id: nonEmptyString, // = id do doc (na prática, = code)
    groupId: nonEmptyString, // pool dono (isolamento — D2)
    code: inviteCodeSchema, // código curto único por pool
    label: z.string().max(MAX_INVITE_LABEL_LENGTH).optional(), // rótulo opcional ("Link principal")
    maxUses: z.int().min(1).max(MAX_INVITE_MAX_USES), // limite de usos
    usedCount: z.int().min(0), // usos atuais (incremento na redenção — A2)
    expiresAt: isoDateTime, // validade
    isActive: z.boolean(), // false oculta/expira o convite
    createdBy: nonEmptyString, // uid do admin que gerou
    createdAt: isoDateTime,
  })
  .strict()
  // `usedCount` nunca pode exceder `maxUses` (invariante de domínio).
  .refine((inv) => inv.usedCount <= inv.maxUses, {
    message: "usedCount não pode exceder maxUses.",
    path: ["usedCount"],
  });

// Input de criação no SERVIDOR: id/code/usedCount/isActive/createdAt são definidos
// pela rota; `createdBy`/`groupId` vêm da sessão. Não-strict (espelha
// poolInputSchema) — extras são ignorados, não rejeitados.
export const inviteInputSchema = z.object({
  groupId: nonEmptyString,
  label: z.string().max(MAX_INVITE_LABEL_LENGTH).optional(),
  maxUses: z.int().min(1).max(MAX_INVITE_MAX_USES),
  expiresAt: isoDateTime,
  createdBy: nonEmptyString,
});

// Input de criação no CLIENT: o admin define apenas rótulo/limite/validade.
// `groupId`/`createdBy` são da sessão (server-side); `code` é gerado no servidor.
// Usado pela camada de serviço p/ revalidar Zod antes do POST (falha cedo).
export const inviteCreateClientSchema = z.object({
  label: z.string().max(MAX_INVITE_LABEL_LENGTH).optional(),
  maxUses: z.int().min(1).max(MAX_INVITE_MAX_USES),
  // Validade em dias (a rota converte em `expiresAt` absoluto). 1..365.
  validityDays: z.int().min(1).max(365),
});
