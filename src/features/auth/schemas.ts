import { z } from "zod";

// Schemas de validação dos formulários de autenticação (PRD-01).
// Independentes do `userSchema` (documento Firestore em `@/schemas/users`):
// validam a entrada do usuário no client (React Hook Form + Zod), não o doc persistido.
// Mensagens em pt-BR (rótulos visíveis ao usuário).

// Mínimo de caracteres da senha (regra do mock `cadastro.png`).
export const PASSWORD_MIN_LENGTH = 6;

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
export const signupFormSchema = z
  .object({
    name: z.string().trim().min(1, { message: "Informe seu nome completo." }),
    nickname: z.string().trim().min(1, { message: "Informe seu apelido." }),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type SignupFormValues = z.infer<typeof signupFormSchema>;
