# PLAN — Home Revamp

## 1. Planning summary

Redesign da Home (`/home`) puramente de UI + reaproveitamento de dados já agregados.
Decisão de planejamento-chave: **scoring client-side** para o Raio-X — como o bloco
"Jogos abertos" (E) já precisa carregar **todas** as partidas (`useMatchesList`, já
existente), o Raio-X (H) reusa essas partidas + `predictions` para contar exato/só-vencedor/erro
via `scorePrediction`. Isso **elimina** qualquer mudança em `recalc.ts`/`statisticsSchema`
(o gap "partial não persistido" deixa de importar). Promessa "UI-only" mantida: nenhuma
coleção/rota/schema novo.

4 tasks, uma por bloco redesenhado + uma de recomposição/limpeza. Cada bloco é uma fatia
vertical (hook → derivação pura → card), seguindo a disciplina do compositor: lógica em
`homeDashboardHelpers.ts` (testável), cards burros. `is_frontend: true` → cada task passa por
ui-spec → patterns:nextjs → ui-review. Mobile-first.

## 2. Recommended execution phases

- **Fase 1 – Fundação + Hero (TASK-01):** novo hook `usePoolStats`, derivação do hero
  (tendência + denominador + percentil), HeroCard. Estabelece o padrão.
- **Fase 2 – Ação (TASK-02):** wiring de `useMatchesList` no compositor + Jogos abertos +
  faixa de avisos absorvida. Habilita o carregamento de partidas que a Fase 3 reusa.
- **Fase 3 – Insight (TASK-03):** Raio-X donut (reusa partidas da Fase 2).
- **Fase 4 – Recomposição (TASK-04):** reordena a grade, polê estados loading/empty/erro,
  remove cards/helpers mortos, atualiza testes do HomeDashboard.

## 3. Tasks

### TASK-01 – Hero card + régua de percentil (substitui o trio)
- Type: application
- Goal: substituir os 3 cards compactos (Ranking/Acertos/Aproveitamento) por um Hero único
  que comunica posição + tendência + aproveitamento com denominador + streak + sparkline, e
  uma régua de percentil do usuário vs o bolão.
- Scope:
  - Novo hook `usePoolStats` (read client-side de `pool_stats/current`; staleTime por tier).
  - Nova derivação pura `deriveHeroSummary` em `homeDashboardHelpers.ts`:
    - posição + delta de tendência a partir de `positionHistory` (compara os 2 últimos
      snapshots; `round` = nº de recalc; sem série → tendência neutra/oculta);
    - aproveitamento (`accuracy`) + denominador legível ("X de N") — N derivado de
      `totalCorrect`+`totalWrong` (fallback quando `totalWrong` ausente: omitir denominador);
    - `longestStreak`; pontos do usuário (ranking entry);
    - posição na régua de percentil a partir de `pool_stats`
      (`averagePoints`/`highestPoints`/`lowestPoints` + pontos do usuário).
  - `HeroCard` (UI) com sparkline (recharts ou SVG leve) + régua; estados loading/empty.
  - Wire no `useHomeDashboard` (expõe `heroSummary`) e no `HomeDashboard` (remove o trio).
- Main modules/files: `src/features/home/hooks/usePoolStats.ts` (novo), `homeDashboardHelpers.ts`,
  `useHomeDashboard.ts`, `components/HeroCard.tsx` (novo), `HomeDashboard.tsx`,
  `homeKeys.ts`; remove `RankingCard`/`CorrectScoresCard`/`AccuracyCard` (+ seus testes).
- Dependencies: nenhuma (fundação).
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (cálculo de tendência, denominador, posição na régua — regras com bordas)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: maior risco de empty-state — conta nova/pré-torneio sem `positionHistory` nem
  pontos. Tendência só quando há ≥2 snapshots; régua só quando `pool_stats` existe. Verificar
  contraste/aria-label do sparkline e da régua (equivalente textual obrigatório).

### TASK-02 – Jogos abertos pra palpitar + faixa de avisos (substitui Fase Atual; remove Avisos)
- Type: application
- Goal: substituir o card "Fase Atual" (vazio) por uma lista acionável de jogos abertos sem
  palpite, com deadline e CTA; absorver os avisos reais (trava/prazo/cadastro) como faixa fina,
  eliminando o card "Avisos".
- Scope:
  - Wire `useMatchesList` (hook existente em `features/matches`) no compositor `useHomeDashboard`.
  - Nova derivação pura `deriveOpenMatches`: filtra partidas `scheduled` com kickoff futuro e
    **não** travadas (`isPredictionLocked`) que **não** têm prediction do usuário; ordena por
    kickoff; resolve teams; calcula "fecha em Xh"/deadline; limita a N itens.
  - `OpenMatchesCard` (UI) com lista + CTA "Palpitar" (href para `/matches/{id}/predict`);
    estado empty ("Você está em dia! Nenhum jogo aberto").
  - Faixa fina de avisos: reusa `deriveNotices` (já existe) renderizada compacta dentro do
    OpenMatchesCard ou do NextMatchCard; remove `NoticesCard`.
  - Remove `CurrentStageCard` (e helper `deriveCurrentStage` se não usado em outro lugar).
- Main modules/files: `useHomeDashboard.ts`, `homeDashboardHelpers.ts`,
  `components/OpenMatchesCard.tsx` (novo), `HomeDashboard.tsx`; remove
  `CurrentStageCard`/`NoticesCard` (+ testes); reusa `useMatchesList`, `isPredictionLocked`.
- Dependencies: nenhuma (independente da TASK-01).
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (filtro de elegibilidade + lock + cálculo de deadline — regra de negócio sensível)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `isPredictionLocked` exige `now` injetado (nunca `new Date()` interno) — manter para
  testabilidade. Não duplicar a linha "jogos abertos" com a faixa de avisos. Cuidar do volume:
  no início do torneio quase todos os jogos estão abertos → limitar a N (ex.: 3) e indicar "+ N
  outros" para não estourar a Home.

### TASK-03 – Raio-X dos palpites (donut; substitui Meu Desempenho)
- Type: application
- Goal: substituir o card "Meu Desempenho" (redundante) por um donut que mostra a textura real
  dos palpites: placar exato (10) / só vencedor (5) / erro (0).
- Scope:
  - Nova derivação pura `derivePredictionBreakdown`: sobre todas as partidas `finished`
    (de `useMatchesList`) × `predictions` do usuário, aplica `scorePrediction` e tabula
    contagens por `status` (`correct`/`partial`/`wrong`); ignora jogos sem palpite.
  - `RaioXCard` (UI) com donut (recharts) + legenda com contagens e %; estado empty
    ("Faça seu primeiro palpite para ver seu raio-X").
  - Wire no compositor (expõe `predictionBreakdown`) e no `HomeDashboard`; remove `PerformanceCard`
    (e helper `derivePerformanceSummary` se não usado em outro lugar).
- Main modules/files: `homeDashboardHelpers.ts`, `useHomeDashboard.ts`,
  `components/RaioXCard.tsx` (novo), `HomeDashboard.tsx`; remove `PerformanceCard` (+ teste);
  reusa `scorePrediction`, `useMatchesList`.
- Dependencies: TASK-02 (reaproveita o wiring de `useMatchesList` no compositor).
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (tabulação 3-vias por status — cálculo central da feature)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: resolve o gap "partial não persistido" no cliente (scoring sobre matches já em cache —
  sem custo de rede extra, sem tocar recalc). Donut precisa de fallback textual/aria; tratar o
  caso "tudo zero" (sem palpites finalizados) como empty, não donut vazio.

### TASK-04 – Recomposição da Home + estados + limpeza
- Type: refactor-support
- Goal: recompor a grade da Home com os 3 novos blocos + os preservados, padronizar
  skeletons/empty/erro, remover código morto e atualizar os testes do HomeDashboard.
- Scope:
  - Reordenar `HomeDashboard.tsx`: Header → Hero → NextMatch → OpenMatches → LastResults → Raio-X.
  - Skeletons dos 3 novos cards (sem layout shift) e revisão do estado de erro de página.
  - Remover helpers/tipos órfãos em `homeDashboardHelpers.ts` (ex.: `deriveCurrentStage`,
    `derivePerformanceSummary`, `RankingSummary` se não mais usados) e limpar o barrel/index.
  - Atualizar `HomeDashboard.test.tsx` e remover testes dos cards excluídos.
- Main modules/files: `HomeDashboard.tsx`, `components/index.ts`, `homeDashboardHelpers.ts`,
  `__tests__/HomeDashboard.test.tsx`.
- Dependencies: TASK-01, TASK-02, TASK-03.
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (recomposição/wiring; testes de composição atualizados na fase test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: garantir que nenhuma query órfã sobre no compositor após remover cards; conferir que o
  `isLoading/isError` agregado ainda cobre as novas queries (`usePoolStats`, `useMatchesList`).

## 4. Dependency map

- TASK-01 → (sem deps)
- TASK-02 → (sem deps)
- TASK-03 → depende de **TASK-02** (wiring de `useMatchesList`)
- TASK-04 → depende de **TASK-01, TASK-02, TASK-03**

TASK-01 e TASK-02 podem rodar em paralelo. TASK-03 após TASK-02. TASK-04 por último.

## 5. Recommended execution order

1. **TASK-01** – Hero + percentil (fundação, define o padrão visual e o uso de pool_stats)
2. **TASK-02** – Jogos abertos + faixa de avisos (habilita carregamento de partidas)
3. **TASK-03** – Raio-X donut (reusa partidas da TASK-02)
4. **TASK-04** – Recomposição + limpeza + testes

## 6. Planning risks and blockers

- **Empty-states são o maior risco transversal:** todos os blocos podem cair em "sem dados"
  (conta nova, pré-torneio, sem partidas finalizadas). Cada task entrega empty-state intencional
  com mensagem útil — não "--" mudo. Verificar explicitamente na fase review/ui-review.
- **Tendência de ranking (TASK-01):** `positionHistory` só ganha ponto quando a posição muda →
  série esparsa; sparkline com 1 ponto não é gráfico. Regra clara: tendência/sparkline só com
  ≥2 snapshots.
- **Volume de jogos abertos (TASK-02):** início de torneio = quase tudo aberto → limitar lista.
- **Sem blocker externo:** nenhuma dependência de clarificação pendente nem mudança de backend.
  Decisão do gap (scoring client-side) já tomada e auto-suficiente.
- **TDD recomendado** em TASK-01/02/03 (derivações com regras de borda). TASK-04 sem TDD
  (recomposição).
