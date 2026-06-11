# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Schema e types do pool (coleção `pools`)

## 2. Objective
Criar o contrato Zod da coleção `pools` (grupo de bolão / "pool") — `poolSchema` + `poolStatusSchema` + type `Pool` derivado — com as validações de campo: `slug` em `^[a-z0-9-]+$`, `description` ≤ 160 chars, `photoBase64` opcional bem abaixo do limite de 1 MB do doc Firestore, `status` em `pending | active | blocked`. Resolve a colisão de nomes R2: `pools` (bolão) ≠ `groups` (grupos do torneio Copa). Esta task é **só de contrato** (Zod + type + validações). Sem persistência, sem endpoints, sem rules.

## 3. In scope
- `src/schemas/pools.ts` (novo):
  - `poolStatusSchema = z.enum(["pending", "active", "blocked"])`.
  - `poolSchema` (`.strict()`) com os campos: `id`, `name`, `slug`, `description?`, `photoBase64?`, `status`, `adminId`, `createdAt`.
  - `poolInputSchema` (input de criação, sem campos definidos pelo servidor): `name`, `slug`, `description?`, `photoBase64?`, `adminId`. (`id`/`status`/`createdAt` são server-set — espelha o par `notificationSchema`/`notificationInputSchema`.)
- `src/types/pools.ts` (novo): `Pool`, `PoolStatus`, `PoolInput` via `z.infer` (não declarar à mão).
- `src/schemas/index.ts`: adicionar `export * from "./pools";` no barrel.
- `src/schemas/__tests__/pools.test.ts` (novo): casos de validação de campo + inferência de tipo.

## 4. Out of scope
- ❌ Persistência / serviço / Route Handlers de pool → **TASK-04**.
- ❌ Firestore rules / índices de `pools` → **TASK-03**.
- ❌ Endpoint admin de aprovação (`pending→active`) / troca de admin / seed → **TASK-05**.
- ❌ Compressão de imagem client-side (o schema apenas valida o tamanho do base64; gerar/comprimir é TASK-08).
- ❌ Qualquer mudança em `users`/`groupId` (foi TASK-01) ou em ranking.
- ❌ Renomear/mexer na coleção `groups` (torneio) — permanece intacta.

## 5. Main technical areas involved
- `src/schemas/pools.ts` — novo schema + enum + input.
- `src/types/pools.ts` — types derivados.
- `src/schemas/index.ts` — barrel.
- `src/schemas/__tests__/pools.test.ts` — testes de schema.
- Referência de estilo: `src/schemas/notifications.ts` (par schema/input + id/createdAt server-set), `src/schemas/users.ts` (`.strict()`, primitivos de `shared`).

## 6. Business rules and behavior
- **`slug`:** apenas minúsculas, dígitos e hífen (`^[a-z0-9-]+$`); não-vazio (o regex já rejeita `""`). Unicidade é responsabilidade do servidor (TASK-04), **não** do schema.
- **`description`:** opcional; quando presente, ≤ 160 caracteres. (Cosmético — não exige não-vazio.)
- **`photoBase64`:** opcional; string base64 (compat Firebase Spark — sem Storage). Deve caber **bem abaixo** do limite de 1 MB por doc do Firestore. Validar limite máximo de tamanho (constante documentada, ex.: `MAX_POOL_PHOTO_BASE64_LENGTH` ≈ 700 000 chars ≈ ~512 KB binário) para impedir doc que estoure a cota. O schema **valida tamanho**, não gera/comprime a imagem.
- **`status`:** `pending` (recém-criado, não aparece na busca) · `active` (disponível para cadastro) · `blocked` (não aceita novos membros). Sem transição/lógica de status aqui — só o enum.
- **`adminId`:** referência a `users.uid` (`nonEmptyString`); não validar existência (sem acesso a dados nesta task).
- **`createdAt`:** ISO 8601 (`isoDateTime` de `shared`, com offset).
- **`.strict()`:** rejeitar campo extra desconhecido (consistência com as outras 9 coleções).

## 7. Contracts and interfaces
```ts
// src/schemas/pools.ts
export const poolStatusSchema = z.enum(["pending", "active", "blocked"]);

// regex de slug (minúsculas/dígitos/hífen); unicidade é server-side (TASK-04)
export const poolSlugSchema = z.string().regex(/^[a-z0-9-]+$/);

export const MAX_POOL_PHOTO_BASE64_LENGTH = 700_000; // ~512 KB binário, << 1 MB doc

export const poolSchema = z
  .object({
    id: nonEmptyString,                 // = id do doc
    name: nonEmptyString,
    slug: poolSlugSchema,
    description: z.string().max(160).optional(),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
    status: poolStatusSchema,
    adminId: nonEmptyString,            // referência users.uid (criador/admin do pool)
    createdAt: isoDateTime,
  })
  .strict();

// Input de criação (id/status/createdAt definidos na escrita pelo servidor — TASK-04)
export const poolInputSchema = z.object({
  name: nonEmptyString,
  slug: poolSlugSchema,
  description: z.string().max(160).optional(),
  photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
  adminId: nonEmptyString,
});
```
```ts
// src/types/pools.ts
export type PoolStatus = z.infer<typeof poolStatusSchema>;
export type Pool = z.infer<typeof poolSchema>;
export type PoolInput = z.infer<typeof poolInputSchema>;
```

## 8. Data and persistence impact
- Nenhuma migração, índice ou rule nesta task (índices e rules são TASK-03).
- Define a **forma** do doc `pools/{id}` que TASK-03/04/05 vão persistir; `pools/{id}.id` == id do doc (padrão das outras coleções).
- `photoBase64` inline mantém o doc abaixo de 1 MB por construção (limite validado no schema) — compat Spark.

## 9. Required tests
TDD recomendado (regex de slug, limite de descrição/foto, enum de status são regression-sensitive). Cobrir:
- `poolSchema` faz parse de um pool válido completo (todos os campos).
- `poolSchema` faz parse com `description`/`photoBase64` ausentes (opcionais).
- `slug`: aceita `bolao-dos-parcas`, `pool-1`, `abc123`; rejeita `Bolao` (maiúscula), `pool_1` (underscore), `pool 1` (espaço), `""` (vazio).
- `description`: aceita 160 chars; rejeita 161 chars.
- `photoBase64`: aceita string dentro do limite; rejeita acima de `MAX_POOL_PHOTO_BASE64_LENGTH`.
- `status`: aceita `pending`/`active`/`blocked`; rejeita `deleted`/`""`.
- `.strict()`: campo extra desconhecido → falha.
- `adminId`/`name`/`id` vazios → falha (`nonEmptyString`).
- `createdAt` não-ISO → falha.
- `poolInputSchema`: aceita input válido sem `id`/`status`/`createdAt`; rejeita se incluir `id`/`status`/`createdAt`? (não — `z.object` sem `.strict()` ignora extras; documentar que input **não** é strict, igual `notificationInputSchema`).
- Type-level (`expectTypeOf`): `PoolStatus` = `"pending" | "active" | "blocked"`; `Pool["description"]` = `string | undefined`; `Pool["photoBase64"]` = `string | undefined`.

## 10. Acceptance criteria
- `poolSchema`/`poolStatusSchema`/`poolInputSchema` existem em `src/schemas/pools.ts`, reexportados no barrel.
- `Pool`/`PoolStatus`/`PoolInput` em `src/types/pools.ts` via `z.infer`; `tsc --noEmit` limpo.
- Todas as validações de campo provadas por teste (slug regex, description ≤160, photoBase64 ≤ limite, status enum, `.strict`).
- `npm test` verde em `pools.test.ts`; `lint` limpo.
- Coleção `groups` (torneio) inalterada.

## 11. Constraints
- Schemas Zod = fonte única de verdade; types via `z.infer` (não declarar types à mão).
- Zod 4: não usar `z.intersection`/`.and` com `.refine` (convenção do projeto, `_apiClient.ts`).
- Reusar primitivos de `@/schemas/shared` (`nonEmptyString`, `isoDateTime`) — não redeclarar.
- pt-BR em comentários/domínio; slug em inglês minúsculo é valor de armazenamento (consistente com os outros enums).
- `.strict()` no doc schema (não no input, espelhando `notificationInputSchema`).
- Não tocar `groups.ts` nem renomear coleções existentes.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Contrato Zod + types + validações de campo. Sem telas/componentes/interação.

## 14. Open questions
- **Limite exato de `photoBase64`:** o spec fixa `MAX_POOL_PHOTO_BASE64_LENGTH ≈ 700 000` (~512 KB) por segurança sob o teto de 1 MB do doc (que ainda carrega name/slug/description/etc.). Implementação pode ajustar a constante se o padrão de compressão de avatar (TASK-08) indicar outro alvo — não bloqueia o contrato.
- Nenhuma ambiguidade que bloqueie implementação segura.
