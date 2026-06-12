import { z } from "zod";

// Schema de validação do formulário "Criar Grupo" (PRD-09, TASK-08 — tela PRD09-01).
// Valida a ENTRADA do usuário no client (React Hook Form + Zod). A unicidade do slug
// é validada no servidor (TASK-04) — aqui só formato. Mensagens em pt-BR.
// O contrato persistido vive em `@/schemas/pools` (poolCreateClientSchema).

/** Limite de caracteres da descrição (mostrado como contador 0/160 no PNG). */
export const GROUP_DESCRIPTION_MAX_LENGTH = 160;

export const createGroupFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Informe o nome do grupo." }),
  slug: z
    .string()
    .trim()
    .min(1, { message: "Informe o slug do grupo." })
    .regex(/^[a-z0-9-]+$/, {
      message: "Use apenas letras minúsculas, números e hifens.",
    }),
  description: z
    .string()
    .trim()
    .max(GROUP_DESCRIPTION_MAX_LENGTH, {
      message: `A descrição deve ter no máximo ${GROUP_DESCRIPTION_MAX_LENGTH} caracteres.`,
    })
    .optional(),
});

export type CreateGroupFormValues = z.infer<typeof createGroupFormSchema>;

/**
 * Deriva um slug-sugestão a partir do nome (puro/testável): minúsculas, remove
 * acentos, troca não-alfanuméricos por hífen e colapsa/recorta hifens das pontas.
 * Editável pelo usuário no campo Slug (PNG: "Apenas letras, números e hifens.").
 */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
