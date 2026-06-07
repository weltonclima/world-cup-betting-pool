# PLAN — Jogos (PRD-03)

> PRD: `ai/prd/jogos.md`. Branch: `feat/integracao-api-football`.
> Saída por tarefa: `ai/spec/jogos-task-NN.md`, `ai/screen/jogos-task-NN.md`.
> Layout: `docs/prd-03/PRD03-01..06`. Design system: `design-system/MASTER.md` (já existe).
> Camada de dados PRONTA (services/hooks/API/schemas) — plano é **UI + funções puras**, reuso máximo.
> Molde de referência: feature `home` (PRD-02) — `lib/` puro testável → compositor hook → componentes tipados → página.

## 1. Planning summary

6 tarefas. Esforço concentrado em: (1) funções puras de `lib/` (agrupamento, filtragem, busca, derivação de status), (2) componentes de UI (card + variantes, badges, estados), (3) duas páginas (lista substitui placeholder; detalhe é nova tela cheia), (4) sheet de filtros.

**Não há trabalho de dados novo:** `useMatches`/`useMatch`/`useTeams` + services (`listMatches`/`getMatchById`/`listAllTeams`) e `listPredictionsByUid` (Firestore) já existem. Reuso direto.

Início recomendado: **TASK-01** (fundação lib pura). Maior risco: TASK-01 (regra de bloqueio kickoff vs status defasado), TASK-04 (composição da lista + estados).

**Decisões travadas (resolvem ambiguidades do PRD):**
- A1 cache → **sem novo tuning**. `/api/matches` já tem teto server-side `jogoAoVivo` (60s) + `revalidateForMatch` por status; o hook `useMatches` usa `STALE_TIME.jogoDia` (30 min) no client. O "5 min" do texto corresponde ao tier `jogoEncerrado` já existente. Reusar como está.
- A2 filtros → 100% client-side (~104 jogos, `/api` retorna tudo).
- A3 status → `postponed→"Adiado"`, `canceled→"Cancelado"`, `live→"Ao Vivo"` (somente consulta).
- A5 cabeçalhos de seção → Hoje / Amanhã / data por extenso (date-fns pt-BR).
- A6 busca → casa mandante **ou** visitante.
- A10 hook predictions → criar `usePredictions(uid)` **matches-local** (namespace `matchesKeys`, reusa service `listPredictionsByUid`). Não importar o de `home` (acoplamento cross-feature) nem extrair compartilhado.
- **Bloqueio** → regra primária e autoritativa é per-match (`now>=kickoffAt` OU `status!=scheduled`, TASK-01). A trava global `systemSettings.predictionsLocked` é **secundária/defensiva** e opcional no compositor (TASK-02); não é requisito de PRD-03 (read-only).

## 2. Recommended execution phases

1. **Fundação** — TASK-01 (lib pura: agrupamento/filtro/busca/status + labels), TASK-02 (hooks compositor).
2. **Componentes** — TASK-03 (card, badges, skeleton, empty/error).
3. **Telas** — TASK-04 (lista), TASK-06 (detalhe).
4. **Interação avançada** — TASK-05 (filtros sheet).

## 3. Tasks

### TASK-01 – Funções puras e constantes de `matches/lib`
- Type: domain
- Goal: centralizar lógica não-React de Jogos em `lib/` testável (agrupamento por dia, filtragem, busca, derivação de status jogo+palpite com bloqueio, mapas de rótulo/cor pt-BR).
- Scope:
  - `buildTeamMap(teams)` / `resolveTeam(id, map)` (espelhar home; fallback p/ `flagUrl` ausente).
  - `groupMatchesByDay(matches, now)` → seções "Hoje"/"Amanhã"/data por extenso (date-fns pt-BR), ordenadas por `kickoffAt`.
  - `filterMatches(matches, { stage, predictionStatus, teamId })` — client-side.
  - `searchMatchesByCountry(matches, teamMap, query)` — mandante **ou** visitante (A6).
  - `deriveMatchPredictionStatus(match, predictions, now, globalLock?)` → `enviado|pendente|bloqueado`. **Regra crítica:** `bloqueado` se `globalLock === true` **OU** `now >= kickoffAt` **OU** `status !== "scheduled"`; senão `enviado` se há prediction; senão `pendente`. (`globalLock` opcional, default `false` — distinto do `derivePredictionStatus` da home, que só olha o lock global.)
  - `deriveGameStatusLabel(status)` → Agendado/Ao Vivo/Encerrado/Adiado/Cancelado (A3).
  - Constantes rótulo+cor de badge em arquivo dedicado (verde=enviado, âmbar=pendente, cinza=encerrado/bloqueado).
- Main modules/files: `src/features/matches/lib/matchesHelpers.ts`, `src/features/matches/lib/matchLabels.ts`, `src/features/matches/lib/__tests__/matchesHelpers.test.ts`
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: medium (tempo/timezone — `kickoffAt` UTC canônico)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: injetar `now: Date` p/ testabilidade (padrão `deriveNotices` da home). Sem `any`.

### TASK-02 – Hooks de dados de Jogos + compositor de view-model
- Type: application
- Goal: prover à UI um view-model pronto (jogos + seleções resolvidas + status de palpite), espelhando `useHomeDashboard`.
- Scope:
  - Estender `matchesKeys` com `predictions(uid)` (e `systemSettings()` se a trava global for wired).
  - `usePredictions(uid)` matches-local (namespace `matchesKeys.predictions(uid)`, `enabled: uid !== null`, reusa `listPredictionsByUid`; espelha home mas sem `homeKeys`).
  - `useMatchesList()` — compositor: `useMatches` + `useTeams` + `usePredictions`; aplica `buildTeamMap`/`deriveMatchPredictionStatus`/`groupMatchesByDay`; expõe `{ groups, flatList, isLoading, isError, refetch }`. Trava global (`useSystemSettings`) **opcional** — incluir só se passar `predictionsLocked` ao helper; senão omitir (regra per-match basta).
  - `useMatchDetail(id)` — `useMatch(id)` + `useTeams` + `usePredictions`.
- Main modules/files: `src/features/matches/hooks/{usePredictions,useMatchesList,useMatchDetail}.ts`, `hooks/matchesKeys.ts` (estender), `hooks/__tests__/*`, atualizar `hooks/index.ts`
- Dependencies: TASK-01
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: yes (join/estado agregado; padrão `useHomeDashboard.test.ts`)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: não refazer services/hooks de baixo nível. `useTeams` é o de matches (`["matches","teams"]`).

### TASK-03 – Componentes base de UI (card, badges, estados)
- Type: ui
- Goal: componentes apresentacionais reutilizáveis das telas de Jogos.
- Scope:
  - `MatchCard` 3 variantes (Enviado/Pendente/Encerrado c/ placar) — bandeiras+nomes, grupo, data/hora, estádio/cidade, badge, navegação p/ detalhe (`PRD03-01/04/05/06`).
  - `MatchStatusBadge` (palpite) + `GameStatusBadge` (jogo), via mapa de TASK-01.
  - `MatchListSkeleton` / `MatchCardSkeleton`.
  - `MatchesEmptyState` ("Nenhum jogo encontrado") + `MatchesErrorState` ("Erro ao carregar jogos" + "Tentar novamente").
  - Fallback visual p/ bandeira ausente.
- Main modules/files: `src/features/matches/components/{MatchCard,MatchStatusBadge,GameStatusBadge,MatchListSkeleton,MatchesEmptyState,MatchesErrorState}.tsx`, `components/index.ts`, `components/__tests__/*`
- Dependencies: TASK-01
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no (apresentacional; cobertura via `/test`, padrão home)
- Recommended screen: yes – mobile (mobile-first, responsivo)
- Design domains: style, color, ux, product
- Design complexity: medium
- Accessibility level: enhanced (contraste WCAG AA, toque ≥44px, card navegável por teclado)
- Notes: ler `design-system/MASTER.md`. Reusar shadcn (Badge, Skeleton). Sem estilo inline.

### TASK-04 – Página Lista de Jogos (`/matches`)
- Type: ui
- Goal: substituir placeholder pela lista real, agrupada por dia, com header/busca/chips e estados.
- Scope:
  - Substituir `src/app/(app)/matches/page.tsx`.
  - Header: título "Jogos", busca por seleção, botão de filtros (abre sheet da TASK-05).
  - Chips de filtro rápido (fase/status) — `PRD03-01`.
  - Seções por dia (TASK-01) com `MatchCard` (TASK-03), consumindo `useMatchesList` (TASK-02).
  - Estados loading/empty/error. Bottom nav já existe.
- Main modules/files: `src/app/(app)/matches/page.tsx`, `src/features/matches/components/{MatchList,MatchListHeader}.tsx`, `__tests__/*`
- Dependencies: TASK-02, TASK-03
- Story points: 3
- Criticality: high
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – both (mobile-first → desktop 1024px+)
- Design domains: style, color, typography, ux, product
- Design complexity: high
- Accessibility level: enhanced
- Notes: estado de busca/filtros lifted na página, aplicado via `filterMatches`/`searchMatchesByCountry` (TASK-01). Sheet integrado na TASK-05.

### TASK-05 – Sheet de Filtros (fase / status / seleção)
- Type: ui
- Goal: filtros avançados em sheet sobre a lista, com Aplicar/Limpar (`PRD03-03`).
- Scope:
  - `MatchFiltersSheet`: Fase (grupos/oitavas/quartas/semifinal/terceiro/final), Status do Palpite (todos/enviado/pendente/encerrado), Seleção (busca por país + lista, "Todas as seleções").
  - Ações "Aplicar Filtros"/"Limpar Filtros". Integrar estado com página (TASK-04, aplica `filterMatches`).
  - Foco/trap no sheet, fechar por ESC/overlay.
- Main modules/files: `src/features/matches/components/MatchFiltersSheet.tsx`, wiring em `page.tsx`/`MatchListHeader.tsx`, `__tests__/*`
- Dependencies: TASK-04
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no (filtragem já testada em TASK-01; aqui é estado/UI)
- Recommended screen: yes – mobile (sheet bottom; responsivo)
- Design domains: style, color, ux, product
- Design complexity: medium
- Accessibility level: critical (foco no sheet, teclado, labels)
- Notes: enums de `stageSchema`/`matchStatusSchema` + seleções de `useTeams`. shadcn Sheet. Estado local (sem RHF — não é form de submissão).

### TASK-06 – Página Detalhe do Jogo (`/matches/[id]`)
- Type: ui
- Goal: nova tela cheia de detalhe com info completa, status e CTAs contextuais (`PRD03-02`).
- Scope:
  - Nova rota `src/app/(app)/matches/[id]/page.tsx`.
  - Info: times+bandeiras, data, hora, estádio, cidade, fase, grupo.
  - Status do jogo + status do palpite.
  - Ações (CTAs p/ PRD-04, placeholder/disabled): Enviar/Editar/Visualizar Palpite; Ver Informações da Partida; Visualizar Resultado & Estatísticas. Habilitar por status (bloqueado → sem editar).
  - Estados loading/empty(404)/error; voltar p/ lista. Consome `useMatchDetail` (TASK-02).
- Main modules/files: `src/app/(app)/matches/[id]/page.tsx`, `src/features/matches/components/{MatchDetail,MatchDetailActions}.tsx`, `__tests__/*`
- Dependencies: TASK-02, TASK-03
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – both
- Design domains: style, color, typography, ux, product
- Design complexity: high
- Accessibility level: enhanced
- Notes: CTAs apontam p/ rotas de PRD-04 (inexistentes) → placeholders/disabled. `getMatchById` retorna null em 404 → empty state.

## 4. Dependency map

```
TASK-01 (lib puro)
   ├─> TASK-02 (hooks/compositor)
   └─> TASK-03 (componentes UI)
TASK-02 + TASK-03
   ├─> TASK-04 (lista) ──> TASK-05 (filtros sheet)
   └─> TASK-06 (detalhe)
```

## 5. Execution waves (parallel groups)

- **Wave 1:** TASK-01 *(fundação; sem dependências)*
- **Wave 2:** TASK-02, TASK-03 *(dependem só de TASK-01; independentes entre si)*
- **Wave 3:** TASK-04, TASK-06 *(dependem de TASK-02+TASK-03; independentes entre si)*
- **Wave 4:** TASK-05 *(depende de TASK-04)*

## 6. Recommended execution order (sequential fallback)

TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05 → TASK-06

> No fallback, TASK-06 pode vir logo após TASK-03 (não depende de 04/05) se preferir entregar detalhe antes dos filtros.

## 7. Planning risks and blockers

1. **Dados pré-Copa vazios** (`/api/matches` sem fixtures): empty-state provável em dev. Validar em `/local-env` com seed/mocks.
2. **Regra de bloqueio (TASK-01):** `kickoffAt` vs `now` + status → risco de timezone. Mitigado por `kickoffAt` UTC canônico + `now` injetável + TDD.
3. **CTAs de PRD-04 inexistentes (TASK-06):** entregar como placeholder/disabled; evitar links quebrados.
4. **Telas com nomes enganosos:** `PRD03-03`=Filtros, `PRD03-04`=Card Enviado (não tabela/classificação). Plano segue imagens, não nomes de arquivo.
5. **`/screen` obrigatório** antes de `/implement` nas TASKs 03, 04, 05, 06.

## Tarefas que exigem `/screen`
TASK-03, TASK-04, TASK-05, TASK-06.

## Tarefas que exigem TDD
TASK-01 (crítico — bloqueio + filtragem), TASK-02 (join/compositor).
