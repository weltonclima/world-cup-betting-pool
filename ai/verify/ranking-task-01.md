# VERIFICATION

## 1. Task: TASK-01 – Estender schemas de ranking e estatísticas

## 2. Must-have truths
- T-01: `rankingEntrySchema` aceita formato antigo `{uid,nickname,position,points}` — **VERIFIED**
- T-02: `rankingEntrySchema` aceita formato completo (`name`/`wrong`/`accuracy` opcionais) — **VERIFIED**
- T-03: `getGeneralRanking` + `useGeneralRanking` compilam sem mudança de runtime — **VERIFIED**
- T-04: `groupRankingSchema`, `poolStatsSchema`, `distributionBucketSchema` criados, `.strict`, exportados — **VERIFIED**
- T-05: `positionHistoryEntrySchema +round?` e `statisticsSchema +totalWrong?` opcionais — **VERIFIED**
- T-06: tipos `GroupRanking`/`PoolStats`/`DistributionBucket` exportados; tsc strict sem erros; sem `any` — **VERIFIED**
- T-07: suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/schemas/rankings.ts:16-26` — novos campos com `.optional()`; teste "aceita entrada no formato antigo" passa (rankings.test.ts).
- **T-02:** `rankings.ts:19,22,23` — `name: nonEmptyString.optional()`, `wrong: z.int().min(0).optional()`, `accuracy: percentageSchema.optional()`. Testes fullEntry + bounds (accuracy 101/-1, wrong -1/2.5, name "") passam.
- **T-03:** `src/services/rankings.ts` NÃO está no diff (inalterado); usa `rankingSchema` que permanece compatível (entries com campos opcionais). `tsc --noEmit` exit=0; suite 1673/1673.
- **T-04:** `groupRankingSchema` (`rankings.ts`), `poolStatsSchema`+`distributionBucketSchema` (`statistics.ts`). `statistics.ts` tem 4 `.strict()` (positionHistory, statistics, distributionBucket, poolStats). Reexportados: `schemas/index.ts` (`export * from "./rankings"|"./statistics"`), `types/index.ts` idem. Tipos em `types/rankings.ts` e `types/statistics.ts`.
- **T-05:** `statistics.ts:19` `round: z.int().min(1).optional()`; `statistics.ts:28` `totalWrong: z.int().min(0).optional()`. Testes round 5/0 + totalWrong 8/-1 + compat (sem round/sem totalWrong) passam.
- **T-06:** Tipos `GroupRanking` (types/rankings.ts), `PoolStats`/`DistributionBucket` (types/statistics.ts). `tsc --noEmit` exit=0. Scan `: any|as any|<any>` → nenhum.
- **T-07:** Vitest full run via JSON: `numTotalTests 1673 / pass 1673 / fail 0`, `suites 517/517`, exit=0. Verificado via `--outputFile` (não resumo rtk — memory rtk-vitest-false-green).

## 4. Test correlation
- T-01/T-02: `rankings.test.ts` — compat retroativa, fullEntry, accuracy/wrong/name bounds (assertam `success` do safeParse = comportamento real, não mock).
- T-04: `rankings.test.ts` (groupRanking válido/sem groupId/groupId vazio/strict) + `statistics.test.ts` (poolStats válido/distribution vazio/sem highestPointsName/averagePoints fracionário/totalParticipants negativo/strict; bucket válido/count negativo/strict).
- T-05: `statistics.test.ts` — round/totalWrong compat + bounds.
- T-06: `expectTypeOf` para `GroupRanking`, `PoolStats`, `DistributionBucket`.

## 5. Out-of-scope drift
none. Mudanças restritas a schemas/tipos/testes de ranking+statistics. `rankingScopeSchema` não alterado (por-grupo usa doc próprio, conforme decisão). Pontuação de predictions (binário) não tocada.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota informativa (não-bloqueante): docs `rankings` pré-existentes no formato antigo seguem válidos (campos opcionais); recalc da TASK-03 passará a gravar shape completo. OQ1 (path do pool stats) e OQ2 (groupId canônico) resolvidos na TASK-03 — schema é agnóstico ao path, não bloqueia.

## 7. Verdict: goal-achieved
