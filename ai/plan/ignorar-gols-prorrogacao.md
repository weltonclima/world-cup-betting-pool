# PLAN — Ignorar gols de prorrogação nas eliminatórias (config por grupo)

## 0. Descobertas da verificação goal-backward (IMPORTANTE)
Uma verificação do plano contra o objetivo revelou que `scorePrediction` **não é
consumido só pelo `recalc.ts`**. São **5 call sites**, e a flag é **por pool**,
enquanto vários consumidores são **globais**:

1. `recalc.ts:271` — recalc GLOBAL: pontua cada usuário **uma única vez**
   (`aggByUid`) e **reaproveita** o mesmo agregado para o doc global `geral` **e**
   para cada `pool-{poolId}-geral` (re-rankeado entre membros). ⇒ Como a pontuação
   é feita uma vez, dois pools com flags diferentes **não podem** compartilhar o
   mesmo agregado. Aplicar a flag por-pool aqui exige **re-pontuar por pool** ao
   escrever os docs `pool-*` (mudança estrutural), OU aceitar que o recalc global
   escreve os docs de pool sempre no placar final.
2. `recalc.ts:764` — recalc POR-POOL (botão do group_admin): já pontua isolado por
   pool → aplica a flag limpo. **Mas escreve o MESMO doc `pool-{poolId}-geral`** que
   o recalc global — se só um dos dois aplicar a flag, o outro sobrescreve.
   ⇒ Ambos precisam ser consistentes.
3. `score/route.ts:267` — **persiste `{status, points}` no doc de prediction**
   (global, 1 por user/match). Não há como representar pools com flags diferentes
   num único valor persistido. Alimenta notificações/exibição.
4. `home/useHomeDashboard.ts:241` + `homeDashboardHelpers.ts:304` — exibição (home)
   recomputa sem contexto de pool.
5. `usePredictionsList.ts` + `useProfilePredictions.ts` (via
   `derivePredictionDisplayStatus`) — badges de "acertou/errou" sem contexto de pool.

**Consequência:** o objetivo "efeito retroativo consistente" tem um limite
arquitetural — ranking/pontos GLOBAIS (cross-pool) e o `points` persistido não
comportam uma flag por-pool. O que É viável e coerente: aplicar a flag em TUDO que
é **escopado por pool** (docs `pool-*` nos dois recalcs) e, opcionalmente, nas
**telas de exibição** (cada usuário pertence a exatamente um pool → dá para
recomputar com a flag do seu pool). O doc global `geral` e o `points` persistido
permanecem no placar final.

Isso adiciona a **TASK-04** (consistência de exibição) e torna a **TASK-03** mais
robusta (re-pontuar por pool nos dois recalcs + gate). Também adiciona o **bump de
`CACHE_VERSION`** (v3→v4) à TASK-01.

## 1. Resumo do planejamento
Feature decomposta em **3 tarefas core + 1 decisão-gated**, na ordem
fundação → contrato → regra de negócio → (opcional) exibição:

1. **Dados ESPN → placar regulamentar (90min):** mapear o array `details`,
   corrigir a detecção de prorrogação (`STATUS_FINAL_AET`) e derivar/persistir
   `homeScoreRegulation`/`awayScoreRegulation` no `matchSchema`.
2. **Config de pool:** flag `ignoreOvertimeGoals` no schema + route + form (padrão
   consolidado do `splitPhaseRanking`).
3. **Pontuação:** `scorePrediction` + `recalc.ts` passam a comparar contra o placar
   de 90min quando a flag do pool está ligada e o jogo é de mata-mata com
   prorrogação.

TASK-01 e TASK-02 são **independentes** entre si (podem ser feitas em qualquer
ordem); TASK-03 **depende de ambas** (precisa do placar regulamentar e da flag).
A tarefa de maior risco é a TASK-01 (parsing de dados externos, casos de borda) e
a mais crítica é a TASK-03 (mexe no núcleo da pontuação). Ambas com TDD.

## 2. Fases de execução recomendadas
- **Fase 1 – Fundação de dados:** TASK-01 (placar regulamentar via ESPN).
- **Fase 2 – Contrato/config:** TASK-02 (flag de pool). Paralelizável com Fase 1.
- **Fase 3 – Regra de negócio:** TASK-03 (aplicar na pontuação/recalc).

## 3. Tasks

### TASK-01 – Derivar e persistir o placar regulamentar (90min) a partir da ESPN
- Type: integration
- Goal: obter, para partidas de mata-mata que foram à prorrogação, o placar do
  tempo normal (90min + acréscimos), reconstruído do array `details` da ESPN, e
  persisti-lo em novos campos do match.
- Scope:
  - Mapear o array `details` em `espnTypes.ts` (novo sub-schema: `clock.value`,
    `clock.displayValue`, `scoringPlay`, `shootout`, `penaltyKick`, `ownGoal`,
    `team.id`, `scoreValue`). `.passthrough()` no resto.
  - Corrigir `mapOutcome` para reconhecer **`STATUS_FINAL_AET`** (→ `overtime`),
    além do `STATUS_OVERTIME` legado. Bug pré-existente.
  - Função pura `deriveRegulationScore(details, competitors)` → `{ home, away }`:
    soma `scoreValue` dos gols com `clock.value ≤ 5400` (90min), excluindo
    `shootout`. Tratar gol contra (creditar ao lado correto) e pênalti em jogo
    (`penaltyKick && !shootout` conta). Retorna `null` se `details` ausente.
  - Novos campos opcionais em `matchSchema`: `homeScoreRegulation`/
    `awayScoreRegulation` (int ≥ 0), preenchidos só em mata-mata finalizado com
    `outcome === "overtime"`. Aditivos.
  - `mapEspnEventToMatch` popula os campos quando aplicável.
  - **Bump `CACHE_VERSION` v3→v4** em `src/server/worldcup/cache.ts` (força
    recompute de snapshots `worldcup_cache` bracket/groups sem os novos campos).
    Verificar também a invalidação do cache de `/api/matches` (sem campo
    `version`) — garantir que o novo payload não sirva stale.
- Main modules/files likely involved:
  - `src/server/copaData/espnTypes.ts` (schema `details`)
  - `src/server/copaData/espnMapper.ts` (`mapOutcome`, nova derivação, wiring)
  - `src/schemas/matches.ts` (novos campos + refine)
  - `src/server/worldcup/cache.ts` (bump `CACHE_VERSION`)
  - `__tests__` correspondentes + fixtures ESPN
- Dependencies: nenhuma
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Risco alto = parsing de dados externos com amostra pequena. Review
  adversarial (opus): H1 (corte via displayValue), M1 (guarda team.id), M2
  (penalties também), M3 (schema tolerante), L1 (+1) — todos corrigidos. Cobrir em
  teste: jogo com gol na prorrogação (90min = empate), jogo sem prorrogação
  (regulation == final ou ausente), gol de acréscimo do 1º/2º tempo (clock capado
  → conta no regulamentar), pênalti em jogo, gol contra, `details` ausente →
  `null` (fallback). Fallback seguro é regra: sem placar regulamentar, TASK-03 usa
  o final.

### TASK-02 – Config de pool `ignoreOvertimeGoals`
- Type: api
- Goal: permitir que group_admin/super_admin habilite "ignorar gols de
  prorrogação" nas configurações do grupo, persistido no pool.
- Scope:
  - `ignoreOvertimeGoals?: boolean` em `poolSchema` (aditivo, default `false` na
    leitura, sem `.default()`) e em `poolEditSchema`.
  - `settingsSchema` da rota + montagem do patch em
    `POST/PATCH /api/group/settings` (espelhar `splitPhaseRanking`).
  - `Switch` em `GroupSettingsForm.tsx` (estado, reset em `useEffect`, diff no
    submit) — bloco análogo ao "Dividir ranking por fase".
  - Tipo em `src/types/pools.ts` (derivado do schema; normalmente automático).
- Main modules/files likely involved:
  - `src/schemas/pools.ts`
  - `src/app/api/group/settings/route.ts` (+ `__tests__`)
  - `src/features/groupAdmin/components/GroupSettingsForm.tsx` (+ `__tests__`)
- Dependencies: nenhuma (independente da TASK-01)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (padrão consolidado; testes junto no /test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: is_frontend parcial (toggle no form). ui-spec/patterns pulados (Switch
  idêntico ao splitPhaseRanking, sem novo padrão visual). Não adicionado ao
  poolEditSchema (espelha splitPhaseRanking, que também não está lá). — o /ui-spec pode ser dispensado por
  ser um Switch idêntico ao existente; decidir no spec. Precedente exato:
  `splitPhaseRanking` (route.ts:29,104; form linhas 275-294).

### TASK-03 – Aplicar o placar de 90min na pontuação do RANKING (por pool, nos dois recalcs)
- Type: domain
- Goal: quando o pool tem `ignoreOvertimeGoals` ligado, pontuar palpites de jogos
  de **mata-mata com prorrogação** contra o placar regulamentar (90min) nos docs
  de ranking **escopados por pool** (`pool-*`), de forma consistente entre o
  recalc global e o recalc por-pool. O ranking global `geral` (cross-pool) e o
  `points` persistido permanecem no placar final.
- Scope:
  - Estender `scorePrediction` com um parâmetro opcional
    `options?: { ignoreOvertimeGoals?: boolean }` (função **pura**, default =
    comportamento atual). Helper `effectiveMatchScore(match, options)` retorna o
    par `{home, away}` a comparar: regulamentar quando `ignoreOvertimeGoals` +
    `stage !== "grupos"` + `homeScoreRegulation` presente; senão placar final.
  - `recalcPoolRanking` (recalc.ts:764): lê `pool.ignoreOvertimeGoals` (já tem o
    pool em escopo) e passa ao scoring.
  - `recalcRankings` global (recalc.ts:255-405): ao computar/escrever os docs
    `pool-{poolId}-geral` (e `pool-{poolId}-{fase}`/grupos), **re-pontuar por pool**
    com a flag daquele pool — não reutilizar o agregado global para pools com flag
    on. O doc global `geral` continua no agregado de placar final.
  - Gate: aplicar só a `stage !== "grupos"`. Fallback: sem `homeScoreRegulation`
    (sem prorrogação ou `details` ausente) → placar final. Flag off → placar final.
- Main modules/files likely involved:
  - `src/features/predictions/lib/predictionsHelpers.ts` (`scorePrediction` +
    `effectiveMatchScore`)
  - `src/server/rankings/recalc.ts` (ambos os call sites; re-pontuar por pool)
  - `__tests__` correspondentes
- Dependencies: TASK-01 (placar regulamentar) + TASK-02 (flag)
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Núcleo de pontuação → critical + risk high. Review adversarial (opus)
  confirmou consistência/isolamento/regressão-zero. M1 corrigido: PATCH de settings
  dispara recalcRankingsBestEffort ao mudar a flag (coerência de todos os docs do
  pool). L1 (statistics/pool_stats globais) tratado na TASK-04. (re-estrutura agregação por
  pool no recalc global). Manter `scorePrediction` puro/idempotente e o default
  byte-idêntico ao atual. **Testes de regressão obrigatórios:** flag off / sem
  options → retorno idêntico ao atual (caminho global intacto). Cobrir: flag on +
  prorrogação (90min), flag on + sem prorrogação (final), flag on + grupos (final,
  gate), flag off (final), regulamentar ausente (fallback), consistência entre os
  dois recalcs no mesmo `pool-{poolId}-geral`. Efeito só no recálculo; retroativo.

### TASK-04 – Consistência de exibição das telas com a flag do pool (CONFIRMADA — escopo B)
- Type: application
- Goal: fazer as telas que exibem resultado por-jogo (home, lista de palpites,
  perfil) refletirem a flag do pool do usuário, para não contradizer o ranking em
  jogos de mata-mata com prorrogação. **Confirmada no checkpoint (opção B).**
- Scope:
  - Threa­d a flag do pool do usuário (via `groupId` → pool) nos hooks de exibição:
    `useHomeDashboard`, `usePredictionsList`, `useProfilePredictions`, passando
    `options` ao `scorePrediction`/`derivePredictionDisplayStatus`.
  - Opcional: badge/nota "placar considerado: 90min" nos jogos afetados.
  - **Não** alterar `score/route.ts` (persistência global permanece no final; o
    ranking é recomputado por recalc, não a partir do `points` persistido).
- Main modules/files likely involved:
  - `src/features/home/{hooks,lib}/*`, `src/features/predictions/hooks/usePredictionsList.ts`,
    `src/features/rankings/hooks/useProfilePredictions.ts`,
    `src/features/predictions/lib/predictionsHelpers.ts` (`derivePredictionDisplayStatus`)
- Dependencies: TASK-01 + TASK-02 + TASK-03
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (exibição; testes no /test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: is_frontend: true (telas). Decisão do usuário no checkpoint do plano: (A)
  ranking-only (não faz TASK-04, documenta que badges por-jogo podem divergir em
  jogos de prorrogação) OU (B) consistência total (faz TASK-04). Recomendação: (A)
  como MVP, (B) como follow-up.

## 4. Mapa de dependências
- TASK-01 → (nenhuma dependência)
- TASK-02 → (nenhuma dependência)
- TASK-03 → depende de **TASK-01 e TASK-02**
- TASK-04 → depende de **TASK-01, TASK-02 e TASK-03** (e da decisão A/B do usuário)

## 5. Ordem de execução recomendada
1. **TASK-01** (fundação de dados; maior risco, atacar cedo) — inclui bump de cache
2. **TASK-02** (config; independente, pode ir em paralelo/qualquer ordem)
3. **TASK-03** (regra de negócio no ranking; precisa das duas anteriores)
4. **TASK-04** (consistência de exibição; só se o usuário escolher consistência total)

## 6. Riscos de planejamento e bloqueios
- **DECISÃO TOMADA (escopo de consistência): (B) consistência total** — o usuário
  optou por incluir a **TASK-04** (telas home/lista de palpites/perfil refletem a
  flag do pool). Ranking global `geral` cross-pool e `points` persistido seguem no
  placar final (limite arquitetural imutável).
- **Limite arquitetural (imutável):** ranking GLOBAL `geral` (cross-pool) e o
  `points` persistido em `score/route.ts` **não** comportam flag por-pool — ficam
  no placar final por design. A feature é coerente só no escopo por-pool.
- **TASK-01 — risco alto:** reconstrução do placar de 90min de dados externos,
  amostra pequena (2 jogos). Mitigação: TDD com casos de borda + fallback seguro
  (sem regulation → final). Corte `clock.value ≤ 5400` a confirmar; parse de
  `displayValue` ("90'+X'" vs "93'") como reforço. Inclui bump `CACHE_VERSION`.
- **TASK-03 — a mais crítica + risk high:** re-estrutura a agregação por pool no
  recalc global (os dois recalcs escrevem o mesmo doc `pool-*` → precisam ser
  consistentes). Regressão afeta todos os rankings. Mitigação: função pura + review
  opus/high + testes de regressão (flag off idêntico ao atual).
- **Bug do `STATUS_FINAL_AET`:** corrigir em TASK-01 muda `outcome` de jogos hoje
  marcados "normal" → "overtime"; validar que exibição de bracket não regride.
- **Retroatividade:** ligar a flag muda ranking no próximo recálculo (esperado).
- plan-checker GSD indisponível no ambiente → usada verificação goal-backward
  equivalente (agente Plan); achados incorporados acima (seção 0).
