# SPEC — TASK-02: Service de usuários + schema de transição de status

> Entrada: `ai/plan/aprovacao-usuarios.md` (TASK-02) + `ai/prd/aprovacao-usuarios.md` (decisões §0: A1 rejeitar=`blocked`, A2 client SDK + rules, A5 desbloquear `blocked→approved`) + `.claude/CLAUDE.md` (stack Firebase, regras TS strict / sem `any`, services em `src/services`, schemas Zod em `src/schemas`, TanStack Query obrigatório para consultas) + `firestore.rules` (TASK-01, autoridade real de acesso).
> Tipo: `persistence / application` · Criticidade: `high` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: nenhuma (reusa `userSchema` e `firestore` existentes) — Wave 1.

> Nota de naming: segue a convenção de features pós-PRD-00 (`ai/{spec}/<feature>-task-NN.md`, ver MEMORY). Slot gravado como `ai/spec/aprovacao-usuarios-task-02.md` para não colidir com `ai/spec/task-02.md` (SPEC da TASK-02 da fundação PRD-00) nem com `ai/spec/auth-task-02.md`.

---

## 1. Task: TASK-02 — Service de usuários + schema de transição de status

## 2. Objetivo

Expor a camada de dados de usuários para o painel admin (telas 03/04/05 do PRD-01.2): **leitura por status** (`listUsersByStatus`) e **mutação de status server-validada** (`updateUserStatus`), ambas via Client SDK do Firestore (A2 — sem Cloud Function). Adicionar um **schema Zod das transições de status permitidas** como validação defensiva/UX antes da escrita. As funções são puras de Firestore (sem React, sem cache) — os hooks TanStack Query que as consomem ficam na TASK-03. A camada **propaga** os erros do Firebase crus (padrão de `services/auth.ts`); a tradução é responsabilidade da UI (TASK-07).

### Truths que devem ser verdadeiras ao fim
- `listUsersByStatus(status)` consulta a coleção `users` com `where("status", "==", status)` ordenado por `orderBy("createdAt")` e resolve `User[]`.
- Cada doc lido é parseado por `userSchema` (`.parse`) — leitura tipada, sem `any`; doc malformado faz a leitura falhar (propaga o `ZodError`).
- `updateUserStatus(uid, nextStatus)` faz `updateDoc(doc(firestore, "users", uid), { status, updatedAt })`, onde `updatedAt = new Date().toISOString()` (ISO 8601, coerente com `userSchema.updatedAt`/`isoDateTime`).
- O schema `statusTransitionSchema` aceita **apenas** `pending→approved`, `pending→blocked`, `approved→blocked`, `blocked→approved` e **rejeita** qualquer outro par (inclusive transições para o mesmo estado e o par inverso `approved→pending` etc.).
- Reexport de `listUsersByStatus`, `updateUserStatus` (e tipos públicos) no barrel `src/services/index.ts`.
- O service **não** traduz erros (padrão `services/auth.ts`).
- Sem `any`; TS strict.

---

## 3. In scope

### `src/services/users.ts` (novo)
- Tipo de leitura derivado do schema: `export type User = z.infer<typeof userSchema>` (ou reuso de um `User` já exportado por `@/schemas` se existir — ver §13).
- `listUsersByStatus(status: UserStatus): Promise<User[]>`:
  1. `const q = query(collection(firestore, "users"), where("status", "==", status), orderBy("createdAt"))`.
  2. `const snap = await getDocs(q)`.
  3. `return snap.docs.map((d) => userSchema.parse(d.data()))`.
  - `UserStatus` = `z.infer<typeof userStatusSchema>` (`"pending" | "approved" | "blocked"`), reusado de `@/schemas/shared`.
- `updateUserStatus(uid: string, nextStatus: UserStatus): Promise<void>`:
  1. `await updateDoc(doc(firestore, "users", uid), { status: nextStatus, updatedAt: new Date().toISOString() })`.
  - Escreve **apenas** `status` + `updatedAt` (alinhado com a rule da TASK-01 que libera só esses campos — R4 do plano).
  - **Não** chama o `statusTransitionSchema` internamente (ver decisão em §6); a validação de transição é aplicada na borda (hook/UI da TASK-03/07). A função em si é a primitiva de escrita.

### `src/schemas/userStatusTransition.ts` (novo) — schema de transição
- `statusTransitionSchema`: schema Zod que valida o par `{ from, to }` de status, aceitando apenas as 4 transições permitidas e rejeitando o resto.
- Reexportado no barrel `src/schemas/index.ts` (`export * from "./userStatusTransition";`).
- Forma sugerida (legível e exaustiva):
  ```ts
  export const ALLOWED_STATUS_TRANSITIONS = {
    pending: ["approved", "blocked"],
    approved: ["blocked"],
    blocked: ["approved"],
  } as const satisfies Record<UserStatus, readonly UserStatus[]>;

  export const statusTransitionSchema = z
    .object({ from: userStatusSchema, to: userStatusSchema })
    .refine(
      ({ from, to }) =>
        (ALLOWED_STATUS_TRANSITIONS[from] as readonly UserStatus[]).includes(to),
      { message: "Transição de status não permitida." },
    );

  export type StatusTransition = z.infer<typeof statusTransitionSchema>;
  ```
- Opcional (conveniência para a UI/hook, sem lançar): `export function canTransition(from: UserStatus, to: UserStatus): boolean` retornando `statusTransitionSchema.safeParse({ from, to }).success`.

### Barrels
- `src/services/index.ts`: acrescentar `export { listUsersByStatus, updateUserStatus, type User } from "./users";` (mantendo o reexport de `./auth`).
- `src/schemas/index.ts`: acrescentar `export * from "./userStatusTransition";`.

### Tests (TDD) — `src/services/__tests__/users.test.ts` e `src/schemas/__tests__/userStatusTransition.test.ts`
- Mockam `firebase/firestore` (`collection`, `query`, `where`, `orderBy`, `getDocs`, `doc`, `updateDoc`) e `@/firebase` (`firestore`), no estilo de `src/services/__tests__/auth.test.ts`.

## 4. Out of scope
- Hooks TanStack Query (`useUsersByStatus`, `useUpdateUserStatus`), contadores e invalidação de cache → **TASK-03**.
- Aplicar/forçar a validação de transição na escrita (a UI/hook decide qual ação dispara qual transição) → TASK-03/07.
- Firestore Security Rules (autoridade real de acesso, list/update por role) → **TASK-01**. Este service assume que as rules existem; a barreira de segurança não é responsabilidade da camada client.
- Tradução de erros Firebase→pt-BR e toasts → **TASK-07** (UI mapeia `permission-denied` etc.).
- Paginação / contagem agregada (`<100 usuários`, listagem simples basta — PRD §4 CONCERNS).
- Promoção de `role` (fora de banda, Cloud Function/console — B1).
- Realtime / `onSnapshot` (leitura é por query/refetch — PRD §4).

## 5. Main technical areas
- `src/services/users.ts` (novo).
- `src/services/index.ts` (acrescenta reexport).
- `src/schemas/userStatusTransition.ts` (novo).
- `src/schemas/index.ts` (acrescenta reexport).
- `src/schemas/users.ts` (reuso de `userSchema` — sem alteração).
- `src/schemas/shared.ts` (reuso de `userStatusSchema`/`isoDateTime` — sem alteração).
- `src/firebase` (reuso de `firestore` do barrel `@/firebase` — sem alteração).
- `src/services/__tests__/users.test.ts` + `src/schemas/__tests__/userStatusTransition.test.ts` (novos).

## 6. Business rules and behavior
- **Transições permitidas (A1/A5):** `pending→approved` (Aprovar), `pending→blocked` (Rejeitar = blocked, A1), `approved→blocked` (Bloquear), `blocked→approved` (Desbloquear, A5). Qualquer outro par é inválido — inclusive no-op (`x→x`) e reversões não previstas (`approved→pending`, `blocked→pending`).
- **`updatedAt` na escrita (R4):** `updateUserStatus` grava `status` **e** `updatedAt` (ISO). A rule da TASK-01 deve liberar exatamente esse conjunto de campos; escrever `updatedAt` é intencional e deve estar alinhado com TASK-01, senão a escrita legítima é negada.
- **Validação é defensiva/UX, não barreira:** `statusTransitionSchema` melhora a experiência e previne disparos inválidos no client, mas a autoridade de segurança são as Security Rules (TASK-01). Por isso `updateUserStatus` **não** embute o schema: mantém-se primitiva e testável; a borda (hook/ação) valida a transição antes de chamar. (Decisão registrada: evita acoplar a primitiva de escrita à máquina de transição e duplicar a checagem feita pela UI; se preferir defesa extra na primitiva, validar `{ from, to }` exige ler o estado atual — fora do contrato mínimo desta task.)
- **Parse de leitura:** `userSchema.parse` em cada doc garante tipagem forte e rejeita doc fora do schema (`.strict()`). Falha de parse propaga (não há fallback silencioso).
- **Ordenação:** `orderBy("createdAt")` (ascendente) — `createdAt` é ISO string gravada no signup; ordena os mais antigos primeiro (a UI/TASK-06 define a apresentação). Requer índice composto trivial `status ASC, createdAt ASC` no Firestore se o emulator/console exigir (igualdade + orderBy em campo distinto pode exigir índice — anotar como possível ação de infra).
- **Sem tradução de erro:** erros do Firestore (`permission-denied`, `unavailable`, índice ausente…) propagam crus para a UI (TASK-07) traduzir.

## 7. Contracts and interfaces
```ts
// src/services/users.ts
import type { z } from "zod";
import { userSchema } from "@/schemas/users";
import type { userStatusSchema } from "@/schemas/shared";

export type User = z.infer<typeof userSchema>;
type UserStatus = z.infer<typeof userStatusSchema>;

export function listUsersByStatus(status: UserStatus): Promise<User[]>;
export function updateUserStatus(uid: string, nextStatus: UserStatus): Promise<void>;
```
```ts
// src/schemas/userStatusTransition.ts
export const ALLOWED_STATUS_TRANSITIONS: Record<UserStatus, readonly UserStatus[]>;
export const statusTransitionSchema: z.ZodType<{ from: UserStatus; to: UserStatus }>;
export type StatusTransition = { from: UserStatus; to: UserStatus };
export function canTransition(from: UserStatus, to: UserStatus): boolean; // opcional
```
- Doc atualizado em `users/{uid}`: merge parcial `{ status: UserStatus, updatedAt: string /* ISO */ }`.

## 8. Data and persistence impact
- **Leitura:** 1 query em `users` por chamada (`where status == <status>`, `orderBy createdAt`). Sem cache aqui (cache é da TASK-03/TanStack Query).
- **Escrita:** 1 `updateDoc` parcial em `users/{uid}` por chamada — apenas `status` + `updatedAt`. Não cria nem deleta docs (Rejeitar = `blocked`, A1 — sem delete).
- **Índice:** possível necessidade de índice composto `status, createdAt` (Firestore) — anotar p/ TASK-01/infra se o emulator reclamar.
- Nenhuma escrita em Firebase Auth.

## 9. Required tests (TDD — escritos antes da implementação)

### `src/schemas/__tests__/userStatusTransition.test.ts`
- **T1 — transições válidas:** `statusTransitionSchema.safeParse` retorna `success: true` para os 4 pares: `pending→approved`, `pending→blocked`, `approved→blocked`, `blocked→approved`.
- **T2 — transições inválidas:** retorna `success: false` para, no mínimo, `approved→pending`, `blocked→pending`, `approved→approved`, `pending→pending`, `blocked→blocked`, `approved→blocked` válido vs `blocked→approved` válido (garantir simetria correta) — e qualquer par fora da tabela.
- **T3 — enum:** `from`/`to` fora de `userStatusSchema` (ex.: `"deleted"`) falha o parse.
- **(opcional) T4 — `canTransition`:** espelha `safeParse().success` para os mesmos casos.

### `src/services/__tests__/users.test.ts` (mock de `firebase/firestore` + `@/firebase`)
- **T5 — listUsersByStatus monta a query:** chama `collection(firestore, "users")`, `where("status", "==", status)`, `orderBy("createdAt")`, `getDocs(q)`; resolve com os docs parseados por `userSchema`.
- **T6 — listUsersByStatus parseia:** dado um snapshot com docs válidos, retorna `User[]` com os campos esperados; um doc inválido (fora do `userSchema`) faz a Promise rejeitar (propaga `ZodError`).
- **T7 — updateUserStatus escreve status + updatedAt:** chama `updateDoc(doc(firestore,"users",uid), { status: nextStatus, updatedAt })` com `updatedAt` ISO válida; resolve `void`.
- **T8 — propagação de erro:** `getDocs`/`updateDoc` rejeitam → a função rejeita com o **mesmo** erro (sem tradução).

## 10. Acceptance criteria
- [ ] `src/services/users.ts` exporta `listUsersByStatus`, `updateUserStatus` e o tipo `User`.
- [ ] `listUsersByStatus(status)` usa `where("status","==",status)` + `orderBy("createdAt")` e parseia cada doc com `userSchema`.
- [ ] `updateUserStatus(uid, next)` faz `updateDoc` de **apenas** `status` + `updatedAt` (ISO).
- [ ] `src/schemas/userStatusTransition.ts` exporta `statusTransitionSchema` aceitando só as 4 transições e rejeitando o resto.
- [ ] Reexport em `src/services/index.ts` e `src/schemas/index.ts`.
- [ ] Camada não traduz erros (padrão de `services/auth.ts`).
- [ ] Reuso de `userSchema`/`userStatusSchema` (sem redefinir enums).
- [ ] Sem `any`; TS strict.
- [ ] `npx vitest run src/services/__tests__/users.test.ts src/schemas/__tests__/userStatusTransition.test.ts` verde (T1–T8).
- [ ] `npx tsc --noEmit` limpo.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none (consumido por TASK-03 → TASK-06/07).

## 12. Constraints
- Não usar `any` (CLAUDE.md regra 1).
- Services vivem em `src/services` e usam `firestore` do barrel `@/firebase`; schemas em `src/schemas`.
- Não traduzir erros nesta camada (UI mapeia — TASK-07).
- Validação Zod obrigatória (CLAUDE.md regra 4/5) — `statusTransitionSchema` + parse de leitura via `userSchema`.
- `updatedAt` deve ser ISO (`new Date().toISOString()`), coerente com `isoDateTime`/`userSchema`.
- A escrita deve gravar somente `status` + `updatedAt` (alinhar com rule da TASK-01 — R4).
- date-fns só formata datas na UI; o service grava ISO cru (não formatar aqui).
- Não commitar (revisão central).

## 13. Open questions
- **Reuso de tipo `User`:** se `@/schemas` já exportar um `User`/`UserDoc` derivado de `userSchema`, reusar em vez de redeclarar (evitar tipo duplicado). Caso contrário, exportar `User = z.infer<typeof userSchema>` em `users.ts`.
- **Índice composto `status + createdAt`:** confirmar se o Firestore exige índice (igualdade + orderBy em campo distinto). Se sim, registrar como item de infra (TASK-01/`firestore.indexes.json`).
- **`from` em `updateUserStatus`:** a primitiva não recebe `from` (não lê o estado atual); a transição é validada na borda (TASK-03/07). Confirmar que isso é aceitável vs. validar `{ from, to }` dentro do service (exigiria leitura prévia do doc).
