# PLAN — Otimização de custo de writes/reads no cron de pontuação

## 1. Planning summary

A PRD `scoring-write-cost.md` trava a decisão **A+B combinadas**: cortar **writes** (não regravar palpite com `{status, points}` inalterado) e **reads** (pular a query de palpites de partidas `finished` já pontuadas, via fingerprint do resultado num doc de controle `score_state/cron`).

Decomposição em **3 tasks** de fronteira limpa:
- **TASK-01** — núcleo puro: helpers de fingerprint do resultado e de igualdade `{status, points}`. Sem I/O, 100% testável.
- **TASK-02** — persistência do doc de controle `score_state/cron`: schema + repositório Admin SDK (ler/gravar o mapa) + `firestore.rules` (`if false`).
- **TASK-03** — integração no `route.ts`: aplica filtro grosso (B) + filtro fino (A) + ajusta a resposta (`updatedPredictions` = alterados, `skippedMatches`).

Fundação pura primeiro (01), persistência depois (02), integração no hot path por último (03). Plano pequeno e de baixo/médio risco → **gsd-plan-checker pulado** (≤3 tasks, sem task critical/high risk; raciocínio goal-backward das seções 4–6 cobre).

## 2. Recommended execution phases

- **Phase 1 – fundação (pura):** TASK-01.
- **Phase 2 – persistência/controle:** TASK-02.
- **Phase 3 – integração no endpoint:** TASK-03.
- **Phase 4 – validação:** coberta pelos testes por-task + `/local-env` no fim do flow.

## 3. Tasks

### TASK-01 – Helpers puros: fingerprint do resultado + igualdade de score
- Type: domain
- Goal: isolar, em funções puras e testáveis, (a) o cálculo do fingerprint do resultado de uma partida e (b) a comparação se o `{status, points}` recalculado difere do persistido.
- Scope:
  - `matchResultFingerprint(match)` → string estável derivada de `{ status, homeScore, awayScore }` (base do filtro grosso/B).
  - `predictionScoreChanged(persisted, computed)` → `boolean`: `true` se `status` OU `points` diferem (tratando `status` ausente/`undefined` e `points` numérico estrito) — base do filtro fino/A.
  - Sem leitura de Firestore, sem dependência de rede.
- Main modules/files likely involved:
  - Create: `src/features/predictions/lib/scoreOptimization.ts`
  - Export via `src/features/predictions/lib/index.ts`
  - Test: `src/features/predictions/lib/__tests__/scoreOptimization.test.ts`
- Dependencies: nenhuma.
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (lógica de comparação/igualdade — regressão-sensível; casos de borda em `status`/`points`)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: fingerprint deve ser determinístico e independente de ordem de chaves. Considerar `null` em placares de partida não-finished (mas o uso é só sobre `finished`). Não usar `Date.now()`/random.

### TASK-02 – Coleção de controle `score_state`: schema + repositório Admin + rules
- Type: persistence
- Goal: persistir o estado "o que já foi pontuado" num doc único `score_state/cron` (mapa `{ matchId: resultHash }`), com leitura/escrita via Admin SDK e proteção nas rules.
- Scope:
  - Schema Zod do doc de controle (`{ matches: Record<string,string>, updatedAt }` ou equivalente), defensivo na leitura (doc ausente → mapa vazio).
  - Repositório server-only: `readScoreState(db)` → `Map<string,string>` (1 read; ausente → vazio) e `writeScoreState(db, map, now)` (1 write; só chamado quando houve mudança).
  - `firestore.rules`: `score_state/{id}` read/write **`if false`** (Admin SDK only) — alinhado ao padrão de `statistics`/`sync_logs`.
- Main modules/files likely involved:
  - Create: `src/schemas/scoreState.ts` (+ export em `src/schemas/index.ts`)
  - Create: `src/server/scoring/scoreState.ts` (repositório Admin)
  - Modify: `firestore.rules` (bloco novo `match /score_state/{id}`)
  - Test: `src/server/scoring/__tests__/scoreState.test.ts`
- Dependencies: nenhuma (independente de TASK-01).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (majoritariamente schema + wiring fino de repositório; testar via test phase normal — leitura de doc ausente, round-trip do mapa)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: doc nasce vazio (sem migração). Cuidar do limite de 1MB do doc (mapa de ~104 partidas × hash curto é trivial). Nunca logar conteúdo sensível (não há, mas manter padrão).

### TASK-03 – Integração no endpoint `/score`: filtro grosso (B) + fino (A) + resposta
- Type: integration
- Goal: ligar os helpers (01) e o controle (02) no `POST /api/predictions/score`, cortando reads (pula partida com hash inalterado) e writes (grava só palpite alterado), preservando idempotência, efeitos best-effort e shape de resposta.
- Scope:
  - No início do POST (após auth, antes do loop): `readScoreState` (1 read).
  - Em `processMatch`: se `matchResultFingerprint(match) === estado[match.id]` → **pula** (sem query de palpites, sem write; contabiliza em `skippedMatches`).
  - Caso contrário: query palpites → `scorePrediction` → gravar via `set merge` **apenas** quando `predictionScoreChanged` for `true`; atualizar `estado[match.id] = hash`.
  - Coleta de `hits` de notificação só nas partidas efetivamente processadas (partida pulada não re-notifica — Q2).
  - Ao final: `writeScoreState` (1 write) só se o mapa mudou; `chainRecalc` mantido.
  - Resposta: `updatedPredictions` passa a contar **alterados** (Q1); adicionar `skippedMatches` (e opcional `scoredMatches` permanece = finished avaliadas). Confirmar compat com asserts dos testes existentes.
- Main modules/files likely involved:
  - Modify: `src/app/api/predictions/score/route.ts` (`POST`, `processMatch`, resposta)
  - Test: `src/app/api/predictions/score/__tests__/route.test.ts`, `route.notifications.test.ts`
- Dependencies: **TASK-01** (helpers) e **TASK-02** (repositório/schema/rules).
- Story points: 3
- Criticality: medium
- Technical risk: medium (toca o hot path de pontuação; mudança de semântica de contagem; precisa não quebrar notificações nem idempotência)
- Recommended TDD later: yes (comportamento condicional de skip + regressão de pontuação/notificações)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: atualizar testes que afirmam `updatedPredictions === 352`. Review (opus/high) + GSD: achado C1 (crítico) corrigido — doc malformado não avança o hash da partida (`complete` flag), senão congelaria a partida e o palpite sumiria do ranking. Follow-ups baixos não-bloqueantes: M1 dedup de match.id upstream; L1 `now` no fim do scoring. (passa a contar alterados). Garantir CA3 (placar corrigido → hash muda → re-pontua). Garantir CA1 (run sem mudança → 0 writes em `predictions`; só possível 1 write se o doc de controle precisar nascer/mudar). Manter `force-dynamic`/`runtime nodejs`.

## 4. Dependency map

```
TASK-01 (helpers puros)  ─┐
                          ├──→ TASK-03 (integração no route)
TASK-02 (score_state)    ─┘
```
- TASK-01 e TASK-02 são independentes entre si (podem ir em paralelo).
- TASK-03 depende de ambas.

## 5. Recommended execution order

1. **TASK-01** — fundação pura (helpers), destrava testes do filtro fino/grosso.
2. **TASK-02** — controle de estado + rules.
3. **TASK-03** — integração no endpoint (consome 01 e 02).

## 6. Planning risks and blockers

- **TASK-03 (médio risco):** único ponto que toca o endpoint de produção em hot path. Mitigar com TDD e review opus/high; idempotência é invariante a preservar.
- **Mudança de semântica de `updatedPredictions`:** quebra asserts de testes existentes (`route.test.ts`) que esperam o total processado. Esperado e intencional — atualizar nos testes da TASK-03.
- **Invalidação por correção de placar:** depende de o fingerprint capturar `{status, homeScore, awayScore}`. Se a fonte de partidas mudar o shape, o hash deve acompanhar (coberto em TASK-01).
- **Sem blockers externos** — nenhuma dependência de lib nova, sem migração de dados, sem decisão pendente (Q1/Q2/Q3 resolvidas na PRD).
