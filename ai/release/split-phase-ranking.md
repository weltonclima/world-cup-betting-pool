# RELEASE PLAN — Divisão de ranking por fase (grupos × eliminatória)

> Feature slug: `split-phase-ranking`. PRD: `ai/prd/split-phase-ranking.md` ·
> PLAN: `ai/plan/split-phase-ranking.md`. Todas as 5 tasks `done`.

## 1. Release summary
Feature de **exibição** controlada por flag por pool (`splitPhaseRanking`,
**default OFF**). Quando ON, as telas de ranking (`/rankings`, Home hero, Perfil)
mostram dois rankings lado a lado — Grupos e Eliminatórias — em vez do geral
cumulativo. O dado de escopo já existe (recalc grava `pool-{id}-grupos` e
`pool-{id}-eliminatorias`). Não há cálculo novo.

Entregue:
- TASK-01 — campo aditivo `splitPhaseRanking?: boolean` em `poolSchema` +
  persistência via `/api/group/settings` (espelha `predictionsLocked`).
- TASK-02 — flag embutida no payload de `GET /api/rankings/pool`
  (`poolRankingResponseSchema` dedicado; `rankingSchema` é `.strict()`).
- TASK-03 — toggle UI no `GroupSettingsForm` (group_admin).
- TASK-04 — split em `/rankings` (abas Grupos|Eliminatórias), gated por `enabled`.
- TASK-05 — split em Home hero + Perfil, gated por `enabled` (W2).

Sistema afetado: schemas de pool/ranking, route `group/settings`, route
`rankings/pool`, hooks `usePoolRankingByScope`, telas de ranking. Multi-tenant
intacto — `groupId` vem da sessão.

## 2. Deployment prerequisites
- Build verde: `next build` (não rodado nesta sessão — **rodar antes do deploy**).
- Typecheck OK ✅ · suite completa exit 0 ✅ (validado em Stage 4).
- Sem novas env vars. Sem novas dependências. Sem mudança de infra.
- Firebase Security Rules: leitura de `pools/{id}` já permitida; escrita de
  settings segue server-only (Admin SDK). Nada a alterar.

## 3. Data and migration considerations
- **Sem migração.** Campo `splitPhaseRanking` é optional aditivo. Docs `pools`
  antigos sem o campo seguem parseando (ausência = OFF na leitura).
- **Sem backfill.** Default OFF aplicado na leitura, não no schema — nenhum doc
  precisa ser tocado.
- **Compatibilidade:** ramo OFF idêntico ao comportamento atual (retrocompat
  garantida por teste). `.strict()` em `poolSchema` aceita o campo pois declarado.
- **Ordering:** nenhuma. Backend (TASK-01/02) já em produção é pré-requisito das
  telas, mas tudo vai no mesmo deploy.

## 4. Rollout strategy
**Direct release + feature-flag rollout (opt-in por pool).**
- Deploy único via Firebase App Hosting (Cloud Run). Sem flag global.
- Risco de exposição = zero no deploy: todos os pools nascem OFF. Comportamento
  visível só muda quando um group_admin liga o toggle manualmente.
- Rollout efetivo é **self-service e gradual** por natureza — cada admin decide.
- Sugerido: ligar em 1 pool piloto (o próprio grupo de teste) primeiro, validar
  abas + Home + Perfil com dados reais das duas fases, depois comunicar aos demais.

## 5. Monitoring and validation
Pós-deploy, com flag ON num pool piloto:
- `/rankings` → abas Grupos|Eliminatórias renderizam; ramo OFF inalterado em
  pools sem flag.
- Home hero + Perfil → apresentação dupla; empty-state gracioso quando a fase
  eliminatória ainda não tem dados (pool só em grupos).
- Network: confirmar que pools OFF **não** disparam as 2 leituras de escopo
  (gating W2). Pools ON disparam.
- Erro de scope query (flag ON) → tela mostra erro+retry, não "sem dados"
  (CR-01 corrigido pós-review).
- Sem regressão de performance/isLoading na Home (tela de todos os usuários).

## 6. Risks
- **Técnico (baixo):** regressão no ramo OFF das 3 telas. Mitigado por testes de
  ramo OFF + typecheck + suite verde.
- **Técnico (baixo):** parse strict do client se a flag não fosse anexada via
  schema dedicado — já resolvido (`poolRankingResponseSchema`).
- **Operacional (baixo):** admin liga a flag antes da fase eliminatória ter
  dados → empty-state cobre (degrada gracioso).
- **Performance (baixo):** 2 queries extras por tela quando ON — gated, só paga
  quem opta. Home OFF não paga.
- **Blind spot:** sem telemetria dedicada da flag; validação é manual no piloto.

## 7. Rollback considerations
- **Rollback de comportamento sem deploy:** desligar o toggle no pool reverte a
  exibição imediatamente (volta ao geral). Não precisa redeploy.
- **Rollback de código:** revert do deploy no App Hosting. Como o campo é
  aditivo e default OFF, reverter o código não deixa dado órfão nem quebra parse
  — docs com `splitPhaseRanking` gravado são simplesmente ignorados pelo código
  antigo.
- Sem migração = sem rollback de dados.

## 8. Release checklist
- [ ] `next build` verde localmente.
- [ ] `git status` limpo / branch de feature pronta p/ PR.
- [ ] PR revisado e aprovado (review GSD: CR-01 corrigido + testado).
- [ ] Deploy via Firebase App Hosting (push → build Cloud Run).
- [ ] Smoke pós-deploy: `/rankings`, Home, Perfil com flag OFF (default) sem
      regressão.
- [ ] Ligar toggle no pool piloto via `/group/settings`.
- [ ] Validar abas + Home dupla + Perfil duplo + empty-state com dados reais.
- [ ] Confirmar gating: pool OFF não dispara leituras de escopo (Network tab).
- [ ] Comunicar feature aos demais group_admins.
