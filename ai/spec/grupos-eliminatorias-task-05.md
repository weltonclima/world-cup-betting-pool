# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Service + hooks React Query para groups e bracket

## 2. Objective
Camada de data access client para a fase de grupos e o chaveamento. Consome as rotas da TASK-04 (`GET /api/worldcup/groups`, `GET /api/worldcup/bracket`), revalida com Zod no client e expõe hooks TanStack Query com cache espelhado.

## 3. In scope
- `src/services/worldcup.ts`:
  - `WorldcupServiceError extends Error` — erro tipado com `status: number` + mensagem pt-BR (espelha `PredictionServiceError`).
  - `getGroups(): Promise<GroupsResponse>` — `fetch(\`${API_BASE}/worldcup/groups\`)`; erro HTTP → `WorldcupServiceError`; corpo revalidado por `groupsResponseSchema`.
  - `getBracket(): Promise<BracketResponse>` — idem contra `/worldcup/bracket` + `bracketResponseSchema`.
- `src/features/worldcup/hooks/`:
  - `worldcupKeys.ts` — factory de query-keys: `groups()=["groups"]`, `bracket()=["bracket"]`, `group(groupId)=["group", groupId]` (presente p/ contrato PRD; ver §6 desvio).
  - `useGroups()` — `useQuery` key `["groups"]`, `queryFn: getGroups`, `staleTime: STALE_TIME.grupos` (24h), `refetchInterval` 60s quando `data.hasLiveGroupMatch`.
  - `useGroupStandings(groupId)` — `useQuery` key `["groups"]` + `select` que fatia o `GroupTable` do `groupId` (mesma cache entry, sem fetch extra).
  - `useBracket()` — `useQuery` key `["bracket"]`, `queryFn: getBracket`, `staleTime: STALE_TIME.grupos` (24h).
  - `index.ts` — barrel.
- `src/services/index.ts` — reexporta `getGroups`, `getBracket`, `WorldcupServiceError`.
- Testes: `worldcup.test.ts` (service) + `__tests__/` dos hooks.

## 4. Out of scope
- UI / componentes (TASK-07, TASK-08). Abas (TASK-06).
- Alterar rotas TASK-04, schemas TASK-01, ou qualquer service existente.
- Endpoint por grupo (não existe — ver §6).

## 5. Main technical areas involved
- Novo `src/services/worldcup.ts`; reuso de `API_BASE` (`./_apiClient`).
- Novo `src/features/worldcup/hooks/*`; reuso de `STALE_TIME` (`@/server/cache/tiers`).
- Contratos: `groupsResponseSchema`/`bracketResponseSchema` + types `GroupsResponse`/`BracketResponse`/`GroupTable` (`@/schemas/worldcup`, `@/types`).

## 6. Business rules and behavior

### Service
- Sucesso (2xx): `res.json()` → `schema.parse(data)` → retorna tipado. ZodError propaga (defesa em profundidade; servidor já valida, client não confia cegamente na rede).
- Erro HTTP (não-2xx): lança `WorldcupServiceError(status, mensagemPtBr)`. Mensagem genérica pt-BR ("Não foi possível carregar a classificação dos grupos." / "...o chaveamento."), com tentativa best-effort de ler `{ error }` do corpo (tolerante a corpo não-JSON).
- Base relativa `API_BASE = "/api"` (browser resolve contra a origem; rotas são same-origin).

### Hooks
- `useGroups`: `staleTime` `STALE_TIME.grupos` (24h) — alinhado ao TTL da rota (TASK-04). `refetchInterval: (query) => query.state.data?.hasLiveGroupMatch ? 60_000 : false` — quando há jogo de grupo ao vivo, espelha o TTL dinâmico de 60s do servidor.
- `useGroupStandings(groupId)`: mesma query `["groups"]` + `select: (data) => data.groups.find((g) => g.groupId === groupId)` → `GroupTable | undefined`. **Decisão travada (plano §TASK-05):** `select` NÃO muda a query-key; não há cache entry `["group", groupId]` separada nem endpoint por grupo. A key `group(groupId)` fica no factory por fidelidade ao PRD, mas não é usada como cache entry — desvio documentado aqui.
- `useBracket`: `staleTime` `STALE_TIME.grupos` (24h). **Sem `refetchInterval`:** o body de `/worldcup/bracket` é `BracketResponse` puro (decisão TASK-04 §6 — `hasLiveGroupMatch` só no payload de groups). Sem flag no payload do bracket → não há gatilho de refetch ao vivo no client. Desvio documentado; revalidação fica a cargo do `staleTime` + invalidação manual.

## 7. Contracts and interfaces
- `getGroups(): Promise<GroupsResponse>` — `{ groups: GroupTable[], hasLiveGroupMatch: boolean }`.
- `getBracket(): Promise<BracketResponse>` — `{ roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final }`.
- `useGroups(): UseQueryResult<GroupsResponse>`.
- `useGroupStandings(groupId: string): UseQueryResult<GroupTable | undefined>`.
- `useBracket(): UseQueryResult<BracketResponse>`.
- `worldcupKeys.groups()` → `["worldcup", "groups"]`; `.bracket()` → `["worldcup", "bracket"]`; `.group(id)` → `["worldcup", "group", id]`. **Revisão BL-01:** o PRD pedia keys literais `["groups"]`/`["bracket"]`, mas a feature irmã `groups` (pool de apostas, PRD-09) já ocupa `["groups"]` (`groupsKeys.all`); como o React Query casa invalidação por prefixo no QueryClient compartilhado, manter o literal faria `invalidateQueries(["groups"])` (criação de pool) derrubar a classificação da Copa. Keys namespaced sob `["worldcup", …]` eliminam a colisão.

## 8. Data and persistence impact
- Nenhum. Só leitura via rotas existentes. Sem Firestore client, sem migration.

## 9. Required tests
- `src/services/__tests__/worldcup.test.ts` (mock global `fetch`):
  - `getGroups` 2xx → parseia e retorna `GroupsResponse`.
  - `getBracket` 2xx → parseia e retorna `BracketResponse`.
  - HTTP 500 → lança `WorldcupServiceError` com `status` correto.
  - corpo fora do contrato → lança (ZodError).
- `src/features/worldcup/hooks/__tests__/`:
  - `worldcupKeys` — keys estáveis (`["groups"]`, `["bracket"]`, `["group", id]`).
  - `useGroups` (mock service) → resolve dados; key correta.
  - `useGroupStandings` → `select` devolve o `GroupTable` do grupo pedido; `undefined` p/ grupo inexistente; compartilha a cache `["groups"]` (1 fetch para 2 hooks).
  - `useBracket` → resolve dados; key correta.
  - Wrapper `QueryClient` com `retry: false` (padrão `useUsers.test.tsx`).

## 10. Acceptance criteria
- `npx vitest run` integral verde, sem regressão.
- `npx tsc --noEmit` e eslint limpos.
- Service revalida com Zod; erros HTTP viram `WorldcupServiceError`.
- `useGroupStandings` reusa a cache `["groups"]` (zero fetch extra — comprovado em teste).
- `refetchInterval` de `useGroups` ativa só com `hasLiveGroupMatch: true`.
- Nenhum service/hook existente alterado (git diff não os toca, exceto barrel `services/index.ts`).

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, comentários pt-BR.
- Hooks `"use client"` (padrão `useMatches.ts`).
- Não introduzir dependência nova.
- Não duplicar `buildHttpError`/`parseWithId` desnecessariamente; mas erros aqui são `WorldcupServiceError` (não `Error` cru) — wrapper próprio fino.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true (data access client; sem render — track de UI não se aplica, sem ui-spec).
- reason: service + hooks React Query; sem componentes visuais.

## 14. Open questions
Nenhuma. Dois desvios do PRD travados e documentados em §6: (a) `["group", groupId]` não vira cache entry (select sobre `["groups"]`); (b) `useBracket` sem `refetchInterval` (payload bracket não carrega `hasLiveGroupMatch`).
