# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Service + hooks React Query (worldcup)

## 2. Objective
Camada de data-access client p/ as rotas `/api/worldcup/{groups,bracket}`: service com revalidação Zod + hooks TanStack Query com keys do PRD e cache espelhado.

## 3. In scope
- `src/services/worldcup.ts`:
  - `getGroups(): Promise<GroupsResponse>` — `GET /api/worldcup/groups`, revalida com `groupsResponseSchema`.
  - `getBracket(): Promise<BracketResponse>` — `GET /api/worldcup/bracket`, revalida com `bracketResponseSchema`.
- `src/features/worldcup/hooks/`:
  - `worldcupKeys.ts` — factory de keys (PRD: `["groups"]`, `["group", groupId]`, `["bracket"]`).
  - `useGroups.ts` — `useGroups()` (key `worldcupKeys.groups()` = `["groups"]`).
  - `useGroupStandings.ts` — `useGroupStandings(groupId)` derivada de `useGroups` via `select` (slice do grupo). Ver decisão §6.
  - `useBracket.ts` — `useBracket()` (key `["bracket"]`).
  - `index.ts` barrel.
- Export de `getGroups`/`getBracket` no barrel `src/services/index.ts` (seguir padrão existente).
- Testes co-localizados de service + hooks.

## 4. Out of scope
- UI/componentes (TASK-06/07/08). Rotas/cache (TASK-04 fechada). Contratos (TASK-01).

## 5. Main technical areas involved
- `src/services/worldcup.ts` (reuso `API_BASE`, `buildHttpError` de `_apiClient`; **não** usa `parseWithId` — respostas são objetos, não arrays de itens com id injetado).
- `src/features/worldcup/hooks/*`.
- Reuso `STALE_TIME` (`@/server/cache/tiers`).

## 6. Business rules and behavior
1. **Service:** `fetch(\`${API_BASE}/worldcup/groups\`)`; `!res.ok` → `throw await buildHttpError(res, "Falha ao carregar a classificação dos grupos")` (mensagem pt-BR; o corpo `{error}` da rota é anexado). Sucesso → `groupsResponseSchema.parse(await res.json())` (revalidação defesa-em-profundidade, espelha `matches.ts`). Idem bracket com `bracketResponseSchema` e mensagem "Falha ao carregar o chaveamento".
2. **Erro:** lançar `Error` puro (consistente com `matches.ts` vizinho; **não** criar classe `WorldcupServiceError` — desvio consciente do plano p/ alinhar ao padrão do módulo irmão; o plano mencionou a classe mas `matches.ts`/`teams.ts` não a usam).
3. **Keys (PRD literais):** `groups: () => ["groups"]`, `group: (groupId) => ["group", groupId]`, `bracket: () => ["bracket"]`. Factory `as const`.
4. **useGroups:** `useQuery({ queryKey: worldcupKeys.groups(), queryFn: getGroups, staleTime: STALE_TIME.grupos })` (24h). `refetchInterval`: quando `data?.hasLiveGroupMatch` → `60_000`, senão `false`.
5. **useGroupStandings(groupId):** mesma query base (`queryKey: worldcupKeys.groups()`, `queryFn: getGroups`) + `select: (data) => data.groups.find(g => g.groupId === groupId) ?? null`. **Decisão travada (plan-checker):** a key `["group", groupId]` do PRD **não** vira cache entry separada — `select` não altera a key; é um seletor memoizado sobre `["groups"]`. `worldcupKeys.group(groupId)` existe na factory p/ fidelidade ao PRD mas **não** é usada como queryKey aqui (documentar no JSDoc). Retorno: `UseQueryResult<GroupTable | null>`. `refetchInterval` idem useGroups (deriva de `data` pré-select? não — `refetchInterval` recebe a query; usar callback que olha `query.state.data?.hasLiveGroupMatch` no objeto base; **atenção:** com `select`, `data` no callback é o transformado. Usar a forma `refetchInterval: (query) => query.state.data` — checar a fonte não-transformada). Ver §14.
6. **useBracket:** `useQuery({ queryKey: worldcupKeys.bracket(), queryFn: getBracket, staleTime: STALE_TIME.grupos })` (24h; bracket é estático como grupos). Sem `hasLiveGroupMatch` no body do bracket → sem refetchInterval dinâmico (aceito; bracket muda devagar).
7. `"use client"` nos hooks (consomem React Query). Service é client-safe (fetch relativo), sem diretiva.

## 7. Contracts and interfaces
- `getGroups` → `GroupsResponse` `{ groups: GroupTable[], hasLiveGroupMatch }`.
- `getBracket` → `BracketResponse` (6 buckets).
- `useGroupStandings(groupId)` → `GroupTable | null` (null quando grupo inexistente).

## 8. Data and persistence impact
Nenhum (client-side).

## 9. Required tests
- `services/__tests__/worldcup.test.ts`: mock `fetch`. getGroups: 2xx válido → objeto parseado; 2xx com shape inválido → ZodError; non-2xx com `{error}` → Error com msg+status; idem getBracket.
- `hooks/__tests__/*`: render com QueryClientProvider (espelhar teste de hook existente, ex. `useMatchesList.test.ts`). useGroups → chama getGroups, retorna data; useGroupStandings("A") → slice correto; grupo inexistente → null; useBracket → data. Mock do service.
- refetchInterval: teste de que com `hasLiveGroupMatch: true` o intervalo é 60s (pode ser teste leve do retorno da função de intervalo, sem timers reais).

## 10. Acceptance criteria
- `npx vitest run` integral verde; `npx tsc --noEmit` e eslint limpos.
- Keys exatamente `["groups"]`/`["bracket"]` (e `["group", id]` na factory).
- Revalidação Zod no client comprovada (teste de shape inválido).
- Sem regressão nos services existentes.

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, comentários pt-BR.
- Não usar `parseWithId` (não é lista de itens-com-id).
- Não duplicar `API_BASE`/`buildHttpError` — reusar `_apiClient`.
- `"use client"` só nos hooks.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: false
- reason: data-access (service + hooks de dados), sem componentes/telas. UI vem nas TASK-06/07/08. (Não dispara /ui-spec.)

## 14. Open questions
- `refetchInterval` com `select`: confirmar na implementação a assinatura do TanStack Query v5 — `refetchInterval` recebe a `Query` (não o data transformado). Usar `(query) => (query.state.data as GroupsResponse | undefined)?.hasLiveGroupMatch ? 60_000 : false`. O `query.state.data` é o dado **bruto** (pré-select), portanto `GroupsResponse`. Implementador deve verificar via context7 se houver dúvida na versão instalada do `@tanstack/react-query`.
