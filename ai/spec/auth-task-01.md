# SPEC — AUTH TASK-01: Schemas de formulário (login + cadastro)

> Entrada: `ai/plan/auth.md` (TASK-01) + `ai/prd/auth.md` + `.claude/CLAUDE.md`.
> Tipo: `domain` · Criticidade: `high` · Risco técnico: `low` · Story points: 2.
> TDD: sim · Screen: não · Dependências: nenhuma (reusa `@/schemas/shared` quando aplicável).

> Nota de naming: o slot `ai/spec/task-01.md` já está ocupado pelo SPEC da TASK-01 do plano `feature.md` (fundação PRD-00, "Scaffold Next.js"). Para não sobrescrever artefato não relacionado, este SPEC do plano `auth.md` foi gravado como `ai/spec/auth-task-01.md`.

---

## 1. Task: AUTH-TASK-01 – Schemas de formulário (login + cadastro)

## 2. Objetivo

Definir schemas Zod **independentes** para validar os formulários de **Login** e **Cadastro** da feature de autenticação (PRD-01), distintos do `userSchema` (documento Firestore em `src/schemas/users.ts`). Os schemas validam a entrada do usuário no client (RHF + Zod) e exportam os tipos derivados via `z.infer`.

### Truths que devem ser verdadeiras ao fim
- `loginFormSchema` aceita `{ email, password }` válidos e rejeita email malformado e senha vazia/curta (< 6).
- `signupFormSchema` aceita um cadastro completo válido e rejeita: email inválido, senha < 6, `password !== confirmPassword` (erro no path `confirmPassword`), `acceptTerms !== true` (erro no path `acceptTerms`), nome/apelido vazios.
- Tipos `LoginFormValues` e `SignupFormValues` exportados via `z.infer`.
- Mensagens de validação em pt-BR.
- `src/schemas/users.ts` permanece intocado.

---

## 3. In scope
- `src/features/auth/schemas.ts` com:
  - `loginFormSchema` — `email` (email válido), `password` (não vazio, mínimo 6 caracteres).
  - `signupFormSchema` — `name` (não vazio), `nickname` (não vazio), `email` (email válido), `password` (mínimo 6), `confirmPassword` (string), `acceptTerms` (boolean), com:
    - `.refine` exigindo `password === confirmPassword` → erro no path `["confirmPassword"]`.
    - `.refine` exigindo `acceptTerms === true` → erro no path `["acceptTerms"]`.
  - Tipos derivados: `export type LoginFormValues = z.infer<typeof loginFormSchema>` e `export type SignupFormValues = z.infer<typeof signupFormSchema>`.
  - Reuso de `nonEmptyString` de `@/schemas/shared` onde fizer sentido (name, nickname).
  - Constante de mínimo de senha (`PASSWORD_MIN_LENGTH = 6`) para evitar hardcode espalhado.
- Tests co-localizados (convenção do projeto: `src/**/*.test.{ts,tsx}` → `src/features/auth/__tests__/schemas.test.ts`).

## 4. Out of scope
- Mapeamento de erros Firebase (TASK-02).
- Primitivos UI / componentes (TASK-03).
- Serviços de auth / chamadas Firebase (TASK-06).
- Telas/forms RHF (TASK-07, TASK-08).
- Persistência do aceite de termos (não vai ao Firestore — decisão de design travada no plano).
- Unicidade de apelido / verificação de email.

## 5. Main technical areas
- `src/features/auth/schemas.ts` (novo).
- `src/features/auth/__tests__/schemas.test.ts` (novo).
- Reuso: `src/schemas/shared.ts` (`nonEmptyString`).

## 6. Business rules and behavior
- **Senha mínima:** 6 caracteres (regra do `cadastro.png`, citada no plano).
- **Login:** valida apenas formato — email válido + senha presente (>= 6). Não autentica (isso é TASK-06).
- **Cadastro — confirmar senha (A6):** validação só frontend; `password` deve ser igual a `confirmPassword`; erro reportado no campo `confirmPassword` para a UI poder anexar a mensagem inline.
- **Cadastro — termos (A5):** `acceptTerms` é boolean obrigatório com valor `true`; erro reportado no path `acceptTerms`.
- **Mensagens:** todas em pt-BR.

## 7. Contracts and interfaces
```ts
// Schemas
loginFormSchema: ZodObject<{ email; password }>
signupFormSchema: ZodEffects<ZodObject<{ name; nickname; email; password; confirmPassword; acceptTerms }>>

// Tipos derivados
type LoginFormValues  = { email: string; password: string }
type SignupFormValues = {
  name: string; nickname: string; email: string;
  password: string; confirmPassword: string; acceptTerms: boolean
}
```
- `safeParse` é o ponto de uso primário (RHF via `zodResolver` em tasks futuras).
- Erros de `refine` carregam `path` específico (`confirmPassword`, `acceptTerms`).

## 8. Data and persistence impact
- Nenhum. Schemas são puramente de validação de entrada de formulário. Nada é persistido por esta task.

## 9. Required tests
Cobertura mínima (TDD, escritos antes da implementação):
- Login válido → success.
- Login com email inválido → falha.
- Login com senha curta (< 6) → falha.
- Login com senha vazia → falha.
- Cadastro válido → success.
- Cadastro com senha ≠ confirmPassword → falha com issue no path `confirmPassword`.
- Cadastro com `acceptTerms === false` → falha com issue no path `acceptTerms`.
- Cadastro com email inválido → falha.
- Cadastro com nome/apelido vazio → falha.
- Inferência de tipos (`expectTypeOf`) para `LoginFormValues` e `SignupFormValues`.

## 10. Acceptance criteria
- [ ] `src/features/auth/schemas.ts` exporta `loginFormSchema`, `signupFormSchema`, `LoginFormValues`, `SignupFormValues`.
- [ ] Regras de validação conforme seção 6, mensagens pt-BR.
- [ ] `.refine` de senha aponta para `confirmPassword`; `.refine` de termos aponta para `acceptTerms`.
- [ ] Sem `any`; TS strict.
- [ ] `src/schemas/users.ts` inalterado.
- [ ] `npx vitest run src/features/auth/__tests__/schemas.test.ts` verde.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none

## 12. Constraints
- Não usar `any` (CLAUDE.md regra 1).
- Não contaminar `src/schemas/users.ts`.
- Reusar `@/schemas/shared` quando sensato (DRY).
- Mensagens em pt-BR.
- Não commitar (revisão central).

## 13. Open questions
- Nenhuma. Decisões de termos/confirmar senha já travadas no plano (`ai/plan/auth.md` §1).
