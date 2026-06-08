# PLAN — Ranking (PRD-05)

> PRD: `ai/prd/ranking.md`. Specs: `ai/spec/ranking-task-NN.md`. Screens: `ai/screen/ranking-task-NN.md`.
> Decisões fixas: pontuação **binária 1/0** (pontos === acertos exatos; sem `correctWinners`/"vencedor"); data model **doc-por-escopo** mantido.

## 1. Planning summary

14 tarefas, escopo full-stack. Camadas em ordem goal-backward: **schemas → helpers puros → backend recalc → serviços/hooks de leitura → telas UI → rules/release**.

- **7 tarefas exigem `/screen`** (TASK-07..13): contrato visual = screenshots em `docs/prd-05/` + linguagem verde/card já estabelecida.
- **4 tarefas candidatas a `/tdd`** (TASK-01 schemas, TASK-02 helpers, TASK-03 recalc, TASK-04 serviços).
- Reaproveita infra subutilizada: `rankingScopeSchema`, `statistics` schema (positionHistory/correctByStage), `getGeneralRanking`/`useGeneralRanking`, padrão `/api/predictions/score`.
- **Nova dependência:** `recharts` via componente **shadcn Chart** (gráfico de linha da Evolução; distribuição em barras pode ser SVG/Tailwind puro). Ver risco R1.

**Resoluções de ambiguidade aplicadas (do PRD §6):**
- **A1 Por Grupo** = grupos individuais (A–L) via `match.groupId`; ranking filtrado pelas partidas do grupo, com seletor de grupo.
- **A2 Aproveitamento** = acertos / partidas **finalizadas elegíveis ao escopo** (denominador = finalizadas, não só palpitadas).
- **A3 Cache** = herda QueryClient global (30min); **não** override 5min (simplicidade; <100 users). Registrado como desvio consciente do texto do PRD.
- **A4 "Rodada"** = cada execução de `/api/rankings/recalc` gera um ponto em `positionHistory` (rotulado por data/jornada). Copa não tem rodadas lineares.
- **A5 Visibilidade de palpites alheios** = BLOQUEADOR em aberto (ver §7) — decidir antes da TASK-12.

## 2. Recommended execution phases

1. **Fundação** — schemas + helpers puros (TASK-01, 02).
2. **Backend** — recalc Route Handler + rules (TASK-03, 14).
3. **Leitura** — serviços + hooks (TASK-04, 05) + infra de gráfico (TASK-06).
4. **UI** — shell/estados + 6 telas (TASK-07..13).

## 3. Tasks

### TASK-01 – Estender schemas de ranking e estatísticas
- Type: domain (schema/persistence)
- Goal: Modelar dados que as 6 telas precisam, sob pontuação binária.
- Scope: Estender `rankingEntrySchema` com `name` (desnormalizado), `correct` (=acertos=pontos), `wrong` (erros), `accuracy` (0–100). Manter `points` como alias de `correct` ou consolidar (decidir no spec, sem quebrar `getGeneralRanking`). Definir estrutura **ranking por grupo** (novo escopo ou doc `rankings/grupo-{groupId}` com `groupId`+`entries[]`). Novo `poolStatsSchema` (maior/menor pontuação + nome, média, total participantes, total acertos, faixas de distribuição). Revisar `statisticsSchema` (campos das Telas 02/05: erros, média por rodada, melhor posição).
- Main modules/files: `src/schemas/rankings.ts`, `src/schemas/statistics.ts`, `src/schemas/shared.ts`, `src/types/rankings.ts`, `src/schemas/index.ts`, `__tests__`.
- Dependencies: nenhuma
- Story points: 3
- Criticality: high (contrato base de tudo; mexe em schema já consumido pela Home)
- Technical risk: medium (não quebrar `getGeneralRanking`/card da Home)
- Recommended TDD: yes (schemas têm `__tests__` no projeto)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Zod é fonte única de tipos. Validar compat retroativa com doc `scope:"geral"` atual.

### TASK-02 – Helpers puros de ranking
- Type: domain
- Goal: Lógica testável de ordenação, desempate, aproveitamento, evolução e distribuição.
- Scope: Funções puras: (a) ordenação + desempate na ordem do PRD — maior pontuação → mais acertos exatos → maior aproveitamento → menos erros → data do 1º palpite → fallback uid; (b) cálculo de aproveitamento (denominador = finalizadas elegíveis); (c) indicador de evolução `subiu|manteve|caiu` + delta a partir de duas posições; (d) faixas de distribuição de pontuação (0–39, 40–59, 60–79, 80–89, 90–100 conforme imagem Tela 06).
- Main modules/files: `src/features/rankings/lib/*.ts` + `__tests__`.
- Dependencies: TASK-01
- Story points: 3
- Criticality: high (correção do ranking depende disso)
- Technical risk: medium (regras de desempate)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: Sem I/O. Determinístico.

### TASK-03 – Route Handler de recálculo `/api/rankings/recalc`
- Type: api (backend)
- Goal: Recalcular rankings, estatísticas e snapshots a partir das predictions pontuadas.
- Scope: `POST /api/rankings/recalc` espelhando `/api/predictions/score` (auth dupla `x-cron-secret`/sessão admin; `runtime nodejs`; `dynamic force-dynamic`; idempotente; `set merge`). Lê `predictions` + `fetchAllMatches()`, junta `users` (name/nickname/status — só `approved`), aplica helpers TASK-02. Grava: `rankings/{scope}` (geral + 5 fases), `rankings/grupo-{groupId}`, `statistics/{uid}` (incl. **append** em `positionHistory`), doc agregado de stats gerais. Encadeável após o score.
- Main modules/files: `src/app/api/rankings/recalc/route.ts`, `src/server/...`, `__tests__/route.test.ts`.
- Dependencies: TASK-01, TASK-02
- Story points: 5
- Criticality: critical (fonte de verdade dos dados exibidos)
- Technical risk: high (correção, idempotência, exclusão de bloqueados/pendentes, timeout)
- Recommended TDD: yes (há padrão de route test no projeto)
- Recommended screen: no – n/a
- Notes: Excluir `blocked`/`pending` do ranking (regra de negócio). Sem Cloud Functions.

### TASK-04 – Serviços de leitura de ranking (Client SDK)
- Type: application (service)
- Goal: Funções de leitura Firestore validadas por Zod para as telas.
- Scope: Estender `src/services/rankings.ts`: `getRankingByScope(scope)`, `getGroupRanking(groupId)`, `getUserRanking(uid)` (meu ranking/posição), `getParticipantProfile(uid)` (stats + desempenho por fase), `getPoolStats()`. Erros crus (padrão atual). `.parse` por doc.
- Main modules/files: `src/services/rankings.ts`, `src/services/index.ts`, `__tests__/rankings.test.ts`.
- Dependencies: TASK-01
- Story points: 3
- Criticality: high
- Technical risk: low (segue padrão de `getGeneralRanking`)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: Reaproveitar/alinhar `getGeneralRanking` existente (não duplicar).

### TASK-05 – Hooks React Query de ranking
- Type: application
- Goal: Camada de cache/estado para as telas.
- Scope: `useRanking(scope)`, `useGroupRanking(groupId)`, `useMyRanking()`, `useParticipantProfile(uid)`, `usePoolStats()`. queryKeys `["ranking"]`, `["ranking-general"]`, `["ranking-stage", scope]`, `["ranking-group", groupId]`, `["ranking-user", uid]`, `["pool-stats"]`. Cache herdado do global (30min — A3). Alinhar `useGeneralRanking` da Home.
- Main modules/files: `src/features/rankings/hooks/*`, `src/features/rankings/index.ts`.
- Dependencies: TASK-04
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no (wiring; testar via componentes)
- Recommended screen: no – n/a
- Notes: Sem `staleTime`/`gcTime` por hook salvo decisão contrária.

### TASK-06 – Infra de gráficos (shadcn Chart / Recharts)
- Type: infra (ui-support)
- Goal: Primitivos de gráfico reutilizáveis (linha + distribuição).
- Scope: Adicionar `recharts` + componente `chart` do shadcn. Wrappers finos: `<EvolutionLineChart>` (posição/pontos por rodada) e `<DistributionBars>` (faixas — pode ser Tailwind/SVG puro, sem Recharts). Tokens de tema (verde) via CSS vars.
- Main modules/files: `src/components/ui/chart.tsx`, `src/features/rankings/components/charts/*`, `package.json`.
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – primitivos; estilização aplicada nas telas consumidoras
- Notes: Confirmar adoção de Recharts no checkpoint (R1). Distribuição pode dispensar a lib.

### TASK-07 – Shell de Ranking + estados + roteamento
- Type: ui
- Goal: Estrutura de navegação das telas e estados compartilhados.
- Scope: Substituir placeholder `src/app/(app)/rankings/page.tsx`. Sub-rotas: `/rankings` (Geral), `/rankings/fase`, `/rankings/evolucao`, `/rankings/perfil/[uid]`, `/rankings/estatisticas` (Meu Ranking pode ser `/rankings/eu` ou seção da Geral — decidir no screen). Componentes compartilhados: `RankingSkeleton`, `RankingEmpty`, `RankingError` (com "Tentar Novamente"). Abas/sub-nav internas.
- Main modules/files: `src/app/(app)/rankings/**`, `src/features/rankings/components/*`.
- Dependencies: TASK-05
- Story points: 3
- Criticality: high
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – nova navegação + layout/estados
- Design domains: ux, style, layout
- Design complexity: medium
- Accessibility level: enhanced (navegação por teclado nas abas, foco)
- Notes: Estados reutilizados pelas 6 telas.

### TASK-08 – Tela 01: Ranking Geral
- Type: ui
- Goal: Classificação completa com destaque do usuário.
- Scope: Abas **Geral / Por Fase / Por Grupo** (header). Pódio top-3 (avatares + coroa, conforme imagem). Lista: posição, nome, apelido, pontos, acertos, aproveitamento. **Destaque "Você"** (fundo verde claro + badge). Paginação client de 20. Estados loading/empty/error.
- Main modules/files: `src/features/rankings/components/GeneralRanking*`, rota `/rankings`.
- Dependencies: TASK-07, TASK-05
- Story points: 5
- Criticality: high (centerpiece)
- Technical risk: medium (destaque condicional + paginação + abas)
- Recommended TDD: no (UI; lógica em helpers já testados)
- Recommended screen: yes – web
- Design domains: style, color, typography, ux, layout
- Design complexity: high
- Accessibility level: enhanced (linhas como lista semântica, contraste do realce)
- Notes: Contrato visual = `PRD05-01-Ranking-Geral.png`.

### TASK-09 – Tela 03: Ranking por Fase (+ Por Grupo)
- Type: ui
- Goal: Desempenho por etapa e por grupo.
- Scope: Aba "Por Fase" = cards por fase (Grupos/Oitavas/Quartas/Semi/Final) com posição/pontos/acertos + ícone. Aba "Por Grupo" = seletor de grupo (A–L) + ranking do grupo. Fase sem dados → "-".
- Main modules/files: `src/features/rankings/components/StageRanking*`, `GroupRanking*`, rota `/rankings/fase`.
- Dependencies: TASK-07, TASK-05
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web
- Design domains: style, layout, ux
- Design complexity: medium
- Accessibility level: standard
- Notes: Contrato = `PRD05-03-Ranking-Por-Fase.png`.

### TASK-10 – Tela 02: Meu Ranking
- Type: ui
- Goal: Resumo do desempenho pessoal.
- Scope: Header verde "Sua Posição Atual #N de M participantes". Grid: Pontos, Acertos, Erros, Aproveitamento ("X de Y jogos"). Mini-gráfico "Desempenho Geral" (linha). Cards "Melhor Posição" e "Média de Pontos".
- Main modules/files: `src/features/rankings/components/MyRanking*`, rota.
- Dependencies: TASK-07, TASK-05, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web
- Design domains: style, typography, chart, layout
- Design complexity: medium
- Accessibility level: standard
- Notes: Contrato = `PRD05-02-Meu-Ranking.png`. Sob binário, "Pontos" e "Acertos" são o mesmo número — confirmar layout no screen (não duplicar rótulo redundante).

### TASK-11 – Tela 04: Evolução no Ranking
- Type: ui
- Goal: Histórico de posição ao longo das rodadas.
- Scope: Gráfico de linha (posição por rodada, header verde). Lista de rodadas: rodada, posição, indicador `↑ subiu / — manteve / ↓ caiu` + delta, badge "Atual". Legenda. Empty quando sem histórico.
- Main modules/files: `src/features/rankings/components/Evolution*`, rota `/rankings/evolucao`.
- Dependencies: TASK-07, TASK-05, TASK-06, TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no (indicador já testado em TASK-02)
- Recommended screen: yes – web
- Design domains: chart, style, ux, color
- Design complexity: medium
- Accessibility level: enhanced (gráfico precisa alternativa textual = a própria lista)
- Notes: Contrato = `PRD05-04-Evolucao-Ranking.png`.

### TASK-12 – Tela 05: Perfil do Participante
- Type: ui
- Goal: Estatísticas de outro participante.
- Scope: Header avatar + nome + "Participante desde". Card "Posição Atual #N de M". Grid Pontos/Acertos/Erros/Aproveitamento. "Desempenho por Fase". Botão "Ver histórico de palpites" (**depende de A5 — visibilidade de palpites alheios**).
- Main modules/files: `src/features/rankings/components/ParticipantProfile*`, rota `/rankings/perfil/[uid]`.
- Dependencies: TASK-07, TASK-04/05
- Story points: 3
- Criticality: medium
- Technical risk: medium (A5 aberto — botão pode virar no-op/oculto)
- Recommended TDD: no
- Recommended screen: yes – web
- Design domains: style, layout, ux
- Design complexity: medium
- Accessibility level: standard
- Notes: Contrato = `PRD05-05-Perfil-Participante.png`. Resolver A5 antes.

### TASK-13 – Tela 06: Estatísticas Gerais
- Type: ui
- Goal: Visão agregada do bolão.
- Scope: Header "Visão Geral do Bolão — N Participantes". Cards Maior Pontuação (+nome), Menor Pontuação, Média Geral, Total de Acertos. "Distribuição de Pontuação" (barras horizontais por faixa, com contagem).
- Main modules/files: `src/features/rankings/components/PoolStats*`, rota `/rankings/estatisticas`.
- Dependencies: TASK-07, TASK-05, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web
- Design domains: chart, style, layout, color
- Design complexity: medium
- Accessibility level: standard
- Notes: Contrato = `PRD05-06-Estatisticas-Gerais.png`. Distribuição pode ser barras Tailwind (sem Recharts).

### TASK-14 – Firestore Rules + indexes + encadeamento do recalc
- Type: infra (security)
- Goal: Travar escrita do cliente e garantir recálculo no fluxo.
- Scope: `firestore.rules`: `rankings`, `statistics`, doc de stats gerais → `allow read` (usuário `approved`), `allow write: if false`. Índices se as queries finais exigirem (provável dispensável no doc-por-escopo). Encadear `/api/rankings/recalc` após `/api/predictions/score` (cron sequencial ou chamada interna).
- Main modules/files: `firestore.rules`, `firestore.indexes.json`, doc/infra de cron.
- Dependencies: TASK-03
- Story points: 2
- Criticality: high (segurança — pontuação só backend)
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: Critério de aceite PRD: usuário não altera ranking; cálculo só backend.
- **Carry-forward dos reviews:**
  - TASK-01 WR-01/WR-02 (opcional): `.refine` `min≤max` em `distributionBucketSchema` e `lowestPoints≤highestPoints` em `poolStatsSchema` (dados server-generated).
  - TASK-03 WR-01: comparar secret com `crypto.timingSafeEqual` nos DOIS endpoints (`/api/predictions/score` e `/api/rankings/recalc`).
  - TASK-03 WR-02 (médio): `positionHistory` só deve fazer append quando o estado mudou (ex.: `finishedGeral` aumentou) — definir junto com a cadência do cron p/ não poluir a Tela 04 nem crescer sem limite.

## 4. Dependency map

```
TASK-01 ── TASK-02 ──┐
   │                 ├── TASK-03 ── TASK-14
   ├── TASK-04 ── TASK-05 ── TASK-07 ── TASK-08
   │                            │       └─ TASK-09
TASK-06 ─────────────────────────┤       ├─ TASK-10 ── TASK-11
                                 │       ├─ TASK-12
                                 └───────┴─ TASK-13
```

## 5. Execution waves (parallel groups)

- **Wave 1:** TASK-01, TASK-06 (independentes)
- **Wave 2:** TASK-02, TASK-04 (dep 01)
- **Wave 3:** TASK-03 (dep 01,02), TASK-05 (dep 04)
- **Wave 4:** TASK-14 (dep 03), TASK-07 (dep 05) — paralelos
- **Wave 5:** TASK-08, TASK-09 (dep 07,05)
- **Wave 6:** TASK-10, TASK-13 (dep 07,05,06)
- **Wave 7:** TASK-11 (dep 10,06,02), TASK-12 (dep 07,05; após A5)

## 6. Recommended execution order (sequential fallback)

01 → 02 → 04 → 03 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 13 → 12 → 14

**Início recomendado: TASK-01** (contrato base; desbloqueia tudo).

## 7. Planning risks and blockers

- **R1 (decisão):** Lib de gráfico. CLAUDE.md não define charting; Recharts/framer-motion ausentes do `package.json`. Recomendação: shadcn Chart (Recharts) só na Evolução; distribuição em Tailwind puro. Confirmar no checkpoint.
- **R2 (bloqueador — A5):** Visibilidade de palpites de outros participantes (botão "Ver histórico" da Tela 05). Precisa decisão de produto + Firestore Rules antes da TASK-12. Até lá, botão oculto/desabilitado.
- **R3:** TASK-01 altera `rankingEntrySchema` já consumido por `getGeneralRanking`/card da Home — risco de regressão. Mitigar com testes de compat + verificação da Home.
- **R4:** TASK-03 correção/idempotência sob dados reais; excluir `blocked`/`pending`; risco de timeout iterando predictions. Mirror do padrão de score + paralelismo.
- **R5 (desvio consciente):** Cache 30min (global) em vez de 5min (PRD). Aceito por simplicidade (<100 users). Reverter trivial se necessário.
- **R6:** Evolução sem histórico retroativo — só popula a partir do go-live do recalc. Empty state nas Telas 02/04.
- **R7:** Desempate por "data do 1º palpite" exige `createdAt` confiável (hoje `optional` em predictions). Fallback estável por uid.
