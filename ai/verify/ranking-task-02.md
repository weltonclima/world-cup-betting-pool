# VERIFICATION

## 1. Task: TASK-02 – Helpers puros de ranking

## 2. Must-have truths
- T-01: Cadeia de desempate `points DESC→accuracy DESC→wrong ASC→firstPredictionAt ASC(ausente último)→uid ASC`, ordem total, sem mutar, position 1-indexed — **VERIFIED**
- T-02: `computeAccuracy` 12/48=25, arredonda, denom 0→0, clamp 0–100 — **VERIFIED**
- T-03: `evolutionIndicator` up/down/same + delta≥0 + sem-previous=same — **VERIFIED**
- T-04: `buildDistribution` 5 faixas fixas, fronteiras inclusivas, cobre >100 via maxPoints, valida contra `distributionBucketSchema` — **VERIFIED**
- T-05: Funções puras sem I/O (sem Firestore/React/Next) — **VERIFIED**
- T-06: Sem `any`, tsc strict, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `rankingSort.ts:34-58` `compareRanking` — `b.points-a.points`, `b.accuracy-a.accuracy`, `a.wrong-b.wrong`, bloco firstPredictionAt com ausente→retorna +1/-1 (último), `a.uid.localeCompare(b.uid)`. `rankParticipants:62-69` usa `[...list]` (cópia) + `.map((p,i)=>({...p, position:i+1}))`. Ordem total: só retorna 0 se uid igual.
- **T-02:** `accuracy.ts:8-12` — `if (finishedEligible<=0) return 0; Math.round(points/denom*100)` com `Math.max(0,Math.min(100,...))`.
- **T-03:** `evolution.ts:14-30` — previous null/undefined→same/0; `current<previous`→up delta `previous-current`; `current>previous`→down delta `current-previous`; igual→same/0. Deltas por subtração na direção correta ⇒ ≥0.
- **T-04:** `distribution.ts:14-33` — `top=Math.max(100, maxPoints??100)`, label `"90-100 pts"`/`"90+ pts"`, 5 ranges com `min≤max`, count por `filter(p>=min && p<=max)`. Teste valida cada bucket via `distributionBucketSchema.safeParse`.
- **T-05:** Grep em `src/features/rankings/lib` (excl. __tests__) por `@/firebase|firebase/|react|next/|@tanstack` → **No matches**. Imports apenas `type DistributionBucket from "@/types"`.
- **T-06:** `tsc --noEmit` exit=0. Vitest full via JSON: 1702/1702 (525 suites). Sem `: any|as any|<any>` (scan).

## 4. Test correlation
- T-01: `rankingSort.test.ts` — points DESC, accuracy/wrong/firstPredictionAt/uid tie-breaks, ausente-último, não-mutação (compara JSON snapshot), position [1,2], vazio→[], compareRanking 0-só-com-uid-igual. Assertam ordem de saída (`.map(uid)`), não mocks.
- T-02: `accuracy.test.ts` — 12/48=25, 1/3→33, 2/3→67, denom 0→0, 10/10→100, 11/10→100 (clamp).
- T-03: `evolution.test.ts` — 10→4 up6, 4→7 down3, 5→5 same, undefined/null→same, delta≥0.
- T-04: `distribution.test.ts` — 5 faixas, contagem, fronteiras 39/40/59/60/79/80/89/90, vazio→counts 0, 104 c/ maxPoints→"90+ pts", soma counts, validação schema.

## 5. Out-of-scope drift
none. Apenas `src/features/rankings/lib/*` + testes. Sem leitura/gravação Firestore, sem UI. Tipos reusados de TASK-01.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota: contrato `RankableParticipant` (com `firstPredictionAt`) é de domínio, não persistido — alinhado ao spec; o mapeamento para `RankingEntry` ocorre na TASK-03.

## 7. Verdict: goal-achieved
