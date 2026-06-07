# PLAN — Integração API-Football via Route Handlers (Fundação)

> Input: `ai/prd/integracao-api-football.md` · Saída por tarefa: `ai/spec/integracao-api-football-task-NN.md`
> Decisões travadas: App Hosting (deploy) · cache Next.js `revalidate` nativo (A2) · auth session-cookie+`jose`+custom claim (A3) · descartar sync Firestore de matches/teams.

## 1. Planning summary

Pivô de arquitetura (PRD-07 v2.0): dados da Copa passam de Firestore para **Route Handlers Next.js → cache Next → API-Football**. 11 tarefas. Fundação server (mover client+mappers, corrigir drift) → Route Handlers+cache → camada de dados client (repontar Home) → migração de hosting → auth/middleware → limpeza de código morto.

Início recomendado: **Wave 1** (T01, T03, T07, T08 — independentes). Maior risco: T07 (migração hosting, alto), T10 (middleware/`jose`, segurança), T11 (remover sync sem quebrar Home).

**Sem tarefas UI** (`/screen` não roda). Telas (Home/Jogos) consomem esta camada nos seus próprios PRDs. Após esta fundação: **revisar `ai/plan/jogos.md` (T01/T04)** p/ usar `/api/*`.

**Ambiguidades resolvidas no plano:** A1 → `/api/standings` + grupo derivado de teams; A5 → rota de matches com `revalidate` curto base + segmentação por status no client (staleTime por tier); A7 → mover mappers p/ `src/` usando `src/schemas`; CF de ranking consome cópia controlada (fora do escopo desta fundação).

## 2. Recommended execution phases

1. **Integração server** — T01 (mover apiFootball), T02 (mappers + drift)
2. **Exposição** — T03 (cache tiers), T04 (Route Handlers)
3. **Dados client** — T05 (serviços fetch /api), T06 (hooks + repontar Home)
4. **Infra** — T07 (App Hosting + secret)
5. **Auth** — T08 (custom claim), T09 (session cookie), T10 (middleware)
6. **Limpeza** — T11 (remover sync morto)

## 3. Tasks

### TASK-01 – Mover camada de integração API-Football para o servidor Next
- Type: refactor-support
- Goal: client/mock/factory/types/config da API-Football acessíveis aos Route Handlers (server-only).
- Scope: mover `functions/src/apiFootball/{client,mock,factory,types,config}.ts` → `src/server/apiFootball/`. Ajustar imports. Garantir "server-only" (sem vazar p/ bundle client — `import "server-only"` no barrel). Migrar testes correspondentes (`client.*.test.ts`, fixtures). Manter API pública (`getApiFootballClient`).
- Main modules/files: `src/server/apiFootball/*`, testes
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no (mover + testes já existem)
- Recommended screen: no – n/a
- Notes: NÃO apagar os arquivos em `functions/` ainda — T11 cuida da remoção após Home repontada. Pode duplicar temporariamente.

### TASK-02 – Mover mappers p/ src + corrigir schema drift
- Type: domain
- Goal: mappers puros usando `src/schemas` como fonte única, cobrindo terceiro/venue/round/group.
- Scope: mover `functions/src/mappers/{matchMapper,teamMapper}.ts` → `src/server/mappers/`, importando de `@/schemas` (não da cópia `functions/shared`). Corrigir: `ROUND_TO_STAGE_MAP` +`"3rd Place Final"→terceiro` (+`Semi-finals` já ok); mapear `venue` (`fixture.venue {name,city}`), `round` (nº da rodada), `groupId`. Estender `types.ts` (`FixtureResponse.fixture.venue`, `league.round`/grupo) e `MOCK_FIXTURES`/`MOCK_TEAMS` (incluir venue/group; ampliar p/ dataset mais rico). Output validado por `matchSchema`/`teamSchema` do front.
- Main modules/files: `src/server/mappers/*`, `src/server/apiFootball/{types,mock}.ts`, `src/server/mappers/__tests__/*`
- Dependencies: TASK-01
- Story points: 5
- Criticality: critical
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: cobrir jogo de 3º lugar, venue ausente (TBD→null), todos os status. Schema do front é `.strict()` — garantir shape exato.

### TASK-03 – Constantes de cache + seleção de tier
- Type: domain
- Goal: faixas de cache (PRD-07) centralizadas + helper que escolhe o tier por status/data do jogo.
- Scope: `src/server/cache/tiers.ts` — constantes em segundos: GRUPOS/SELECOES 24h, JOGO_FUTURO 6h, JOGO_DIA 30min, JOGO_AO_VIVO 1min, JOGO_ENCERRADO 5min. Helper `revalidateForMatch(match, now)` e mapeamento espelhado p/ React Query `staleTime` (ms). Sem hardcode espalhado.
- Main modules/files: `src/server/cache/tiers.ts`, `__tests__/*`
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: tiers consumidos tanto no servidor (`revalidate`) quanto no client (`staleTime`) — fonte única.

### TASK-04 – Route Handlers /api (matches, teams, groups/standings)
- Type: api
- Goal: endpoints server-side que fazem proxy+cache+validação da API-Football.
- Scope: `src/app/api/matches/route.ts` (GET todas), `src/app/api/matches/[id]/route.ts`, `src/app/api/teams/route.ts`, `src/app/api/standings/route.ts` (grupo derivável de teams — A1). Cada um: `getApiFootballClient().getX()` → mapper → `parse` Zod → `Response.json`. `fetch` com `next:{ revalidate }` (T03). Tratar erros do client (quota/auth/timeout) → status HTTP apropriado. Chave API só via `process.env` server.
- Main modules/files: `src/app/api/**/route.ts`, testes de rota
- Dependencies: TASK-01, TASK-02, TASK-03
- Story points: 5
- Criticality: critical
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: validar saída com Zod antes de responder (contrato estável). Definir shape de resposta (array de `MatchWithId`).

### TASK-05 – Serviços client consumindo /api
- Type: application
- Goal: funções de fetch client-side contra `/api/*`, substituindo leituras Firestore de matches/teams.
- Scope: reescrever `src/services/matches.ts` (`listMatches`, `getMatchById`, `getNextScheduledMatch`, `getRecentFinishedMatches`) e `src/services/teams.ts` p/ `fetch('/api/...')` + `parse` Zod no client. Manter assinaturas usadas pela Home p/ minimizar churn. `predictions`/`users`/`rankings` permanecem Firestore.
- Main modules/files: `src/services/{matches,teams}.ts`, `src/services/__tests__/*`
- Dependencies: TASK-04
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: derivar `getNextScheduledMatch`/`getRecentFinishedMatches` client-side a partir de `listMatches` (filtra/ordena) — evita endpoints extras.

### TASK-06 – Hooks React Query por tier + repontar Home
- Type: application
- Goal: hooks de matches/teams/standings com `staleTime` por tier; Home lê da nova fonte sem mudar UI.
- Scope: `src/features/matches/hooks/*` (ou compartilhado) consumindo T05; `staleTime` espelhando T03. Repontar `src/features/home/hooks/{useNextMatch,useRecentResults,useTeams}.ts` p/ os novos serviços. Helpers da Home (`homeDashboardHelpers`) e compositor **inalterados**. Verificar Home renderiza com dado (mock) ponta a ponta.
- Main modules/files: `src/features/matches/hooks/*`, `src/features/home/hooks/*`, testes
- Dependencies: TASK-05
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: contrato dos hooks da Home preservado (troca só a fonte atrás). Este é o ponto que faz "Home carregar".

### TASK-07 – Migração de deploy p/ Firebase App Hosting
- Type: infra
- Goal: app roda com runtime SSR (Route Handlers + Middleware), não mais static export.
- Scope: remover `output:"export"` de `next.config`; criar `apphosting.yaml`; mover bloco `hosting` (out) → App Hosting; `API_FOOTBALL_KEY` como secret do App Hosting; revisar `next/image` (sem otimização estática), env, `trailingSlash`/`cleanUrls`. Documentar deploy. Validar build SSR local (`next build && next start`).
- Main modules/files: `next.config.*`, `firebase.json`, `apphosting.yaml`, `functions` (config), docs
- Dependencies: nenhuma (independente; testar deploy após T04)
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: maior risco de infra. Pode rodar em paralelo; Route Handlers já funcionam em `next dev` independente do hosting. Validar deploy real depois de T04.

### TASK-08 – Custom claim `role` no Firebase Auth
- Type: integration
- Goal: token do usuário carrega `role` p/ decisão de acesso sem I/O no edge.
- Scope: estender `promoteFirstAdmin` (e o fluxo de aprovação/promoção admin) p/ setar custom claim `{ role }` via Admin SDK (`setCustomUserClaims`). Garantir claim sincronizado com `users.role`. Forçar refresh do token no client após mudança.
- Main modules/files: `functions/src/functions/promoteFirstAdmin.ts`, fluxo de aprovação (admin), testes
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: claim é a base p/ middleware (T10) e enforcement. Cobrir promoção e rebaixamento.

### TASK-09 – Session cookie httpOnly (/api/auth/session)
- Type: api
- Goal: sessão verificável no servidor/edge sem expor ID token.
- Scope: `src/app/api/auth/session/route.ts` — POST (troca ID token → session cookie via Admin SDK `createSessionCookie`, httpOnly/secure/sameSite) e DELETE (logout). Integrar no fluxo de login/logout do client (set após sign-in, clear no sign-out). Admin SDK roda em Node (Cloud Run), ok.
- Main modules/files: `src/app/api/auth/session/route.ts`, `src/server/firebaseAdmin.ts`, integração no auth client, testes
- Dependencies: TASK-08
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: Admin SDK precisa de credenciais no servidor (App Hosting service account). Cookie é a entrada do middleware.

### TASK-10 – Middleware de proteção /admin/* (jose)
- Type: integration
- Goal: primeiro portão server-side bloqueia não-admin em `/admin/*`.
- Scope: `middleware.ts` — ler session cookie, verificar assinatura+expiração com `jose` (chaves públicas Google, cacheadas) e checar claim `role==="admin"`; redirect se falhar. `matcher` em `/admin/*`. Add dep `jose`. Defense-in-depth: enforcement real permanece nas API Routes (Admin SDK) + Firestore Rules + `AdminGuard` client.
- Main modules/files: `middleware.ts`, `src/server/auth/verifySession.ts`, testes
- Dependencies: TASK-09
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: `firebase-admin` NÃO roda no middleware (edge) → usar `jose`. Cobrir cookie ausente/expirado/forjado/role errado.

### TASK-11 – Remover sync Firestore obsoleto (código morto)
- Type: refactor
- Goal: eliminar o pipeline antigo de persistência de matches/teams sem quebrar Home/Jogos.
- Scope: remover `functions/src/functions/syncTeams.ts`, parte de matches/teams de `scheduledSync.ts`, `writeMatches`/`writeTeams` de `writer.ts`, `functions/src/apiFootball/*` e `mappers/*` (já movidos em T01/T02), `functions/src/shared/schemas.ts` se não usado pela CF de ranking. Limpar exports em `functions/src/index.ts`. Remover índices Firestore de matches não mais usados (`firestore.indexes.json`). Confirmar Home/Jogos funcionam só via `/api/*`.
- Main modules/files: `functions/src/**`, `firestore.indexes.json`, `src/services/index.ts`
- Dependencies: TASK-05, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: se CF de ranking precisar de mappers/client, manter cópia controlada lá (A7) — não remover o que ela usa. Rodar suite completa após remoção.

## 4. Dependency map

```
T01 ─┬─> T02 ─┐
     └────────┼─> T04 ─> T05 ─> T06 ─┐
T03 ──────────┘                      ├─> T11
T08 ─> T09 ─> T10                    │
T05,T06 ─────────────────────────────┘
T07  (independente; validar deploy após T04)
```

- T01: — · T02: T01 · T03: — · T04: T01,T02,T03 · T05: T04 · T06: T05
- T07: — · T08: — · T09: T08 · T10: T09 · T11: T05,T06

## 5. Execution waves (parallel groups)

- **Wave 1:** T01, T03, T07, T08 (independentes)
- **Wave 2:** T02 (←01), T09 (←08)
- **Wave 3:** T04 (←01,02,03), T10 (←09)
- **Wave 4:** T05 (←04)
- **Wave 5:** T06 (←05)
- **Wave 6:** T11 (←05,06)

## 6. Recommended execution order (sequential fallback)

T01 → T02 → T03 → T04 → T05 → T06 → T08 → T09 → T10 → T07 → T11

(Dados ponta-a-ponta primeiro p/ Home carregar — T01..T06; auth depois; hosting e limpeza por último.)

## 7. Planning risks and blockers

1. **Migração hosting** (T07, alto): static export → App Hosting muda build/deploy/secret. Validar SSR + `next/image` + cold start. Pode exigir ajustes não previstos.
2. **Cota API-Football** (T04): cache Next nativo + escala a zero pode revalidar além do tier → mais chamadas. Monitorar; tier "ao vivo 1min" é o mais sensível.
3. **Middleware edge** (T10): só `jose` (sem firebase-admin). Verificação de chaves Google + cache. Segurança crítica → TDD.
4. **Quebrar Home na transição** (T06/T11): repontar fonte atrás dos mesmos hooks antes de remover sync. Suite completa em cada passo.
5. **Credenciais ausentes** (A6): sem `API_FOOTBALL_KEY`/IDs Copa, rotas servem mock (factory já faz fallback). Dado real depende de credenciais.
6. **CF de ranking acoplada** (A7): fonte de resultados muda (sem Firestore matches); redesenho fica em PRD de ranking. T11 não remove o que a CF usa.
7. **Reflexo em PRD-02/03**: após esta fundação, revisar `ai/plan/jogos.md` (T01/T04→`/api`) e validar Home. Não é tarefa desta fundação, mas é pré-condição p/ retomar Jogos.
