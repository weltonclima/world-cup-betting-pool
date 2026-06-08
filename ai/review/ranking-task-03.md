# REVIEW — TASK-03 (Ranking PRD-05)

**Depth:** standard (security-aware) · **Files:** route.ts + route.test.ts · **Status:** issues_found (2 WARNING, 0 BLOCKER)

## Summary
Route Handler de recalc correto e bem testado (18 casos, valores reais capturados nos writes). Auth dupla sólida, agregação por escopo correta, exclusão de não-aprovados, reuso de `scorePrediction`/helpers/schemas, server-only, sem `any`, tsc 0. Revisão adversarial encontrou 2 WARNINGs (1 de segurança herdado, 1 de design de evolução) — nenhum bloqueia.

## Critical Issues
Nenhum. Sem bypass de auth (secret vazio→`cronSecret.length>0` falha→cai p/ sessão; headerSecret null nunca casa). Agregação não vaza pontos entre escopos (grupo só em `stage==="grupos" && groupId`; fases só em `RANKING_STAGE_SCOPES`; dezesseis-avos/terceiro só geral+`correctByStage`).

## Warnings

### WR-01 (segurança, baixo): comparação de secret não constant-time
**File:** `route.ts:84` — `headerSecret === cronSecret`.
**Issue:** `===` é suscetível a timing attack teórico. **Padrão pré-existente** (idêntico em `/api/predictions/score`). Risco real baixíssimo (cron interno, <100 users, secret de alta entropia).
**Fix (recomendado p/ TASK-14, aplicar nos DOIS endpoints):** `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` com guarda de tamanho. Não fazer só aqui p/ não divergir do score route.

### WR-02 (design/correção, médio): `positionHistory` cresce a cada execução, mesmo sem mudança
**File:** `route.ts:284-322`.
**Issue:** Cada chamada de recalc faz append com `round = prevMaxRound+1`, **mesmo quando nenhuma partida nova finalizou** (re-run do cron / re-disparo admin no mesmo dia). Isso (a) polui a Tela 04 (Evolução) com pontos duplicados de estado idêntico e (b) cresce sem limite. A idempotência dos rankings/pool é preservada, mas a do histórico não — tensão com a natureza "segura de re-rodar" do endpoint. Ratificado por decisão A4 ("cada execução = rodada"), mas frágil quando a cadência do cron (TASK-14) for definida.
**Fix (recomendado na TASK-14, junto com a definição de cadência):** anexar snapshot só quando o estado mudou — ex.: guardar `lastFinishedCount` e só fazer append se `finishedGeral` aumentou, OU dedupe por jornada/dia. Mantém Tela 04 limpa e histórico limitado.

## Info
- `Promise.all` de writes individuais (~rankings + N statistics + pool) — sem limite de batch do Firestore (sets independentes); OK p/ <100 users.
- `data()` do firebase-admin é `DocumentData` (typing da lib), não `any` nosso.
- `longestStreak` ordena por `kickoffAt` e zera no erro — correto.
- `computeAccuracy` trata denom 0; pool trata listas vazias.

## Verdict: approved with adjustments

WR-01 e WR-02 são recomendações para a **TASK-14** (onde auth/cron são finalizados) — local natural para hardening de secret e definição de cadência+guarda do positionHistory. Nenhum item bloqueia o avanço; correção de dados no escopo atual está sólida. Registrados para não se perderem.
