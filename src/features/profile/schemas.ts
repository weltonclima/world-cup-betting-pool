import { z } from "zod";

// Schemas de formulário da feature Perfil (PRD-06).
// Seguem o padrão de `features/auth/schemas.ts`: validação de INPUT do usuário
// no client (React Hook Form + Zod), não documentos Firestore. Mensagens pt-BR.

// Mínimo de caracteres da senha (regra do mock `PRD06-04-Alterar-Senha.png`).
export const CHANGE_PASSWORD_MIN_LENGTH = 6;

/**
 * Regras de senha do PRD06-04, expostas como lista reutilizável para a UI
 * renderizar o checklist visual (✓ por regra) e para o schema validar.
 * Fonte única de verdade — schema e UI consomem a mesma lista.
 */
export const passwordRules: ReadonlyArray<{
  id: string;
  label: string;
  test: (value: string) => boolean;
}> = [
  {
    id: "length",
    label: `Mínimo de ${CHANGE_PASSWORD_MIN_LENGTH} caracteres`,
    test: (v) => v.length >= CHANGE_PASSWORD_MIN_LENGTH,
  },
  {
    id: "case",
    label: "Letras maiúsculas e minúsculas",
    test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  {
    id: "numberSpecial",
    label: "Números e caracteres especiais",
    test: (v) => /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v),
  },
];

/** Retorna true se `value` satisfaz TODAS as regras do PRD06-04. */
export function passwordMeetsRules(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}

const newPasswordField = z.string().refine(passwordMeetsRules, {
  message:
    "A senha deve ter no mínimo 6 caracteres, maiúsculas e minúsculas, números e caracteres especiais.",
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Informe sua senha atual." }),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.confirmPassword === data.newPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "A nova senha deve ser diferente da atual.",
    path: ["newPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
