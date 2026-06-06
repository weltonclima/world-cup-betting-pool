# SPEC — AUTH TASK-06: Serviços de auth (signIn / signUp / signOut)

> Entrada: `ai/plan/auth.md` (TASK-06) + `ai/prd/auth.md` (R2) + `.claude/CLAUDE.md` (stack Firebase, regras TS strict / sem `any`, services em `src/services`) + `firestore.rules`.
> Tipo: `application` · Criticidade: `critical` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: TASK-01 (tipos do payload de signup) — Wave 2.

> Nota de naming: o slot `ai/spec/task-06.md` já está ocupado pelo SPEC da TASK-06 do plano `feature.md` (fundação PRD-00). Para não sobrescrever artefato não relacionado, este SPEC do plano `auth.md` foi gravado como `ai/spec/auth-task-06.md` (mesma convenção de `auth-task-01.md` … `auth-task-05.md`).

---

## 1. Task: AUTH-TASK-06 — Serviços de auth (signIn / signUp / signOut)

## 2. Objetivo

Camada de serviço (`src/services/auth.ts`) que encapsula Firebase Authentication + Firestore para os formulários de Login e Cadastro (PRD-01). Centraliza as três operações de sessão e o fluxo atômico de cadastro com rollback, mantendo o código do client previsível e testável. As telas (TASK-07/08) consomem estes serviços; a tradução de erros é responsabilidade da UI via `mapAuthError` (TASK-02) — esta camada **propaga** os erros do Firebase sem traduzir.

### Truths que devem ser verdadeiras ao fim
- `signIn(email, password)` chama `signInWithEmailAndPassword(firebaseAuth, email, password)` e resolve `void`.
- `signUp(payload)` cria o usuário no Firebase Auth e, em seguida, grava o doc `users/{uid}`.
- O doc gravado contém exatamente `{ uid, name, nickname, email, role: "user", status: "pending", createdAt: <ISO string> }` (campos do `userSchema`).
- Se o `setDoc` falhar, o auth user recém-criado é removido via `deleteUser(user)` (rollback R2) — sem conta órfã.
- Se o **próprio rollback** falhar, o erro do rollback é logado (`console.error`) e o **erro original** do `setDoc` é relançado.
- `signOut()` chama `signOut(firebaseAuth)` e resolve `void`.
- Erros do Firebase propagam (a UI mapeia via `mapAuthError`).
- Tipo de entrada do `signUp` derivado de `SignupFormValues` **excluindo** `confirmPassword`/`acceptTerms` (campos só de frontend, nunca enviados ao Firebase/Firestore).
- Reexport em `src/services/index.ts`.
- Sem `any`; TS strict.

---

## 3. In scope
- `src/services/auth.ts`:
  - `signIn(email: string, password: string): Promise<void>` → `await signInWithEmailAndPassword(firebaseAuth, email, password)`.
  - Tipo dedicado `SignUpInput = Pick<SignupFormValues, "name" | "nickname" | "email" | "password">` (deriva do schema da TASK-01, exclui `confirmPassword`/`acceptTerms`).
  - `signUp(payload: SignUpInput): Promise<void>`:
    1. `const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password)`.
    2. `try { await setDoc(doc(firestore, "users", user.uid), { uid: user.uid, name, nickname, email, role: "user", status: "pending", createdAt: new Date().toISOString() }) }`.
    3. `catch (error) { try { await deleteUser(user) } catch (rollbackError) { console.error(...rollbackError...) } throw error }` — relança o erro original do `setDoc`.
  - `signOut(): Promise<void>` → `await signOut(firebaseAuth)`.
- Reexport em `src/services/index.ts`: substituir `export {};` por `export { signIn, signUp, signOut } from "./auth";` (+ reexport do tipo `SignUpInput`).
- Tests em `src/services/__tests__/auth.test.ts`, mockando `firebase/auth`, `firebase/firestore` e `@/firebase` no mesmo estilo de `AuthProvider.test.tsx`.

## 4. Out of scope
- Tradução de erros Firebase→pt-BR (TASK-02, já existe `mapAuthError`); aqui os erros propagam crus.
- Promoção a admin / `role: "admin"` / `status: "approved"` (TASK-05, Cloud Function server-side).
- Persistência de `confirmPassword`/`acceptTerms` (validação client-only — TASK-01).
- Telas de Login/Cadastro e consumo via toast (TASK-07/08).
- `emailVerified`, recuperação de senha, unicidade de apelido (fora da PRD-01).

## 5. Main technical areas
- `src/services/auth.ts` (novo).
- `src/services/index.ts` (substitui o stub `export {}`).
- `src/features/auth/schemas.ts` (reuso de `SignupFormValues` — sem alteração).
- `src/firebase` (reuso de `firebaseAuth`, `firestore` — sem alteração).
- `src/services/__tests__/auth.test.ts` (novo).

## 6. Business rules and behavior
- **Client sempre grava `pending`/`user`:** as Security Rules forçam isso no `allow create` de `users/{uid}`. A promoção a admin é da TASK-05.
- **Atomicidade do cadastro (R2):** auth user + doc Firestore devem coexistir. Se o doc falhar, o auth user é removido para não deixar conta órfã (sem perfil).
- **Falha do rollback:** estado órfão inevitável → logar (`console.error`) para diagnóstico, mas relançar o erro original do `setDoc` (causa-raiz que a UI vai mapear).
- **createdAt:** ISO string (`new Date().toISOString()`), coerente com `userSchema.createdAt` (isoDateTime) e com `updatedAt` da TASK-05.
- **Sem tradução de erro:** os códigos `auth/*` chegam intactos à UI para `mapAuthError`.

## 7. Contracts and interfaces
```ts
export type SignUpInput = Pick<
  SignupFormValues,
  "name" | "nickname" | "email" | "password"
>;

export function signIn(email: string, password: string): Promise<void>;
export function signUp(payload: SignUpInput): Promise<void>;
export function signOut(): Promise<void>;
```
- Doc gravado em `users/{uid}`:
  `{ uid: string, name: string, nickname: string, email: string, role: "user", status: "pending", createdAt: string }`.

## 8. Data and persistence impact
- `signUp` cria conta no Firebase Auth e grava `users/{uid}` (1 doc).
- Rollback remove a conta de Auth se o doc não puder ser gravado.
- `signIn`/`signOut` não escrevem em Firestore.

## 9. Required tests (TDD — escritos antes da implementação)
Mock de `firebase/auth` (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `deleteUser`, `signOut`), `firebase/firestore` (`doc`, `setDoc`) e `@/firebase` (`firebaseAuth`, `firestore`):
- **T1 — signIn:** chama `signInWithEmailAndPassword(firebaseAuth, email, password)` com as credenciais; resolve.
- **T2 — signUp sucesso:** chama `createUserWithEmailAndPassword` e depois `setDoc` com `{ uid, name, nickname, email, role: "user", status: "pending", createdAt }`; `createdAt` é ISO válida; `deleteUser` NÃO é chamado.
- **T3 — signUp rollback:** `setDoc` rejeita → `deleteUser(user)` é chamado e o erro original do `setDoc` é relançado.
- **T4 — signUp rollback falha:** `setDoc` rejeita e `deleteUser` também rejeita → `console.error` é chamado e o erro **original** do `setDoc` (não o do rollback) é relançado.
- **T5 — signOut:** chama `signOut(firebaseAuth)`; resolve.
- **(opcional) T6 — signIn propaga erro:** `signInWithEmailAndPassword` rejeita → `signIn` rejeita com o mesmo erro (sem tradução).

## 10. Acceptance criteria
- [ ] `src/services/auth.ts` exporta `signIn`, `signUp`, `signOut` e o tipo `SignUpInput`.
- [ ] `signUp` usa `createUserWithEmailAndPassword` → `setDoc(users/{uid}, …)` com `role: "user"`, `status: "pending"`, `createdAt` ISO.
- [ ] Rollback via `deleteUser(user)` quando `setDoc` falha; em falha do rollback, `console.error` + relança erro original.
- [ ] `SignUpInput` derivado de `SignupFormValues` sem `confirmPassword`/`acceptTerms`.
- [ ] Reexport em `src/services/index.ts` (substitui `export {}`).
- [ ] Erros do Firebase propagam (sem tradução nesta camada).
- [ ] Sem `any`; TS strict.
- [ ] `npx vitest run src/services/__tests__/auth.test.ts` verde (T1–T5).
- [ ] `npx tsc --noEmit` limpo.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none (consumido por TASK-07/08).

## 12. Constraints
- Não usar `any` (CLAUDE.md regra 1).
- Services vivem em `src/services` e usam `firebaseAuth`/`firestore` do barrel `@/firebase`.
- Não traduzir erros aqui (responsabilidade da UI via `mapAuthError`).
- Cliente sempre grava `pending`/`user` (Security Rules exigem).
- Não commitar (revisão central).

## 13. Open questions
- Nenhuma. Forma do payload, rollback e formato de `createdAt` travados no plano (`ai/plan/auth.md` §3 TASK-06, R2).
