# Context Snapshot — world-cup-betting-pool

> Gerado em: 2026-06-07
> Branch: `feat/integracao-api-football`
> Workflow ativo: `/flow` para feature **Jogos (PRD-03)**

---

## 1. Estado da branch

Último commit: `bf12828 fix(auth): aplica WARNINGs de review (constante e admin init)`

Todas as 12 tarefas da fundação `integracao-api-football` foram implementadas, revisadas (review adversarial) e os WARNINGs aplicados. A branch está limpa para avançar no PRD-03.

---

## 2. Arquitetura atual (PRD-07 v2.0)

> Decisão principal: dados da Copa **nunca** vão direto do browser para a API-Football.
> Fluxo: API-Football → Cloud Functions / Route Handlers → (cache server-side) → React Query → UI.

### Camada de dados (Route Handlers Next.js)

| Endpoint | Descrição | Cache servidor |
|---|---|---|
| `GET /api/matches` | Todas as partidas mapeadas e validadas | `REVALIDATE.jogoAoVivo` (60s) — teto único; segmentação fina fica no client |
| `GET /api/matches/[id]` | Partida única (404 → null) | mesma revalidação |
| `GET /api/teams` | Todas as seleções | `REVALIDATE.selecoes` (24h) |
| `GET /api/standings` | Classificação por grupo | `REVALIDATE.jogoDia` (30min) |

### Tiers de cache (`src/server/cache/tiers.ts`)

| Tier | Servidor (revalidate) | Client (staleTime) |
|---|---|---|
| `grupos` | 24h | 24h |
| `selecoes` | 24h | 24h |
| `jogoFuturo` | 6h | 6h |
| `jogoDia` | 30min | 30min |
| `jogoAoVivo` | 1min | 1min |
| `jogoEncerrado` | 5min | 5min |

`revalidateForMatch(match, now)` escolhe o tier correto por `status` + data.

### Serviços (`src/services/`)

- `matches.ts`: `listMatches()`, `getMatchById(id)`, `getNextScheduledMatch()`, `getRecentFinishedMatches()` — fazem `fetch /api/matches[/id]`, parse Zod com `parseWithId`.
- `teams.ts`: `listAllTeams()` — `fetch /api/teams`, parse Zod.
- `predictions.ts`: `listPredictionsByUid(uid)` — **Firestore** (palpites continuam no Firestore).

### Hooks de baixo nível — `src/features/matches/hooks/`

| Hook | Query Key | staleTime |
|---|---|---|
| `useMatches()` | `["matches","list"]` | `STALE_TIME.jogoDia` (30min) |
| `useMatch(id)` | `["matches","detail",id]` | — |
| `useTeams()` | `["matches","teams"]` | — |

Barrel: `src/features/matches/index.ts` expõe `{ matchesKeys, useMatches, useMatch, useTeams }`.

### Servidor-side (`src/server/`)

- `src/server/apiFootball/`: cliente HTTP, config, factory, tipos, mock.
- `src/server/mappers/`: `matchMapper.ts`, `teamMapper.ts` — transformam resposta da API-Football nos schemas internos.
- `src/server/auth/`: `verifySession`, `sessionCookie`, `googleCerts`.
- `src/server/firebaseAdmin.ts`: inicialização Admin SDK.

### Schemas Zod (`src/schemas/`)

- `shared.ts`: `stageSchema` (grupos/oitavas/quartas/semifinal/terceiro/final), `matchStatusSchema` (scheduled/live/finished/postponed/canceled), `isoDateTime` (com `offset: true`), `scoreSchema`, `nonEmptyString`, `percentageSchema`.
- `matches.ts`: `matchSchema` (strict + refine de placares por status). `homeTeamId`, `awayTeamId`, `kickoffAt`, `stage`, `round`, `groupId`, `venue{name,city}`, `status`, `homeScore`, `awayScore`.
- `teams.ts`: `teamSchema` — `name`, `flagUrl?`, `groupId`.
- `predictions.ts`: `predictionSchema` — `uid`, `matchId`, `homeScore`, `awayScore`, timestamps.

---

## 3. Features existentes

### `home` (PRD-02) — CONCLUÍDA (molde de referência)

Estrutura canônica: `lib/` (funções puras testáveis) → compositor hook → componentes tipados → página.

- `src/features/home/lib/homeDashboardHelpers.ts` — funções puras: `buildTeamMap`, `resolveTeam`, `computeIsCorrect`, `derivePredictionStatus`, `deriveRankingSummary`, `derivePerformanceSummary`, `deriveCurrentStage`, `deriveNotices`.
- `src/features/home/hooks/useHomeDashboard.ts` — compositor: orquestra 7 hooks, expõe `HomeDashboardData`.
- `src/features/home/hooks/usePredictions.ts` — `usePredictions(uid)` via Firestore. **Usada como molde para matches.**
- Componentes: `HomeDashboard`, `NextMatchCard`, `LastResultsCard`, `RankingCard`, etc. — todos com testes co-localizados.

### `matches` (PRD-03) — EM CONSTRUÇÃO

Estado atual: **apenas hooks de baixo nível**. Sem `lib/`, sem componentes, sem páginas reais.

- `src/features/matches/hooks/`: `useMatches`, `useMatch`, `useTeams`, `matchesKeys`, `index.ts`.
- `src/features/matches/index.ts`: barrel mínimo.
- `src/app/(app)/matches/page.tsx`: **placeholder** ("Lista de jogos em construção").
- `src/app/(app)/matches/[id]/page.tsx`: **não existe ainda**.

---

## 4. Fluxo /flow ativo — PRD-03 Jogos

### Artefatos

- PRD: `ai/prd/jogos.md`
- Plan: `ai/plan/jogos.md`
- Specs: nenhuma criada ainda (`ai/spec/jogos-task-NN.md` — a criar)
- Screens: nenhuma criada ainda (`ai/screen/jogos-task-NN.md` — a criar)
- Reviews: nenhuma criada ainda

### Tarefas (plano)

| Task | Tipo | Objetivo | Dependências | Pontos | TDD | Screen |
|---|---|---|---|---|---|---|
| **TASK-01** | domain | Funções puras `lib/`: agrupamento/filtro/busca/status/labels | nenhuma | 3 | sim (crítico) | não |
| **TASK-02** | application | Hooks compositor: `usePredictions`, `useMatchesList`, `useMatchDetail` | TASK-01 | 2 | sim | não |
| **TASK-03** | ui | Componentes base: `MatchCard` (3 variantes), badges, skeletons, empty/error | TASK-01 | 3 | não | sim (mobile) |
| **TASK-04** | ui | Página lista `/matches` — substitui placeholder | TASK-02, TASK-03 | 3 | não | sim (both) |
| **TASK-05** | ui | Sheet de filtros (fase/status/seleção) + wiring na lista | TASK-04 | 3 | não | sim (mobile) |
| **TASK-06** | ui | Página detalhe `/matches/[id]` — nova tela cheia | TASK-02, TASK-03 | 2 | não | sim (both) |

### Ondas de execução paralela

```
Wave 1: TASK-01
Wave 2: TASK-02, TASK-03  (paralelas)
Wave 3: TASK-04, TASK-06  (paralelas)
Wave 4: TASK-05
```

### Decisões travadas no plan

- Cache: manter `STALE_TIME.jogoDia` (30min) — não "5 min" do texto do prd-03.md.
- Filtros: 100% client-side (~104 jogos).
- `postponed` → "Adiado", `canceled` → "Cancelado".
- Cabeçalhos de seção: Hoje / Amanhã / data por extenso (date-fns pt-BR).
- Busca: casa mandante **ou** visitante.
- Hook de predictions no escopo matches (não compartilhado com home).

---

## 5. Regras de arquitetura críticas (desta branch)

1. **API-Football nunca chamada pelo browser** — sempre via `/api/*` Route Handlers.
2. **Matches/teams: NÃO vêm do Firestore** — vêm de `/api/matches` e `/api/teams` (Route Handlers proxy API-Football com cache).
3. **Predictions: Firestore** — coleção `predictions`, serviço `listPredictionsByUid`.
4. **TypeScript strict** — sem `any` em nenhum arquivo.
5. **Sem estilos inline** — 100% Tailwind + variáveis CSS de tema.
6. **Todo formulário** — React Hook Form + Zod.
7. **Toda query** — TanStack Query (sem fetch/useEffect manual na UI).
8. **Molde de feature**: `lib/` pura testável → compositor hook → componentes → página (padrão `home`).

---

## 6. Próximo passo recomendado

Executar `/spec jogos-task-01` para gerar a spec de implementação de TASK-01 (funções puras de `lib/`).

TASK-01 é a fundação: bloqueia TASK-02, TASK-03 e tudo mais. Candidata a TDD antes de implementar.
