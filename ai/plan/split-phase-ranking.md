# PLAN — Divisão de ranking por fase (grupos × eliminatória), opt-in por pool

> Feature slug: `split-phase-ranking`. PRD: `ai/prd/split-phase-ranking.md`.
> Decisões travadas: Home/Perfil mostram os DOIS lado a lado · flag embutida no
> payload de `/api/rankings/pool` · só group_admin nesta entrega.

## 1. Planning summary
Feature de **exibição** controlada por flag por pool (`splitPhaseRanking`,
default OFF). O dado já existe (recalc grava `pool-{id}-grupos` e
`pool-{id}-eliminatorias`). O trabalho é: (1) persistir a flag + backend do
toggle, (2) expor a flag às telas via payload de ranking, (3) UI do toggle p/
group_admin, (4-5) ramos condicionais nas telas de ranking. Tudo gated: ramo OFF
intocado (retrocompat).

## 2. Recommended execution phases
- **Fase 1 – fundação (backend)**: TASK-01 (flag + toggle backend), TASK-02
  (flag no payload de ranking).
- **Fase 2 – exposição admin**: TASK-03 (toggle UI group_admin).
- **Fase 3 – exibição (membro)**: TASK-04 (split em `/rankings`), TASK-05
  (split em Home hero + Perfil).

## 3. Tasks

### TASK-01 – Flag de persistência + backend do toggle
- Type: persistence
- Goal: Adicionar `splitPhaseRanking?: boolean` ao pool e permitir que o
  group_admin grave o valor via `/api/group/settings`, espelhando 1:1 o fluxo de
  `predictionsLocked`.
- Scope: campo aditivo optional no `poolSchema` (default na LEITURA, não no
  schema); incluir em `settingsSchema` do route group/settings e no monte do
  patch (`if (splitPhaseRanking !== undefined) patch[...] = ...`); tipo derivado.
  NÃO tocar `poolEditSchema`/super_admin (fora de escopo).
- Main modules/files likely involved:
  - `src/schemas/pools.ts` (poolSchema + `poolEditSchema` NÃO)
  - `src/schemas/__tests__/pools.test.ts`
  - `src/app/api/group/settings/route.ts` (settingsSchema + PATCH)
  - `src/types/*` (se o tipo de pool for derivado manualmente)
- Dependencies: nenhuma
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (validação de schema + persistência do campo)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Aditivo — docs antigos seguem fazendo parse. `.strict()` em poolSchema
  aceita o campo pois ele é declarado. Default OFF aplicado na leitura (telas).

### TASK-02 – Expor `splitPhaseRanking` no payload de `/api/rankings/pool`
- Type: api
- Goal: A resposta de `GET /api/rankings/pool` passa a carregar a flag do pool
  para que as telas de membro decidam o que renderizar — sem endpoint novo.
- Scope: ler `pools/{groupId}.splitPhaseRanking` no route; anexar à resposta
  (`{ ...ranking, entries, splitPhaseRanking }`); criar schema de resposta
  dedicado (`rankingSchema.extend({ splitPhaseRanking: z.boolean().optional() })`,
  pois `rankingSchema` é `.strict()`); atualizar `getPoolRanking` para parsear
  com o novo schema e o tipo de retorno de `usePoolRanking`. `null` (sem pool)
  permanece `null`; ausência de flag = OFF.
- Main modules/files likely involved:
  - `src/app/api/rankings/pool/route.ts`
  - `src/schemas/rankings.ts` (novo `poolRankingResponseSchema`)
  - `src/services/rankings.ts` (`getPoolRanking` parse + tipo)
  - `src/types/*` (tipo `PoolRanking`/extensão `Ranking`)
  - `src/features/rankings/hooks/usePoolRanking.ts` (tipo de retorno)
  - testes de route + service
- Dependencies: TASK-01
- Story points: 2
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (parse strict + presença/ausência da flag)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Isolamento multi-tenant intacto — `groupId` vem da sessão, nunca do
  request. Não vazar outros campos do pool: anexar SÓ `splitPhaseRanking`.

### TASK-03 – Toggle UI no formulário de settings do group_admin
- Type: application
- Goal: group_admin liga/desliga a divisão no formulário de configurações do
  grupo (`/group/settings`), espelhando o `Switch` de `allowInvites`.
- Scope: novo `Switch` "Dividir ranking por fase" (rótulo/descrição pt-BR) em
  `GroupSettingsForm.tsx`, espelhando 1:1 o padrão do `allowInvites` (linhas
  58, 259-261); ler valor do GET settings; enviar no PATCH; estado loading/erro
  como os toggles existentes. is_frontend: true.
- Main modules/files likely involved:
  - `src/features/groupAdmin/components/GroupSettingsForm.tsx`
  - teste correspondente de `GroupSettingsForm`
  - hook/serviço de settings do group_admin (mesmo usado por allowInvites)
- Dependencies: TASK-01
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (wiring de UI sobre padrão existente; cobertura via
  /test do componente)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review
- Notes: is_frontend → roda /ui-spec + /patterns:nextjs + /ui-review. Reusar
  componente Switch e copy/disposição do predictionsLocked.

### TASK-04 – Split em `/rankings` (GeneralRanking)
- Type: application
- Goal: Quando a flag ON, `/rankings` mostra dois rankings (Grupos +
  Eliminatórias) lado a lado/abas; OFF mantém o `geral` cumulativo atual.
- Scope: ramo condicional em `GeneralRanking` lendo `splitPhaseRanking` do
  `usePoolRanking`; quando ON, renderizar duas listas via
  `usePoolRankingByScope("grupos")` e `usePoolRankingByScope("eliminatorias")`,
  reusando componentes de `PhaseRanking`/`StageRankingCard` (pódio/linha/empty/
  skeleton). Empty state quando a fase eliminatória ainda não tem dados. Ramo
  OFF idêntico ao atual. is_frontend: true.
  **Gating obrigatório (W2):** estender `usePoolRankingByScope(scope, options?)`
  com `enabled` (e incluir `groupId`/scope na query-key) para NÃO disparar as 2
  leituras de escopo quando a flag está OFF. Em `/rankings`, chamar os hooks com
  `enabled: splitPhaseRanking === true`. Esta alteração de assinatura é
  consumida também pela TASK-05.
- Main modules/files likely involved:
  - `src/features/rankings/components/GeneralRanking.tsx`
  - `src/features/rankings/components/PhaseRanking.tsx` (reuso/extração de
    sub-componentes se necessário)
  - `src/features/rankings/hooks/usePoolRankingByScope.ts` (novo `enabled` + key)
  - `src/features/rankings/components/__tests__/GeneralRanking.test.tsx`
  - hooks `usePoolRanking`, `usePoolRankingByScope`
- Dependencies: TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (componente; cobrir ramos ON/OFF via /test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: is_frontend → /ui-spec define abas vs. listas empilhadas. Garantir
  regressão zero no ramo OFF. UI decidido: ABAS (Grupos|Eliminatórias).

### TASK-05 – Split em Home (hero/percentil) + Perfil do participante
- Type: application
- Goal: Quando a flag ON, Home hero e Perfil exibem os DOIS rankings lado a lado
  (Grupos + Eliminatórias); OFF mantém o geral atual.
- Scope: `useHomeDashboard`/hero e `ParticipantProfile` passam a ler
  `splitPhaseRanking`; quando ON, derivar rank/percentil dos dois escopos
  (grupos + eliminatorias) e apresentar ambos. Reusar derivações existentes
  (`deriveHeroSummary`, `deriveRankingSummary`) por escopo. Ramo OFF intocado.
  is_frontend: true.
  **Gating (W2):** usar o `enabled` de `usePoolRankingByScope` (assinatura da
  TASK-04) para que a Home — tela de TODOS os usuários, já com 9 queries — NÃO
  dispare as 2 leituras extras quando a flag OFF (caso maioria). Sem regressão de
  performance/isLoading no ramo OFF.
  **Empty-state (W3):** quando o rank de `eliminatorias` ainda não existe (pool
  só na fase de grupos), a apresentação dupla degrada graciosamente (esconde/—
  o bloco de eliminatórias), sem quebrar hero/Perfil.
- Main modules/files likely involved:
  - `src/features/home/hooks/useHomeDashboard.ts`
  - `src/features/home/lib/homeDashboardHelpers.ts` (deriveHeroSummary etc.)
  - `src/features/home/components/HeroCard.tsx`
  - `src/features/rankings/components/ParticipantProfile.tsx`
  - testes correspondentes (`useHomeDashboard.test.ts`, `ParticipantProfile.test.tsx`)
- Dependencies: TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (derivações puras podem ter teste unitário no /test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: Home/Perfil hoje consomem só `usePoolRanking` (geral). Com ON precisam
  dos dois escopos — avaliar buscar via `usePoolRankingByScope` nessas telas.
  is_frontend → /ui-spec p/ apresentação dupla compacta no hero.
- Post-review (GSD adversarial): CR-01 corrigido — `isError` do `ParticipantProfile`
  agora inclui `gruposQuery`/`eliminatoriasQuery` (antes flag ON + scope falho mostrava
  "sem dados" sem retry). Testes: regressão CR-01 + isolamento WR-02 + gating OFF W2.

## 4. Dependency map
- TASK-01 → (sem deps)
- TASK-02 → depende de TASK-01
- TASK-03 → depende de TASK-01
- TASK-04 → depende de TASK-02
- TASK-05 → depende de TASK-02
- TASK-04 e TASK-05 são independentes entre si.

## 5. Recommended execution order
1. TASK-01 (fundação backend)
2. TASK-02 (expor flag no payload)
3. TASK-03 (toggle admin — destrava o teste manual end-to-end)
4. TASK-04 (split `/rankings`)
5. TASK-05 (split Home + Perfil)

## 6. Planning risks and blockers
- **Regressão ramo OFF** (TASK-04/05): 3 telas assumem `geral` hoje. Teste do
  ramo OFF obrigatório.
- **`rankingSchema` é `.strict()`** (TASK-02): embutir a flag exige schema de
  resposta dedicado, senão o parse do client rejeita. Risco se esquecido.
- **Apresentação dupla no hero** (TASK-05): espaço limitado; depende do /ui-spec.
- **Empty state** quando não há fase eliminatória ainda (TASK-04/05).
- Sem blocker externo — todas as decisões de produto resolvidas no PRD.
