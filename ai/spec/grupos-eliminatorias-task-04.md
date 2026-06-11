# SPEC

## 1. Task id and title
- Task: TASK-04
- Title: Rotas API /api/worldcup/{groups,bracket} com cache Firestore read-through

## 2. Objective
Expor `computeGroupStandings` (TASK-02) e `deriveBracket` (TASK-03) como Route Handlers, com cache Firestore read-through (não reprocessar + resiliência a indisponibilidade do openfootball), conforme decisão do usuário (PRD §6.8).

## 3. In scope
- `src/server/worldcup/cache.ts` — helper de snapshot Firestore (Admin SDK):
  - `readSnapshot(key: "groups" | "bracket", now: Date): Promise<CacheSnapshot | null>` — lê doc `worldcup_cache/{key}`; retorna `{ payload, computedAt, hasLiveGroupMatch }` ou `null` (ausente). Não decide frescor — só lê.
  - `writeSnapshot(key, payload, hasLiveGroupMatch, now): Promise<void>` — grava best-effort; **engole erros** (try/catch + console.error), nunca lança (cache miss não pode derrubar read).
  - `isFresh(snapshot, now): boolean` — TTL: `hasLiveGroupMatch ? 60s : 24h` desde `computedAt`.
  - `CacheSnapshot` type + nome da coleção const.
- `src/app/api/worldcup/groups/route.ts` e `bracket/route.ts` — `GET`, `dynamic = "force-dynamic"`. Fluxo read-through (ver §6).
- `firestore.rules` — bloco explícito `worldcup_cache/{doc}` `allow read, write: if false`.
- Testes: `cache.test.ts` + `__tests__/route.test.ts` de cada rota.

## 4. Out of scope
- Service/hooks client (TASK-05). UI. Alterar `/api/standings`, `/api/matches` ou contratos TASK-01. Lógica de cômputo (TASK-02/03 fechadas).

## 5. Main technical areas involved
- Novo `src/server/worldcup/cache.ts`; novas rotas `src/app/api/worldcup/*`.
- Reuso: `getAdminFirestore()` (`@/server/firebaseAdmin`), `fetchAllMatches`/`fetchAllTeams` (`@/server/copaData`), `copaDataErrorResponse` (`@/app/api/_lib/copaDataError`), `computeGroupStandings`/`deriveBracket`.
- `firestore.rules` (já tem deny-by-default; adicionar bloco explícito).

## 6. Business rules and behavior

### Fluxo read-through (ambas as rotas)
1. `now = new Date()`. `snap = await readSnapshot(key, now)`.
2. `snap && isFresh(snap, now)` → 200 com `snap.payload` + header `Cache-Control` (ver abaixo). FIM (sem fetch openfootball).
3. Cache stale/ausente → tentar `fetchAllMatches()` (+ `fetchAllTeams()` p/ groups):
   - **Sucesso:** computar payload, `hasLiveGroupMatch = matches.some(m => m.stage === "grupos" && m.status === "live")`, `writeSnapshot(...)` best-effort, 200 com payload.
   - **Falha (openfootball indisponível)** e `snap` existe (mesmo stale) → 200 com `snap.payload` (resiliência), header `Cache-Control: no-store` (forçar reval). Logar.
   - **Falha e sem snapshot** → `copaDataErrorResponse(err)`.

### Payloads
- groups: `{ groups: computeGroupStandings(matches, teams), hasLiveGroupMatch }` (= `GroupsResponse`).
- bracket: `{ ...deriveBracket(matches, teams), hasLiveGroupMatch }` — nota: `BracketResponse` (TASK-01) **não** tem `hasLiveGroupMatch`; portanto a rota bracket retorna o `BracketPayload` puro (sem flag). **Decisão:** `hasLiveGroupMatch` só no payload de groups; bracket usa o mesmo flag internamente p/ TTL mas o body é `BracketResponse` puro. (Mantém contrato TASK-01 intacto.)

### Cache-Control
- Fresh/recém-computado: `s-maxage=<ttl>, stale-while-revalidate=60` onde `ttl = hasLiveGroupMatch ? 60 : 86400`.
- Resposta de fallback stale: `no-store`.

### Frescor / TTL
- `isFresh`: `(now - computedAt) < (hasLiveGroupMatch ? 60_000ms : 86_400_000ms)`. `computedAt` salvo como epoch ms (number) no doc — determinístico, sem Timestamp do Firestore p/ testabilidade.

### Observações honestas
- O mapper openfootball atual só produz `scheduled|finished` (sem `live`) — `hasLiveGroupMatch` será `false` na prática hoje; mantido p/ forward-compat e p/ honrar a decisão de TTL dinâmico do PRD sem custo.
- Sem auth no handler (posture das rotas de Copa existentes — dados públicos).

## 7. Contracts and interfaces
- `GET /api/worldcup/groups` → `GroupsResponse` (validável por `groupsResponseSchema`).
- `GET /api/worldcup/bracket` → `BracketResponse` (validável por `bracketResponseSchema`).
- Doc Firestore `worldcup_cache/{groups|bracket}`: `{ payload: <json>, computedAt: number, hasLiveGroupMatch: boolean }`. Coleção server-only.

## 8. Data and persistence impact
- Nova coleção `worldcup_cache` (2 docs no máximo). Writes só em cache miss (Spark-safe). Acesso exclusivo Admin SDK; Rules deny-all p/ cliente.
- Sem índices, sem migration.

## 9. Required tests
- `cache.test.ts`: `isFresh` (fresco/stale nos dois TTLs; boundary); `writeSnapshot` engole erro (mock Firestore que lança → não propaga); `readSnapshot` ausente → null, presente → objeto. Mock de `getAdminFirestore`.
- `groups/__tests__/route.test.ts` + `bracket/__tests__/route.test.ts` (mockar `@/server/copaData`, `@/server/worldcup/cache`):
  - cache fresco → retorna payload do snapshot, NÃO chama fetch.
  - cache stale → fetch + computa + writeSnapshot chamado + payload novo.
  - cache ausente → fetch + computa.
  - fetch falha + snapshot existe → retorna snapshot stale, status 200.
  - fetch falha + sem snapshot → status de erro (via copaDataErrorResponse: 502/504/500).
  - header Cache-Control correto por caminho.
  - writeSnapshot lança → resposta ainda 200 (best-effort).
- Medição informal cold-start de `computeGroupStandings`+`deriveBracket` (104 matches) p/ confirmar ≤2s — anotar no relatório, não precisa de teste automatizado.

## 10. Acceptance criteria
- `npx vitest run` integral verde, sem regressão; `npx tsc --noEmit` e eslint limpos.
- Cache miss não bloqueado por falha de write (best-effort comprovado em teste).
- Resiliência: openfootball fora + snapshot presente → 200.
- `/api/standings` e `/api/matches` inalterados (git diff não os toca).
- `firestore.rules` com bloco explícito worldcup_cache deny-all.

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, comentários pt-BR.
- `cache.ts` é server-only (Admin SDK) → `import "server-only"` (segue `firebaseAdmin.ts`).
- Rotas `runtime` nodejs (default) + `dynamic = "force-dynamic"`.
- Não introduzir Timestamp do Firestore em campo testável — usar epoch ms.
- Sem dependência nova.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: rotas backend + persistência.

## 14. Open questions
Nenhuma — decisão de cache travada (PRD §6.8). Assimetria do `hasLiveGroupMatch` (só no body de groups) resolvida em §6 p/ não violar contrato TASK-01.
