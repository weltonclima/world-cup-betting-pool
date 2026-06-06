# SPEC — RECUPERACAO-SENHA TASK-01: Schemas de form + mapeamento de erros de reset

> Entrada: `ai/plan/recuperacao-senha.md` (TASK-01) + `ai/prd/recuperacao-senha.md` + `.claude/CLAUDE.md`.
> Tipo: `domain` · Criticidade: `high` · Risco técnico: `low` · Story points: 2.
> TDD: sim · Screen: não · Dependências: nenhuma.

---

## 1. Task: RECUPERACAO-SENHA-TASK-01 — Schemas + erros de reset

## 2. Objetivo

Adicionar os schemas Zod de validação das 2 telas de formulário do fluxo de recuperação (solicitar link e redefinir senha) e estender o mapeamento de erros Firebase→pt-BR com os códigos de action-code. Lógica pura, testável, base para TASK-03/04.

### Truths ao fim
- `forgotPasswordSchema` aceita `{ email }` válido; rejeita email malformado/vazio.
- `resetPasswordSchema` aceita `{ password, confirmPassword }` quando: `password` ≥ 8 caracteres **E** contém pelo menos uma letra **E** pelo menos um dígito; e `password === confirmPassword`.
- `resetPasswordSchema` rejeita: senha < 8 (path `password`), senha sem letra (path `password`), senha sem número (path `password`), `password !== confirmPassword` (path `confirmPassword`).
- Tipos `ForgotPasswordValues` e `ResetPasswordValues` exportados via `z.infer`.
- `mapAuthError` traduz `auth/invalid-action-code`, `auth/expired-action-code`, `auth/user-disabled` para mensagens pt-BR acionáveis.
- `RESET_PASSWORD_MIN_LENGTH = 8` exportado; `PASSWORD_MIN_LENGTH` (=6) **inalterado**.
- Mensagens em pt-BR. Sem `any`. TS strict.

---

## 3. In scope
- `src/features/auth/schemas.ts` (estender — não recriar):
  - `export const RESET_PASSWORD_MIN_LENGTH = 8;`
  - `forgotPasswordSchema = z.object({ email: emailField })` (reusa `emailField` existente).
  - `resetPasswordSchema`:
    ```
    z.object({
      password: z.string()
        .min(RESET_PASSWORD_MIN_LENGTH, { message: "A senha deve ter pelo menos 8 caracteres." })
        .regex(/[A-Za-z]/, { message: "A senha deve conter ao menos uma letra." })
        .regex(/[0-9]/, { message: "A senha deve conter ao menos um número." }),
      confirmPassword: z.string(),
    }).refine(d => d.password === d.confirmPassword, {
      message: "As senhas não coincidem.", path: ["confirmPassword"],
    })
    ```
  - `export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;`
  - `export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;`
- `src/features/auth/errors.ts` (estender tabela `AUTH_ERROR_MESSAGES`):
  - `"auth/invalid-action-code": "O link de redefinição é inválido. Solicite um novo."`
  - `"auth/expired-action-code": "O link de redefinição expirou. Solicite um novo."`
  - `"auth/user-disabled": "Esta conta está desativada. Contate o administrador."`
  - Manter `auth/weak-password` existente (texto genérico já serve; não alterar para não quebrar cadastro).
- Tests: `src/features/auth/__tests__/schemas.test.ts` (estender) e `src/features/auth/__tests__/errors.test.ts` (estender).

## 4. Out of scope
- Regra "senha ≠ anterior" — **NÃO** entra no schema (não verificável sem senha atual; indicador visual informativo na TASK-04).
- Alterar `PASSWORD_MIN_LENGTH`, `loginFormSchema`, `signupFormSchema`.
- Serviço Firebase (TASK-02), telas/forms (TASK-03/04).

## 5. Main technical areas
- `src/features/auth/schemas.ts`, `src/features/auth/errors.ts` (+ testes co-localizados).

## 6. Business rules and behavior
- **Senha de reset:** ≥ 8, letra + número obrigatórios (regra tela 04). Constante isolada `RESET_PASSWORD_MIN_LENGTH`.
- **Confirmação:** erro no path `confirmPassword` (UI anexa inline).
- **Privacidade:** mensagens de action-code não revelam dados de conta.
- **Mensagens pt-BR.**

## 7. Contracts and interfaces
```ts
export const RESET_PASSWORD_MIN_LENGTH = 8;
export const forgotPasswordSchema: ZodObject<{ email }>;
export const resetPasswordSchema: ZodEffects<ZodObject<{ password; confirmPassword }>>;
export type ForgotPasswordValues = { email: string };
export type ResetPasswordValues  = { password: string; confirmPassword: string };
// errors.ts: mapAuthError(code) cobre os 3 novos códigos.
```

## 8. Data and persistence impact
- Nenhum.

## 9. Required tests (TDD — antes da implementação)
schemas.test.ts:
- forgot: email válido → success; email inválido → falha; vazio → falha.
- reset: válido (`"abcd1234"`/igual) → success.
- reset: < 8 → falha path `password`.
- reset: 8+ sem dígito (`"abcdefgh"`) → falha path `password`.
- reset: 8+ sem letra (`"12345678"`) → falha path `password`.
- reset: `password !== confirmPassword` → falha path `confirmPassword`.
- inferência de tipos `ForgotPasswordValues`/`ResetPasswordValues`.
errors.test.ts:
- `auth/invalid-action-code`, `auth/expired-action-code`, `auth/user-disabled` → mensagens específicas (≠ fallback).
- código desconhecido → fallback (regressão).

## 10. Acceptance criteria
- [ ] `schemas.ts` exporta `RESET_PASSWORD_MIN_LENGTH`, `forgotPasswordSchema`, `resetPasswordSchema`, `ForgotPasswordValues`, `ResetPasswordValues`.
- [ ] Regras conforme §6; mensagens pt-BR; paths corretos.
- [ ] `errors.ts` cobre os 3 novos códigos; demais inalterados.
- [ ] `PASSWORD_MIN_LENGTH`/login/signup intocados.
- [ ] Sem `any`; `npx tsc --noEmit` limpo.
- [ ] `npx vitest run src/features/auth/__tests__/schemas.test.ts src/features/auth/__tests__/errors.test.ts` verde.

## 11. UI/Screen requirement
- Requires screen: no · Platform: n/a · Screens: none

## 12. Constraints
- Sem `any`. Reusar `emailField`. Não tocar regra de senha de login/cadastro. Mensagens pt-BR.

## 13. Open questions
- Nenhuma. A2 resolvido no plano (regra "≠ anterior" fora do schema).
