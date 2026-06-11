# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Endpoint admin de aprovação de grupo (`pending→active`/`blocked`) + troca de admin + seed

## 2. Objective
Mecanismo backend mínimo (decisão A2) para um **super_admin** transicionar o
`status` de um pool (`pending→active`/`blocked`, `active↔blocked`) e **trocar o
admin do pool** (`pools/{id}.adminId` + repromoção do novo admin a `group_admin`,
PRD §2.9), via Admin SDK. Mais um **seed idempotente** que cria/ativa o pool-semente
"Bolão dos Parças" (A3) para destravar testabilidade fim-a-fim (R5: sem caminho
`pending→active`, nenhum grupo fica `active` e a busca/detalhe fica vazia). Sem UI
(fica para PRD-11).

## 3. In scope
1. **`PATCH /api/admin/groups/[id]/status`** — transição de status do pool.
   - Body: `{ status: "active" | "blocked" }` (alvo).
   - Lê `pools/{id}.status` atual, valida a transição contra `poolStatusTransitionSchema`.
   - Escreve `status` + `updatedAt` via Admin SDK.
2. **`PATCH /api/admin/groups/[id]/admin`** — troca de admin do pool.
   - Body: `{ adminId: <uid> }` (novo dono).
   - Transação atômica: `pools/{id}.adminId = novo`; `users/{novo}.role = "group_admin"`;
     rebaixa o admin anterior a `participant` **se** ele ainda for `group_admin`.
3. **`src/schemas/poolStatusTransition.ts`** (novo) — `ALLOWED_POOL_STATUS_TRANSITIONS`,
   `poolStatusTransitionSchema`, `canTransitionPool(from, to)` — espelha
   `src/schemas/userStatusTransition.ts`.
4. **`scripts/seed-pools.ts`** (novo) — script Node idempotente que garante o pool-semente
   "Bolão dos Parças" (`slug: "bolao-dos-parcas"`, `status: "active"`). Doc-id = slug;
   re-rodar não duplica nem sobrescreve campos não gerenciados. Bootstrap do Admin SDK
   reusando a resolução de credencial existente. Entry em `package.json` (`seed:pools`).

Autorização (ambas as rotas): **secret header `x-admin-secret`** (`GROUPS_ADMIN_SECRET`,
via `safeSecretEqual`) **OU** sessão de **super_admin** (`requireApprovedUser` +
`isSuperAdminRole` sobre `users/{uid}.role`). Espelha o padrão de
`src/app/api/rankings/recalc/route.ts:76-106`, mas usa o helper `isSuperAdminRole`
(dupla-compat `admin`||`super_admin`) em vez de comparar `role === "admin"` cru.

## 4. Out of scope
- **UI de administração** (telas) — PRD-11.
- **Propagação da claim `group_admin`/`groupId`** nas custom claims — TASK-06.
  TASK-05 só escreve o campo `users/{uid}.role`; a sincronização da claim de
  `group_admin` (e `groupId`) é responsabilidade da TASK-06. Documentar o gap.
- **Recalc/re-scoping de ranking** — TASK-10.
- **Signup / seleção de grupo** — TASK-07.
- **Criação genérica de pools por seed** (múltiplos pools, fixtures de teste de carga) —
  só o pool-semente único.
- **Remoção do legado de role** — TASK-12.

## 5. Main technical areas involved
- `src/app/api/admin/groups/[id]/status/route.ts` (novo) — handler PATCH status.
- `src/app/api/admin/groups/[id]/admin/route.ts` (novo) — handler PATCH troca de admin.
- `src/schemas/poolStatusTransition.ts` (novo) + barrel `src/schemas/index.ts`.
- `scripts/seed-pools.ts` (novo) + `package.json` (script).
- Reuso: `requireApprovedUser`, `getAdminFirestore`, `getAdminAuth`, `safeSecretEqual`,
  `isSuperAdminRole`, `roleSchema`, `poolSchema`, `poolStatusSchema`, `SESSION_COOKIE_NAME`.

## 6. Business rules and behavior
**Transições de status permitidas** (espelha usuário):
```
pending → active, blocked
active  → blocked
blocked → active
```
- Transição não listada (ex.: `active → active`, `active → pending`) → **409**.
- Pool inexistente → **404**.
- Body inválido (status fora do enum / ausente) → **422**; JSON malformado → **400**.

**Troca de admin (PRD §2.9):**
- Novo admin (`adminId`) deve **existir** em `users/{uid}` e estar `status: "approved"` —
  senão **409** (`Usuário inválido para admin do grupo.`).
- Se `users/{novo}.groupId` estiver **presente**, deve ser igual ao `id` do pool — senão
  **409** (não promover admin de um membro de outro pool). Se ausente (legado/pré-migração),
  aceitar (dupla-compat).
- Transação: `pools/{id}.adminId ← novo`; `users/{novo}.role ← "group_admin"`,
  `users/{novo}.updatedAt`; admin anterior (`pools/{id}.adminId` antigo) → se
  `users/{antigo}.role === "group_admin"`, rebaixar para `participant` + `updatedAt`.
  Trocar pelo mesmo uid (novo == antigo) é no-op idempotente (mantém `group_admin`).
- `adminId` ausente/vazio no body → **422**.

**Autorização (ambas rotas):**
- `safeSecretEqual(process.env["GROUPS_ADMIN_SECRET"], request.headers.get("x-admin-secret"))`
  verdadeiro → autorizado (caminho cron/seed/admin script).
- Senão: `requireApprovedUser()`; se `errorResponse` → propaga (401/403). Depois lê
  `users/{uid}.role`, `roleSchema.safeParse`; se não `isSuperAdminRole` → **403**.
- Caller aprovado porém não-super_admin → **403** (`Acesso negado.`).

**Seed (`scripts/seed-pools.ts`):**
- Idempotente: usa doc-id = slug. Se o doc não existe, cria pool válido por `poolSchema`
  (`status: "active"`, `adminId` = uid informado por env `SEED_ADMIN_UID`, `createdAt` ISO).
  Se já existe, não sobrescreve (log "já existe"). Não falha em re-run.
- Valida o doc com `poolSchema` antes de escrever.

## 7. Contracts and interfaces
**`PATCH /api/admin/groups/[id]/status`**
- Req body: `{ status: "active" | "blocked" }`
- 200: `{ pool: Pool }` (estado atualizado)
- Erros: 400 / 401 / 403 / 404 / 409 (transição inválida) / 422 / 500

**`PATCH /api/admin/groups/[id]/admin`**
- Req body: `{ adminId: string }`
- 200: `{ pool: Pool }` (com novo `adminId`)
- Erros: 400 / 401 / 403 / 404 / 409 (usuário inválido / pool de outro / transição) / 422 / 500

**`src/schemas/poolStatusTransition.ts`**
```
ALLOWED_POOL_STATUS_TRANSITIONS = { pending: ["active","blocked"], active: ["blocked"], blocked: ["active"] }
poolStatusTransitionSchema  // refine: to ∈ ALLOWED[from]
canTransitionPool(from: PoolStatus, to: PoolStatus): boolean
```

Route handlers: `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`,
`import "server-only"`. Assinatura: `PATCH(request, ctx: { params: Promise<{ id: string }> })`.

## 8. Data and persistence impact
- Coleção `pools`: update parcial (`status`/`adminId` + `updatedAt`). **Nota:** `poolSchema`
  atual (TASK-02) **não** tem campo `updatedAt`. Decisão: gravar `updatedAt` como campo
  extra de auditoria **não** validado por `poolSchema` (o `.strict()` é aplicado só na
  leitura/criação do pool inteiro; o update parcial não revalida o doc completo). Alternativa
  se a leitura quebrar: ler com `poolSchema.safeParse` e dropar `updatedAt` antes do parse —
  **mas** isso é frágil; ver Open Questions §14.
- Coleção `users`: update de `role` (+`updatedAt`) do novo/antigo admin. Dispara o trigger
  `syncRoleClaimOnUserUpdate` (claim de `group_admin` só efetiva na TASK-06).
- Sem novos índices (lookup por doc-id).
- Troca de admin = **transação** (`db.runTransaction`) para consistência pool↔users.

## 9. Required tests
TDD (sonnet/high). Mockar `requireApprovedUser`, `getAdminFirestore`, `getAdminAuth`,
env secret. Cobrir:

**Status route:**
- pending→active autorizado (super_admin) → 200, grava `status:"active"`.
- pending→blocked → 200.
- active→blocked → 200; blocked→active → 200.
- transição inválida (active→pending / active→active) → 409, sem escrita.
- pool inexistente → 404.
- body sem `status` / status fora do enum → 422.
- não autenticado → 401; aprovado não-super_admin → 403.
- secret header válido (sem sessão) → autorizado 200.

**Admin-swap route:**
- troca válida → 200; grava `pools.adminId`, `users/{novo}.role="group_admin"`,
  rebaixa antigo para `participant`.
- novo admin inexistente ou não-approved → 409.
- novo admin com `groupId` de outro pool → 409.
- `adminId` ausente → 422; não-super_admin → 403.
- idempotente (novo == antigo) → 200, mantém `group_admin`.

**Transition schema:** `canTransitionPool` matriz válida/inválida (unit, sem I/O).

(Seed script: cobertura leve — sem teste de integração com Firestore real; validar que
o doc montado passa `poolSchema`. Não bloquear em emulador.)

## 10. Acceptance criteria
- As duas rotas existem, protegidas (secret OU super_admin via `isSuperAdminRole`), e
  retornam os contratos/§7.
- Transições de status seguem exatamente `ALLOWED_POOL_STATUS_TRANSITIONS`; inválidas → 409.
- Troca de admin é atômica e repromove o novo admin a `group_admin` (campo no doc).
- Seed idempotente deixa "Bolão dos Parças" `active`; re-run não duplica.
- `npx tsc --noEmit` limpo; `npx vitest run` (novos testes) verde; nenhuma regressão.

## 11. Constraints
- Writes **só** via Admin SDK (Route Handler/seed) — nunca Client SDK.
- Usar `isSuperAdminRole` (dupla-compat), **não** comparar `role === "admin"` cru.
- Erros tipados → mensagens pt-BR; a UI nunca vê status HTTP.
- TypeScript strict, sem `any`. Sem alterar o contrato `poolSchema` (TASK-02).
- Seed não commita segredos; credencial vem de env/`serviceAccountKey.json` (gitignored).
- Validar `id`/path — sem traversal (vem do segmento de rota, já isolado).
- Não tocar superfícies de autorização globais (middleware/guard) — isso é TASK-06.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Route Handlers admin + schema + script Node. Sem telas (UI = PRD-11).

## 14. Open questions
1. **`updatedAt` em `pools`:** `poolSchema` é `.strict()` sem `updatedAt`. Gravar o campo
   de auditoria fará a **leitura** subsequente via `poolSchema.parse` falhar (campo extra).
   Opções: (a) **adicionar `updatedAt?` opcional ao `poolSchema`** (toca contrato TASK-02 —
   mínimo e seguro); (b) não gravar `updatedAt` em pools; (c) ler com tolerância. **Recomendo
   (a)**: estender `poolSchema` com `updatedAt: isoDateTime.optional()` — alteração aditiva,
   não-breaking. Decidir no início do implement.
2. **Rebaixar admin anterior:** PRD §2.9 pede "troca". Rebaixar o antigo a `participant`
   assume 1 pool/admin (A7). Mantido como regra; se um usuário puder administrar >1 pool no
   futuro, revisitar (fora do escopo desta PRD).
