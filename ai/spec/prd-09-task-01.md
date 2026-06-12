# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Evolução do enum de role (dupla-compat) + `groupId` opcional no usuário

## 2. Objective
Reescrever `roleSchema` para o vocabulário novo `participant | group_admin | super_admin` **sem quebrar** o parse de documentos legados (`user`, `admin`), e adicionar `groupId` **opcional** ao `userSchema`. Entregar helpers de normalização de role (`isSuperAdminRole`, `isGroupAdminRole`, `isParticipantRole`) como única fonte de verdade para checagem de papel — substituindo comparações de string cruas em tasks posteriores.

Esta task é **só de contrato** (Zod + types + helpers puros). Nenhuma autorização muda (isso é TASK-06). `groupId` **não** vira obrigatório (isso é TASK-12).

## 3. In scope
- `roleSchema` aceita 5 valores: `participant`, `group_admin`, `super_admin` (canônicos) + `user`, `admin` (legados).
- `userSchema`: novo campo `groupId?: string` (opcional), `.strict()` preservado.
- Helpers puros de role (em `src/schemas/shared.ts` ou módulo dedicado co-localizado):
  - `isSuperAdminRole(role): boolean` → `true` para `admin` **ou** `super_admin`.
  - `isGroupAdminRole(role): boolean` → `true` para `group_admin`.
  - `isParticipantRole(role): boolean` → `true` para `user` **ou** `participant`.
- Type `Role` (`src/types/shared.ts`) e `User` (`src/types/users.ts`) derivados refletem os novos valores/campo.
- Testes de schema e helpers.

## 4. Out of scope
- ❌ Qualquer mudança de comportamento de autorização (middleware, guard, verifySession, functions, route handlers) → **TASK-06**.
- ❌ Sincronização de claim `groupId` → **TASK-06**.
- ❌ Tornar `groupId` obrigatório / remover aceite legado → **TASK-12**.
- ❌ Schema/coleção `pools` → **TASK-02**.
- ❌ Firestore rules / índices → **TASK-03**.
- ❌ Wiring dos helpers nas superfícies de role (só criá-los aqui; consumo é TASK-06).
- ❌ Transform/reescrita do valor de role armazenado (mantém valor cru; remap é TASK-12).

## 5. Main technical areas involved
- `src/schemas/shared.ts` — `roleSchema` (expandir enum) + helpers.
- `src/schemas/users.ts` — campo `groupId?`.
- `src/types/shared.ts` — type `Role` derivado.
- `src/types/users.ts` — type `User` derivado (automático via `z.infer`).
- `src/schemas/__tests__/shared.test.ts` — casos de role + helpers.
- `src/schemas/__tests__/users.test.ts` — parse com/sem `groupId`, legado.

## 6. Business rules and behavior
- **Dupla-compat (não-negociável):** doc de usuário legado `{ role: "admin", … }` (sem `groupId`) **deve** continuar passando `userSchema.parse`. Mesmo para `role: "user"`. Quebrar isso = recalc/admin/login dos usuários atuais quebram (R4).
- **Sem mutação de valor:** `roleSchema` valida mas **não transforma** `admin`→`super_admin`. O valor cru é preservado; a equivalência semântica vive nos helpers. (O remap físico é TASK-12.)
- **Semântica dos helpers:**
  - `super_admin` ≡ `admin` (privilégio global legado).
  - `participant` ≡ `user` (usuário comum).
  - `group_admin` é **novo**, sem equivalente legado.
- Helpers são **puros e totais**: recebem um `Role` válido e retornam `boolean`; nunca lançam.
- `groupId`, quando presente, é `nonEmptyString` (não aceitar string vazia).

## 7. Contracts and interfaces
```ts
// src/schemas/shared.ts
export const roleSchema = z.enum([
  // canônicos (PRD-09)
  "participant",
  "group_admin",
  "super_admin",
  // legados (dupla-compat — removidos na TASK-12)
  "user",
  "admin",
]);

export function isSuperAdminRole(role: Role): boolean;   // admin | super_admin
export function isGroupAdminRole(role: Role): boolean;   // group_admin
export function isParticipantRole(role: Role): boolean;  // user | participant
```
```ts
// src/schemas/users.ts — userSchema (acréscimo)
groupId: nonEmptyString.optional(), // pool do usuário; opcional na transição, obrigatório na TASK-12
```
```ts
// src/types/shared.ts
export type Role = z.infer<typeof roleSchema>;
// src/types/users.ts  (sem mudança de código — z.infer propaga groupId?)
export type User = z.infer<typeof userSchema>;
```

## 8. Data and persistence impact
- Nenhuma migração nesta task. `groupId` opcional = leitura/escrita de docs antigos sem o campo continua válida.
- Nenhum índice (TASK-03). Nenhuma rule (TASK-03).
- Persistência inalterada: docs `users/{uid}` existentes permanecem válidos.

## 9. Required tests
TDD recomendado (mapeamento legado↔novo é regression-sensitive). Cobrir:
- `roleSchema` aceita os 5 valores (`participant`, `group_admin`, `super_admin`, `user`, `admin`); rejeita `root`/`""`/inválidos.
- `isSuperAdminRole`: `true` para `admin` e `super_admin`; `false` para `user`/`participant`/`group_admin`.
- `isGroupAdminRole`: `true` só para `group_admin`; `false` para os outros 4.
- `isParticipantRole`: `true` para `user` e `participant`; `false` para `admin`/`super_admin`/`group_admin`.
- `userSchema` parse **legado**: `{ role:"admin", … sem groupId }` → success. `{ role:"user", … }` → success.
- `userSchema` parse **novo**: `{ role:"participant", groupId:"abc", … }` → success.
- `userSchema`: `groupId:""` → falha (nonEmptyString). `groupId` ausente → success.
- `.strict()` mantido: campo extra desconhecido → falha.
- Type-level (`expectTypeOf`): `Role` inclui os 5 literais; `User["groupId"]` é `string | undefined`.

## 10. Acceptance criteria
- `roleSchema` parseia os 5 valores; helpers retornam a classificação correta para todos.
- Doc de usuário legado (`role:"admin"`/`"user"`, sem `groupId`) ainda parseia — provado por teste.
- `userSchema` aceita `groupId` opcional `nonEmptyString`; rejeita vazio; mantém `.strict()`.
- `Role`/`User` types atualizados; `tsc --noEmit` limpo.
- `npm test` verde em `shared.test.ts` + `users.test.ts`; `lint` limpo.
- Nenhuma superfície de autorização tocada (grep de `=== "admin"` inalterado fora de schemas).

## 11. Constraints
- Schemas Zod = fonte única de verdade; types via `z.infer` (não declarar types à mão).
- Zod 4: não usar `z.intersection`/`.and` em contratos com `.refine` (refine some — convenção do projeto, `_apiClient.ts`).
- pt-BR em comentários/domínio.
- Não comparar role por string crua em código novo — usar/expor helpers (consumo só na TASK-06, mas a API já nasce aqui).
- Mudança é breaking de contrato controlada pela dupla-compat — manter os 5 valores até TASK-12.

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Contrato Zod + types + helpers puros. Sem telas/componentes/interação.

## 14. Open questions
- **Localização dos helpers:** `shared.ts` (junto do `roleSchema`) vs módulo dedicado `src/schemas/roleHelpers.ts`. Default do spec: **em `shared.ts`** (co-locação com o enum, menor superfície de import). Implementação pode extrair se crescer. Não bloqueia.
- Nenhuma ambiguidade que bloqueie implementação segura.
