# PLAN — Home Dashboard (PRD-02)

> Input: `ai/prd/home-dashboard.md` · Saída por tarefa: `ai/spec/home-dashboard-task-NN.md`, `ai/screen/home-dashboard-task-NN.md`
> Decisões travadas: PRD §7b + Apêndice A (contrato API-Football → Firestore)

## 1. Planning summary

Painel `/home` read-only pós-login (approved). Rota/shell (`AppShell`+`AuthGuard`+`Header`+`BottomNav`) já existem; `home/page.tsx` é placeholder. Frontend lê **só Firestore** (app é static export, sem servidor); dados da Copa entram via **script Node + `firebase-admin`** fora do app — **no MVP, apenas seed de dev** (contrato API no Apêndice A do PRD). **Sem Cloud Functions.**

10 tarefas. Fundação primeiro (schemas alinhados à API → mapeadores → serviços/seed), depois camada de dados reativa (hooks/compositor), depois UI (header, cards, página com estados). Design system já existe (`design-system/MASTER.md`); tarefas UI geram override de página da Home via `/screen` antes de `/implement`.

Início recomendado: **TASK-01**. Tarefas de maior risco: TASK-05 (joins + cálculo isCorrect + agregação de estados), TASK-03 (queries Firestore + índices), TASK-04 (wiring de seed/emulador).

## 2. Recommended execution phases

1. **Fundação de dados** — TASK-01 (schemas), TASK-02 (mapeadores API→domínio)
2. **Acesso a dados** — TASK-03 (serviços Firestore), TASK-04 (seed dev)
3. **Camada reativa** — TASK-05 (hooks + compositor `useHomeDashboard`)
4. **UI** — TASK-06 (header), TASK-07 (cards de métrica), TASK-08 (cards de jogo/fase), TASK-09 (avisos), TASK-10 (página + estados)

## 3. Tasks

### TASK-01 – Alinhar schemas à API-Football
- Type: persistence (schema)
- Goal: schemas Zod refletem a fonte real (API-Football v3) para suportar PRD-02 e PRD-03.
- Scope: em `src/schemas/matches.ts` adicionar `venue { name, city }` e `round` (int ≥ 1, número da rodada); em `src/schemas/shared.ts` adicionar `"terceiro"` ao `stageSchema` (e avaliar impacto em `rankingScopeSchema` — ranking do bolão NÃO ganha 3º lugar, manter). Tipos derivados em `src/types/` atualizam automaticamente. Ajustar testes de schema existentes.
- Main modules/files: `src/schemas/matches.ts`, `src/schemas/shared.ts`, `src/schemas/__tests__/*`, `src/types/matches.ts` (auto)
- Dependencies: nenhuma
- Story points: 2
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: `venue`/`round` opcionais? Definir no spec: prováveis obrigatórios em matches finalizadas, nullable em TBD. Não quebrar o refinement de placar existente.

### TASK-02 – Mapeadores API-Football → domínio
- Type: domain
- Goal: funções puras que convertem campos da API nos enums/shape do domínio.
- Scope: `mapMatchStatus(short)` → `matchStatusSchema`; `parseRound(leagueRound)` → `{ stage, round, groupId? }` (ex.: "Group Stage - 2" → `{stage:"grupos", round:2, groupId?}`, "3rd Place Final" → `{stage:"terceiro"}`). Tabelas de mapeamento do Apêndice A. Sem I/O.
- Main modules/files: `src/lib/apiFootball/` (novo) + testes
- Dependencies: TASK-01 (enum `terceiro`)
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: reaproveitável pelo script de ingestão real futuro (Node + Admin SDK). Cobrir todos os 16 status e todas as rounds.

### TASK-03 – Camada de serviços Firestore (Home)
- Type: persistence
- Goal: leituras puras e validadas (Zod) de cada coleção que a Home consome.
- Scope: `src/services/` — `rankings.ts` (doc `scope:"geral"`), `statistics.ts` (`statistics/{uid}`), `matches.ts` (próximo `scheduled` por `kickoffAt`; finalizados `finished` desc limit 5), `teams.ts` (todos, p/ cache de join), `predictions.ts` (por uid), `systemSettings.ts` (doc global). Espelhar padrão de `src/services/users.ts` (.parse, erro cru).
- Main modules/files: `src/services/{rankings,statistics,matches,teams,predictions,systemSettings}.ts`, `src/services/index.ts`, `src/services/__tests__/*`
- Dependencies: TASK-01
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no (testes via mock no /test; lógica fina)
- Recommended screen: no – n/a
- Notes: queries com `where/orderBy/limit` podem exigir índice composto no Firestore — registrar em `firestore.indexes.json`. Sem realtime.

### TASK-04 – Seed de dev (shape API → Firestore)
- Type: infra
- Goal: popular Firestore (emulador/dev) com dados realistas p/ a Home renderizar e testes E2E.
- Scope: script `scripts/seed-home.ts` (ou `scripts/seed/`) que grava `teams`, `matches` (variando status: scheduled/live/finished), `predictions` do usuário de teste, `rankings` (scope geral), `statistics/{uid}`, `system_settings/global`. Usar mapeadores da TASK-02 a partir de fixtures no formato API-Football. Documentar comando no README.
- Main modules/files: `scripts/seed-home.ts`, fixtures `scripts/fixtures/*.json`, `package.json` (script)
- Dependencies: TASK-01, TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: idempotente. Não rodar em produção. Usuário de teste alinhado ao Firebase Auth de dev (ver memory firebase-project). **Escopo MVP = só seed** (fixtures locais). Ingestão real da API (modo `fetch` + gatilho manual/GitHub Actions) fica para PRD/tarefa futura; mesmo código de escrita (Admin SDK) será reusado.

### TASK-05 – Hooks TanStack Query + compositor `useHomeDashboard`
- Type: application
- Goal: expor dados da Home de forma reativa, com joins e derivações, e estado agregado p/ a tela.
- Scope: `homeKeys` (factory), hooks por recurso herdando staleTime/gcTime global; `useHomeDashboard` que orquestra queries, resolve nome/bandeira via cache de `teams`, calcula `isCorrect` (compara placar previsto × `goals` em jogos finalizados — D1/R2), deriva próximo jogo + status do palpite, últimos 5 resultados, e expõe `isLoading`/`isError`/`refetch` agregados.
- Main modules/files: `src/features/home/hooks/{homeKeys,useHomeDashboard,...}.ts`, testes
- Dependencies: TASK-03, TASK-02
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: cuidar de N+1 (teams uma vez). Não redefinir cache por hook (padrão `useUsersByStatus`).

### TASK-06 – Header de boas-vindas + sino
- Type: ui
- Goal: saudação "Olá {nome} 👋" + avatar (iniciais — R7/D1) + ícone de notificações (estático no MVP — R5).
- Scope: componente de header da Home (estende/compoe com `Header` existente OU bloco no topo do conteúdo). Avatar por iniciais reusando `src/features/admin/components/userAvatar.ts`. Sino sem realtime.
- Main modules/files: `src/features/home/components/HomeHeader.tsx`, testes
- Dependencies: nenhuma (usa `useAuth` existente)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – mobile|both – novo bloco de header/saudação
- Design domains: style, typography, color
- Design complexity: low
- Accessibility level: standard
- Notes: não duplicar o `Header` fixo do shell se já cobrir; alinhar com mockup `home.png`.

### TASK-07 – Cards de métrica (Ranking, Acertos, Aproveitamento, Meu Desempenho)
- Type: ui
- Goal: componentes presentational de métrica (props-only), números grandes + rótulo.
- Scope: `RankingCard`, `AccuracyCard`, `CorrectScoresCard`, `PerformanceCard`. Sem fetch — recebem dados via props. Skeleton variant por card.
- Main modules/files: `src/features/home/components/*Card.tsx`, testes
- Dependencies: TASK-06 (define tokens/screen da Home) — ou paralela após `/screen`
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – mobile|both – novos cards
- Design domains: style, color, typography
- Design complexity: medium
- Accessibility level: standard
- Notes: cor semântica AA p/ destaques. Reusar primitives Shadcn (Card).

### TASK-08 – Cards de jogo e fase (Próximo Jogo, Últimos Resultados, Fase Atual)
- Type: ui
- Goal: componentes presentational p/ jogo (bandeiras+nomes, data/hora, status do palpite, CTA), lista de resultados (placar + acertou/errou) e fase atual (+ "Rodada X de Y").
- Scope: `NextMatchCard`, `LastResultsCard` (até 5), `CurrentStageCard`. Props-only; CTA recebe handler/href (destinos Jogos/Palpites são placeholders — A6). Estado acertou/errou com cor semântica.
- Main modules/files: `src/features/home/components/*.tsx`, testes
- Dependencies: TASK-06 (screen)
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – mobile|both – novos cards
- Design domains: style, color, typography, ux
- Design complexity: medium
- Accessibility level: enhanced
- Notes: bandeiras = `flagUrl`/iniciais fallback; rótulo de fase em pt-BR a partir do enum.

### TASK-09 – Card Avisos
- Type: ui
- Goal: comunicados do sistema (R6) derivados de fonte disponível.
- Scope: `NoticesCard` presentational + helper que deriva avisos de `system_settings` (`predictionsLocked`, `currentStage`) e do próximo `kickoffAt` (ex.: "Prazo encerra em Xh"). Sem coleção nova no MVP.
- Main modules/files: `src/features/home/components/NoticesCard.tsx`, helper + testes
- Dependencies: TASK-03 (shape systemSettings), TASK-06 (screen)
- Story points: 2
- Criticality: low
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – mobile|both – novo card
- Design domains: style, color, ux
- Design complexity: low
- Accessibility level: standard
- Notes: definir no spec o conjunto mínimo de avisos deriváveis; resto é trabalho futuro.

### TASK-10 – Página /home: integração + estados
- Type: ui
- Goal: montar a Home real consumindo `useHomeDashboard` e renderizar loading/empty/error.
- Scope: substituir `src/app/(app)/home/page.tsx`; compor HomeHeader + grid de cards; skeletons por card no loading; empty ("nenhum jogo/resultado"); error com "Tentar Novamente" (`refetch`). Responsivo (360/390/430/768/1024+). Budget < 2s.
- Main modules/files: `src/app/(app)/home/page.tsx`, `src/features/home/components/HomeDashboard.tsx`, testes
- Dependencies: TASK-05, TASK-06, TASK-07, TASK-08, TASK-09
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – mobile|both – composição da página + estados
- Design domains: style, color, typography, ux, layout
- Design complexity: high
- Accessibility level: enhanced
- Notes: degradar p/ empty/error sem quebrar (R8). Sem layout shift (skeletons).

## 4. Dependency map

```
TASK-01 (schemas)
 ├─> TASK-02 (mappers) ─┐
 ├─> TASK-03 (services) ─┼─> TASK-05 (hooks/compositor) ─┐
 └─> TASK-02,03 ────────> TASK-04 (seed)                 │
                                                          │
TASK-06 (header) ─┬─> TASK-07 (metric cards) ───────────┤
                  ├─> TASK-08 (match/stage cards) ───────┤
                  └─> TASK-09 (avisos) ──(+TASK-03)──────┤
                                                          v
                                                    TASK-10 (page + states)
```

## 5. Execution waves (parallel groups)

- **Wave 1:** TASK-01 (schemas) · TASK-06 (header — só usa `useAuth`, requer `/screen`)
- **Wave 2:** TASK-02 (mappers) · TASK-03 (services) · TASK-07 (metric cards) · TASK-08 (match/stage cards)  *(02/03 dep 01; 07/08 dep screen da Home gerado em 06)*
- **Wave 3:** TASK-04 (seed) · TASK-05 (hooks/compositor) · TASK-09 (avisos)
- **Wave 4:** TASK-10 (página + estados)

## 6. Recommended execution order (sequential fallback)

01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10

## 7. Planning risks and blockers

- **TASK-01 toca `shared.ts`** (fonte única dos enums) → re-rodar suíte completa; `stageSchema` é usado por `statistics.correctByStage` e `matches`.
- **TASK-03/05 — índices Firestore:** queries `where+orderBy+limit` exigem índice composto; registrar em `firestore.indexes.json` e no emulador.
- **TASK-05 alto risco:** cálculo de `isCorrect` e derivações precisam de testes fortes (TDD). Agregação de loading/error de múltiplas queries.
- **Seed (TASK-04)** depende do projeto Firebase de dev/emulador (memory `firebase-project`). Garantir usuário de teste approved.
- **`/screen` antes de implementar UI:** TASK-06 gera o override de página da Home a partir de `design-system/MASTER.md`; TASK-07/08/09/10 referenciam.
- **Arquitetura sem servidor:** app é static export + **sem Cloud Functions** → app nunca chama a API-Football. Toda ingestão = script Node + `firebase-admin` fora do app. MVP usa só seed (TASK-04); ingestão real da API é PRD/tarefa futura.
- **Decisões ainda no /spec:** R6 (conjunto de avisos), A1 (total participantes = `entries.length`), A2 (cache 30min do projeto, não 5min), A3 (texto do denominador), A5 (elegibilidade do próximo jogo).
