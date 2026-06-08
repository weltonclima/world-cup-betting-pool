# VERIFICATION

## 1. Task: TASK-03 – Route Handler `/api/rankings/recalc`

## 2. Must-have truths
- T-01: Auth dupla (401/403/200) — **VERIFIED**
- T-02: Exclui blocked/pending — **VERIFIED**
- T-03: Pontuação binária via `scorePrediction` em geral+fase+grupo — **VERIFIED**
- T-04: Grava geral+5 fases+grupo; dezesseis-avos/terceiro só geral+correctByStage — **VERIFIED**
- T-05: `accuracy` denom=finalizadas elegíveis — **VERIFIED**
- T-06: `statistics/{uid}` completo; positionHistory append + round incrementa — **VERIFIED**
- T-07: `pool_stats/current` agregados + distribution — **VERIFIED**
- T-08: Idempotência de rankings — **VERIFIED**
- T-09: Ignora doc malformado e prossegue — **VERIFIED**
- T-10: server-only, runtime nodejs, sem Cloud Functions, sem any, tsc strict — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `route.ts:78-110` — secret `RANKINGS_SECRET` OU `verifySessionCookie`→`users/{uid}.role==="admin"`; 401 sem cookie/inválido, 403 não-admin. Testes: 401 sem credencial, 401 cookie inválido, 403 role user, 200 secret, 200 admin, "não chama cookies() com secret".
- **T-02:** `route.ts:131-145` query `users.where("status","==","approved")`; só aprovados entram em `approved[]` → rankings/pool. Teste "blocked/pending ausentes" (uids não contêm u3/u4).
- **T-03:** `route.ts:168-205` `scorePrediction(pred,match)` → `pointsGeral += points`, `wrongGeral += status==="wrong"`, acumuladores `byStageScope`/`byGroup`. Testes: u1 points 2, u2 wrong 1.
- **T-04:** `route.ts:218-280` grava `rankings/geral` + loop `RANKING_STAGE_SCOPES` (5) + loop `finishedByGroup`. `RANKING_STAGE_SCOPES` exclui dezesseis-avos/terceiro; `correctByStage` (route.ts:191) usa `match.stage` (6 fases). Testes: grupos/oitavas defined, dezesseis-avos undefined, oitavas só pontos de oitavas, grupo-A groupId="A".
- **T-05:** `route.ts:226,250,267` `computeAccuracy(points, finishedGeral|finishedByStage|finishedByGroup)`. Teste: u1 100, u2 0 (denom geral=2).
- **T-06:** `route.ts:284-322` lê doc atual, `prevMaxRound`, append `{at,scope:"geral",position,round:prevMaxRound+1}`; grava `merge:true`. Testes: stats/u1 totalCorrect 2, correctByStage {grupos:1,oitavas:1}, round 1; com histórico existente → length 2, round 2.
- **T-07:** `route.ts:325-345` highest/lowest/average/totalCorrect + `buildDistribution`. Teste: totalParticipants 2, highest 2, lowest 0, distribution array.
- **T-08:** rankings derivados de funções puras + `set` determinístico. Teste idempotência: entries de rankings/geral idênticos entre 2 execuções.
- **T-09:** `route.ts:150-160` safeParse de prediction → warn + continue. Teste: prediction malformada ignorada, 200, ranking gravado.
- **T-10:** `import "server-only"`, `runtime="nodejs"`, `dynamic="force-dynamic"`. Sem Cloud Functions (Route Handler). Grep `any` → nenhum. tsc exit=0.

## 4. Test correlation
18 testes em `__tests__/route.test.ts` assertam valores reais (entries/positions/points/accuracy/writes capturados), não chamadas. `scorePrediction` usa implementação real (binário) via mock que delega; pontuação verificada por output. Mock captura `set` por path (`rankings/geral`, `rankings/grupo-A`, `statistics/u1`, `pool_stats/current`).

## 5. Out-of-scope drift
none. Apenas `src/app/api/rankings/recalc/*`. Nova coleção `pool_stats` (prevista no spec OQ1). Rules/chaining ficam p/ TASK-14 (correto).

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota: rankings de fases sem partida finalizada (quartas/semifinal/final no início) são gravados com todos em points 0 — intencional (telas mostram "-"/0). Denominador 0 → accuracy 0 (computeAccuracy trata). Sem impacto.
  - Nota: admin com `status:"approved"` participaria do ranking (regra PRD: aprovados participam) — comportamento correto; testes isolam auth do admin via doc separado.

## 7. Verdict: goal-achieved
