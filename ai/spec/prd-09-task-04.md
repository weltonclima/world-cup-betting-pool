# SPEC

## 1. Task id and title
- Task: TASK-04
- Title: Service + Route Handlers de pool (create / search / detail)

## 2. Objective
Expor a coleção `pools` (PRD-09) via API e camada de serviço, no padrão Read/Write split do projeto:
- `POST /api/groups` — cria pool **`pending`** via Admin SDK; `adminId` vem **sempre da sessão**; slug único garantido server-side (atômico).
- `GET /api/groups/search?q=` — lista pools **`active`** (busca por nome/slug). Nunca expõe `pending`/`blocked`.
- `GET /api/groups/[id]` — detalhe de um pool. `active` legível por qualquer aprovado; `pending`/`blocked` legível **só** pelo `adminId` dono ou super_admin (senão 404, sem vazar existência).
- `src/services/pools.ts` + hooks React Query da feature `groups`.

Rota usa "groups" (linguagem de UI); a coleção Firestore é **`pools`** (decisão A1 — evita colisão com `groups` do torneio). Erros tipados → mensagem pt-BR (padrão `PredictionServiceError`).

## 3. In scope
- **Route Handlers** (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `import "server-only"`):
  - `src/app/api/groups/route.ts` — `POST` (create).
  - `src/app/api/groups/search/route.ts` — `GET` (search).
  - `src/app/api/groups/[id]/route.ts` — `GET` (detail).
- **Service** `src/services/pools.ts`: `PoolServiceError` (status→pt-BR), `createPool`, `searchPools`, `getPool`. Leituras passam pelos Route Handlers via `fetch` (não Client SDK direto — ver §6, visibilidade do `pending` do próprio dono).
- **Hooks** `src/features/groups/hooks/`: `groupsKeys` (factory único), `useSearchGroups`, `useGroupDetail`, `useCreateGroup` (mutation → invalida `groupsKeys.search`), `index.ts` (barrel).
- **Slug uniqueness:** doc-id de `pools` = `slug`, gravado com `.create()` (falha atômica se já existir → 409). Mata a corrida R7 sem transação. `id` do doc = `slug`.
- **Testes** (vitest): route handlers (mock `@/server/firebaseAdmin` + `next/headers`) + service (mapeamento de erro).
- Reuso: `requireApprovedUser` (`src/server/auth/requireApprovedUser.ts`), `isSuperAdminRole` (`@/schemas/shared`), `poolInputSchema`/`poolSchema` (TASK-02), helpers de `_apiClient.ts` se úteis.

## 4. Out of scope
- ❌ Transição de status `pending→active`/`blocked` e troca de admin → **TASK-05** (sem TASK-05 nenhum pool vira `active`).
- ❌ Qualquer UI/tela (Criar/Buscar/Detalhe) → **TASK-08/09**.
- ❌ Injeção de seleção de grupo no signup / gravação de `groupId` no user → **TASK-07**.
- ❌ Migração de autorização de role / claim `groupId` → **TASK-06**.
- ❌ Compressão de imagem client-side (o endpoint só valida `photoBase64` por tamanho) → **TASK-08**.
- ❌ Busca server-side por nome com ranking/full-text — MVP é match simples (ver §6, A6).
- ❌ `memberCount` na **lista de busca** (N agregações) — ver §14 (aberto, deferido p/ TASK-09). Detalhe traz `memberCount` (1 contagem).
- ❌ Mexer na coleção/rota `groups` do torneio (`/api/worldcup/*`, `match /groups`).

## 5. Main technical areas involved
- `src/app/api/groups/route.ts`, `src/app/api/groups/search/route.ts`, `src/app/api/groups/[id]/route.ts` (novos).
- `src/services/pools.ts` (novo) — espelha `services/predictions.ts` (erro tipado + Read/Write split).
- `src/features/groups/hooks/*` (novo slice) — espelha `features/admin/hooks/usersKeys.ts` + mutation com invalidação.
- Reuso: `requireApprovedUser`, `getAdminFirestore`, `@/schemas` (`poolInputSchema`, `poolSchema`, `isSuperAdminRole`), `_apiClient` (`buildHttpError`/`parseWithId` se aplicável).

## 6. Business rules and behavior

### POST /api/groups (create)
1. `requireApprovedUser()` → `uid`. Falha → 401/403 (resposta pronta do helper).
2. Parse do body. `adminId` é **forçado = `uid` da sessão** (qualquer `adminId` do body é ignorado/sobrescrito antes do parse). Validar com `poolInputSchema` → 422 se inválido (`name`/`slug`/`description≤160`/`photoBase64≤700k`).
3. Gravar `pools/{slug}` com `docRef(slug).create({...})`:
   - `{ id: slug, name, slug, description?, photoBase64?, status: "pending", adminId: uid, createdAt: <ISO now> }`.
   - Validar o objeto final com `poolSchema` antes de gravar (defesa; mantém o contrato).
   - `.create()` lança se o doc já existe → **409** (`"Já existe um grupo com esse identificador (slug)."`). Mata R7 (duas criações simultâneas com mesmo slug — uma vence, a outra recebe 409).
4. Sucesso → **201** `{ pool: Pool }` (`status: "pending"`).
5. Falha de escrita inesperada → 500.

### GET /api/groups/search?q= (search)
1. `requireApprovedUser()` → 401/403.
2. Query Admin SDK: `pools where status == "active"` (**só ativos**; `pending`/`blocked` nunca retornam — espelha a intenção da rule TASK-03).
3. `q` (trim, opcional):
   - vazio/ausente → retorna todos os ativos (cap defensivo, ex. 50).
   - presente → filtrar in-memory: `slug === q` **OU** `name.toLowerCase().includes(q.toLowerCase())` (MVP A6 — match simples).
4. Cada doc validado por `poolSchema`; doc corrompido **não** derruba a lista (descartar + `console.error`, sem vazar erro).
5. **200** `{ pools: Pool[] }`. Sem `memberCount` (ver §14).

### GET /api/groups/[id] (detail)
1. `requireApprovedUser()` → `uid` (401/403).
2. Ler `pools/{id}`. Inexistente → **404** (`"Grupo não encontrado."`).
3. Validar por `poolSchema`. Corrompido → 500.
4. **Autorização de visibilidade:**
   - `status == "active"` → qualquer aprovado lê.
   - `status` em `pending`/`blocked` → ler `users/{uid}.role`; liberar **só** se `pool.adminId === uid` **OU** `isSuperAdminRole(role)` (dupla-compat `admin`||`super_admin`). Senão **404** (não revelar existência de pool não-ativo a terceiros).
5. `memberCount` = contagem de `users where groupId == id AND status == "approved"` (usa o índice composto `users(groupId,status)` criado na TASK-03; preferir `.count()` aggregation). Pré-backfill o valor pode ser 0 — aceitável.
6. **200** `{ pool: Pool, memberCount: number }`.

### Service (`pools.ts`)
- `PoolServiceError extends Error { status }`, com mapa `status→pt-BR` (espelha `PredictionServiceError`): 401/403/404/409/422/500 + fallback.
- `createPool(input)` → `POST /api/groups`, `credentials: "same-origin"`, retorna `Pool`.
- `searchPools(q?)` → `GET /api/groups/search`, retorna `Pool[]`.
- `getPool(id)` → `GET /api/groups/[id]`, retorna `{ pool: Pool, memberCount: number }`.
- Erro HTTP → lança `PoolServiceError`; falha de rede → `Error` genérico.

### Segurança transversal
- `uid`/`adminId` **sempre** da sessão, nunca do body (espelha predictions).
- Pools `pending`/`blocked` nunca vazam por search nem por detail a não-donos.
- Sem `..` em paths; `id`/`slug` validados pelo schema (regex slug).

## 7. Contracts and interfaces
Request body (POST) — cliente envia `{ name, slug, description?, photoBase64? }`; `adminId` ignorado se enviado.

Responses:
```
POST  /api/groups          201 { pool: Pool }
                           401 | 403 | 409 | 422 | 500 { error: string, issues? }
GET   /api/groups/search   200 { pools: Pool[] }                401 | 403
GET   /api/groups/[id]     200 { pool: Pool, memberCount: number }
                           401 | 403 | 404 | 500 { error: string }
```
Service types:
```ts
class PoolServiceError extends Error { readonly status: number }
function createPool(input: { name: string; slug: string; description?: string; photoBase64?: string }): Promise<Pool>
function searchPools(q?: string): Promise<Pool[]>
function getPool(id: string): Promise<{ pool: Pool; memberCount: number }>
```
Query keys:
```ts
groupsKeys = {
  all: ["groups"],
  search: (q: string) => ["groups", "search", q],
  detail: (id: string) => ["groups", "detail", id],
}
```

## 8. Data and persistence impact
- Sem migração. Escreve em `pools` (forma `poolSchema`, TASK-02) **só** via Admin SDK (Rules negam write client — TASK-03).
- Doc-id = `slug` → unicidade atômica via `.create()` (sem coleção de reserva, sem transação). `id` field == doc-id == `slug`.
- Detail usa agregação `count()` em `users(groupId,status)` — índice já declarado (TASK-03).
- Search lê `pools where status=="active"` — índice de campo único automático.

## 9. Required tests
TDD via vitest (`rtk vitest run`). Mock `@/server/firebaseAdmin` (`getAdminFirestore`) + `next/headers` (`cookies`) + `server-only`, no padrão de `predictions/__tests__/route.test.ts`.

**POST /api/groups:**
- 401 sem cookie; 403 usuário não aprovado.
- 422 body inválido (slug com maiúscula/`_`; name vazio; description >160; photoBase64 acima do limite).
- 201 happy: `status=="pending"`, `id==slug`, `createdAt` ISO presente.
- `adminId` vem da sessão — `adminId` do body é **ignorado** (gravado = uid da sessão).
- **409** slug duplicado (`.create()` lança `ALREADY_EXISTS`) — cobre R7.
- 500 quando `.create()` lança erro inesperado.

**GET /api/groups/search:**
- 401/403 guarda.
- retorna só `active` (pool `pending`/`blocked` no store **não** aparece).
- `q` filtra por slug exato e por `name` contém (case-insensitive); sem `q` → todos ativos.
- doc corrompido é descartado, não derruba a resposta.

**GET /api/groups/[id]:**
- 404 inexistente.
- `active` → aprovado lê (200 + `memberCount`).
- `pending` → dono (`adminId==uid`) lê; super_admin lê; terceiro aprovado → **404**.
- `memberCount` reflete contagem de aprovados com `groupId==id`.

**Service (`pools.test.ts`):**
- `createPool`/`searchPools`/`getPool` mapeiam status de erro → `PoolServiceError` com mensagem pt-BR correta; sucesso retorna o payload parseado.

## 10. Acceptance criteria
- Três Route Handlers existem e respeitam os status codes/contratos do §7.
- `POST` cria pool `pending` com `adminId` da sessão e slug único atômico (409 em colisão).
- `search` nunca retorna `pending`/`blocked`; `detail` esconde `pending`/`blocked` de não-donos (404).
- `src/services/pools.ts` expõe `createPool`/`searchPools`/`getPool` com erro tipado pt-BR.
- Hooks `groupsKeys`/`useSearchGroups`/`useGroupDetail`/`useCreateGroup` seguem o padrão do projeto (factory de keys + invalidação na mutation).
- `rtk vitest run` verde (novos testes de rota + service); `rtk tsc` sem erro; nenhum teste existente regrediu.
- Coleção/rota `groups` do torneio intacta.

## 11. Constraints
- `uid`/`adminId` sempre da sessão (nunca do body) — paridade com `predictions`.
- Write em `pools` só via Admin SDK (Rules negam client — TASK-03). Leitura via Route Handler (visibilidade do `pending` do dono exige Admin SDK; Rules bloqueiam `pending` no client).
- Mensagens de erro pt-BR pela camada de serviço; a UI nunca lida com status HTTP.
- TypeScript strict, sem `any`. Seguir naming/layering existentes; sem refactor não relacionado.
- Não tocar `/api/worldcup/*` nem `match /groups` (torneio).
- Tests fora de mudança de produção; sem inflar cobertura.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: API (Route Handlers) + camada de serviço + hooks de dados. Sem telas/componentes/estilo (UI é TASK-08/09). Hooks React Query são data-layer, não UI.

## 14. Open questions
- **`memberCount` na busca:** incluir contagem por item na lista de search exige N agregações `count()`. Deferido — `detail` traz `memberCount` (1 contagem). Se a Tela de busca (TASK-09) precisar do número por item, decidir lá entre (a) N counts com cap, (b) denormalizar `memberCount` no doc (mantido no signup TASK-07/aprovação TASK-05). Não bloqueia TASK-04.
- **doc-id = slug:** acopla `id == slug` (slug imutável na prática). Aceito para MVP (unicidade atômica grátis). Se no futuro o slug precisar mudar mantendo o id, migrar para id auto-gerado + doc de reserva `pool_slugs/{slug}`. Sem ambiguidade que impeça implementação segura agora.
