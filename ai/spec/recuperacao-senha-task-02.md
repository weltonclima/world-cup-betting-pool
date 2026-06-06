# SPEC — RECUPERACAO-SENHA TASK-02: Serviço de reset de senha (Firebase Auth)

> Entrada: `ai/plan/recuperacao-senha.md` (TASK-02) + `ai/prd/recuperacao-senha.md` (R1/R3) + `.claude/CLAUDE.md`.
> Tipo: `application` · Criticidade: `critical` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: nenhuma.

---

## 1. Task: RECUPERACAO-SENHA-TASK-02 — Serviço de reset

## 2. Objetivo

Encapsular as 3 operações Firebase do fluxo de reset em `src/services/auth.ts`, seguindo a convenção do módulo: propaga `error.code` cru (UI traduz via `mapAuthError`). Exceção deliberada: anti-enumeração em `sendPasswordReset` (R3).

### Truths ao fim
- `sendPasswordReset(email)` chama `sendPasswordResetEmail(firebaseAuth, email)` e resolve `void`.
- **R3 (anti-enumeração):** se `sendPasswordResetEmail` rejeitar com `auth/user-not-found`, `sendPasswordReset` **resolve normalmente** (não relança). Qualquer outro erro propaga.
- `verifyResetCode(oobCode)` chama `verifyPasswordResetCode(firebaseAuth, oobCode)` e resolve o e-mail (string) retornado; erros propagam.
- `confirmReset(oobCode, newPassword)` chama `confirmPasswordReset(firebaseAuth, oobCode, newPassword)` e resolve `void`; erros propagam.
- Reexport em `src/services/index.ts`.
- Sem `any`; TS strict.

---

## 3. In scope
- `src/services/auth.ts` (estender — manter `signIn`/`signUp`/`signOut`):
  - import adicional de `firebase/auth`: `sendPasswordResetEmail`, `verifyPasswordResetCode`, `confirmPasswordReset`.
  - ```ts
    export async function sendPasswordReset(email: string): Promise<void> {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
      } catch (error) {
        // R3: não revelar inexistência de conta — tratar como sucesso.
        if ((error as { code?: string }).code === "auth/user-not-found") return;
        throw error;
      }
    }
    export async function verifyResetCode(oobCode: string): Promise<string> {
      return verifyPasswordResetCode(firebaseAuth, oobCode);
    }
    export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
      await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
    }
    ```
- `src/services/index.ts`: adicionar `sendPasswordReset`, `verifyResetCode`, `confirmReset` ao reexport.
- Tests: `src/services/__tests__/auth.test.ts` (estender; mockar os 3 novos métodos de `firebase/auth`).

## 4. Out of scope
- Tradução de erros (TASK-01/UI).
- `actionCodeSettings`/Action URL — config operacional (R1, `/release`); não implementar aqui.
- Telas/forms (TASK-03/04).

## 5. Main technical areas
- `src/services/auth.ts`, `src/services/index.ts`, `src/services/__tests__/auth.test.ts`.
- Reuso: `firebaseAuth` de `@/firebase`.

## 6. Business rules and behavior
- **Sem tradução:** códigos `auth/*` chegam crus à UI (exceto o swallow de `user-not-found`).
- **R3:** `user-not-found` → sucesso silencioso (anti-enumeração). Narrowing seguro do `code` sem `any` (`(error as { code?: string }).code`).
- **verifyResetCode** retorna o e-mail (usado pela tela 04, opcionalmente exibido).

## 7. Contracts and interfaces
```ts
export function sendPasswordReset(email: string): Promise<void>;
export function verifyResetCode(oobCode: string): Promise<string>;
export function confirmReset(oobCode: string, newPassword: string): Promise<void>;
```

## 8. Data and persistence impact
- Nenhuma escrita no Firestore. Senha vive só no Firebase Auth.

## 9. Required tests (TDD — antes da implementação)
Mock `firebase/auth` + `@/firebase`:
- **T1 sendPasswordReset sucesso:** chama `sendPasswordResetEmail(firebaseAuth, email)`; resolve.
- **T2 sendPasswordReset anti-enumeração:** `sendPasswordResetEmail` rejeita com `{ code: "auth/user-not-found" }` → `sendPasswordReset` **resolve** (não lança).
- **T3 sendPasswordReset propaga outros:** rejeita com `{ code: "auth/too-many-requests" }` → `sendPasswordReset` rejeita com o mesmo erro.
- **T4 verifyResetCode:** chama `verifyPasswordResetCode(firebaseAuth, oobCode)`; resolve o e-mail retornado.
- **T5 verifyResetCode propaga:** rejeita com `{ code: "auth/expired-action-code" }` → rejeita igual.
- **T6 confirmReset:** chama `confirmPasswordReset(firebaseAuth, oobCode, newPassword)`; resolve.
- **T7 confirmReset propaga:** rejeita com `{ code: "auth/invalid-action-code" }` → rejeita igual.

## 10. Acceptance criteria
- [ ] `auth.ts` exporta `sendPasswordReset`, `verifyResetCode`, `confirmReset`; mantém os existentes.
- [ ] Anti-enumeração de `user-not-found` em `sendPasswordReset`; demais erros propagam.
- [ ] `verifyResetCode` resolve o e-mail; `confirmReset` resolve void.
- [ ] Reexport em `index.ts`.
- [ ] Sem `any`; `npx tsc --noEmit` limpo.
- [ ] `npx vitest run src/services/__tests__/auth.test.ts` verde (T1–T7).

## 11. UI/Screen requirement
- Requires screen: no · Platform: n/a · Screens: none

## 12. Constraints
- Sem `any` (narrowing do `code` por type assertion estreita). Services em `src/services`. Não traduzir erros (salvo swallow R3). Não commitar (revisão central).

## 13. Open questions
- Nenhuma. R1 (Action URL) é operacional, fora do código.
