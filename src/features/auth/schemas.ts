import { z } from "zod";

// Schemas de validação dos formulários de autenticação (PRD-01).
// Independentes do `userSchema` (documento Firestore em `@/schemas/users`):
// validam a entrada do usuário no client (React Hook Form + Zod), não o doc persistido.
// Mensagens em pt-BR (rótulos visíveis ao usuário).

// Mínimo de caracteres da senha (regra do mock `cadastro.png`).
export const PASSWORD_MIN_LENGTH = 6;

// Mínimo de caracteres da senha na REDEFINIÇÃO (recuperação, mock `04-nova-senha.png`).
// Regra própria e mais rígida que a de cadastro (8 + letra + número) — divergência
// intencional documentada no PRD-01.1 (A1/R6). Não confundir com PASSWORD_MIN_LENGTH.
export const RESET_PASSWORD_MIN_LENGTH = 8;

// Normaliza antes de validar: espaços nas pontas são tolerados e o casing é
// padronizado (este valor flui para o Firestore em signUp).
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "E-mail inválido." }));

const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  });

// Login: valida apenas o formato dos campos (a autenticação é feita na camada de serviço).
export const loginFormSchema = z.object({
  email: emailField,
  password: passwordField,
});

// Cadastro: nome, apelido, e-mail, senha + confirmação.
// `confirmPassword` é validação exclusiva do frontend
// (não vai ao Firebase Auth nem ao Firestore).
// `groupId` é OPCIONAL: o cadastro comum (`/signup`) não seleciona grupo; a
// associação a um pool acontece apenas pelo fluxo de convite (`/invite/[code]`),
// que injeta o `groupId` travado via `presetGroup` (não é campo do formulário).
export const signupFormSchema = z
  .object({
    name: z.string().trim().min(1, { message: "Informe seu nome completo." }),
    nickname: z.string().trim().min(1, { message: "Informe seu apelido." }),
    email: emailField,
    groupId: z.string().optional(),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

// Recuperação de senha — Tela 02 (informar e-mail). Reusa `emailField`.
export const forgotPasswordSchema = z.object({
  email: emailField,
});

// Recuperação de senha — Tela 04 (definir nova senha).
// Regra: mínimo 8 caracteres, ao menos uma letra e ao menos um número.
// A regra "diferente da anterior" do mock NÃO entra aqui: não é verificável no
// fluxo de reset (o app não conhece a senha atual) — é indicador visual
// informativo na tela, não validação bloqueante (PRD-01.1 A2).
const resetPasswordField = z
  .string()
  .min(RESET_PASSWORD_MIN_LENGTH, {
    message: `A senha deve ter pelo menos ${RESET_PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .regex(/[A-Za-z]/, { message: "A senha deve conter ao menos uma letra." })
  .regex(/[0-9]/, { message: "A senha deve conter ao menos um número." });

export const resetPasswordSchema = z
  .object({
    password: resetPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type SignupFormValues = z.infer<typeof signupFormSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
