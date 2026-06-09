# SPEC — perfil-usuario TASK-01: Schema de alteração de senha + regras

> Origem: `ai/plan/perfil-usuario.md` TASK-01. Fonte visual: `PRD06-04-Alterar-Senha.png`.

## Goal
Validar troca de senha (atual/nova/confirmação) conforme regras visíveis no PRD06-04.

## Regras de senha (checklist do mock)
- Mínimo de 6 caracteres
- Letras maiúsculas **e** minúsculas
- Números **e** caracteres especiais

## Contrato
- `passwordRules`: array de `{ id, label, test(value): boolean }` — reutilizável pela UI
  (checklist visual com ✓ por regra).
- `changePasswordSchema` (Zod, RHF):
  - `currentPassword`: string não-vazia ("Informe sua senha atual").
  - `newPassword`: passa em todas as `passwordRules`.
  - `confirmPassword`: string.
  - refine: `confirmPassword === newPassword` (path confirmPassword, "As senhas não coincidem.").
  - refine: `newPassword !== currentPassword` (path newPassword, "A nova senha deve ser diferente da atual.").
- Type `ChangePasswordValues = z.infer<...>`.

## Localização (desvio justificado)
Plan sugeriu `src/schemas/changePassword.ts`, mas o padrão do codebase é: schemas de **formulário**
ficam na feature (`features/auth/schemas.ts`), enquanto `src/schemas/*` é para docs Firestore.
→ Implementar em `src/features/profile/schemas.ts` (consistência > literalidade do plan).

## Requires screen: no
## TDD: yes
## Acceptance
- Cada regra testada isolada (falha/passa).
- Mismatch de confirmação rejeita.
- Nova == atual rejeita.
- Senha válida (ex.: `Senha@1`) passa.
