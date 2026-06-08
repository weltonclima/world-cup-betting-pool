# REVIEW — TASK-01 (Ranking PRD-05)

**Depth:** standard · **Files reviewed:** 6 · **Status:** issues_found (2 WARNING, 0 BLOCKER)

## Scope reviewed
`src/schemas/rankings.ts`, `src/schemas/statistics.ts`, `src/types/rankings.ts`, `src/types/statistics.ts`, `src/schemas/__tests__/rankings.test.ts`, `src/schemas/__tests__/statistics.test.ts`.

## Summary
Implementação fiel ao spec. Compat retroativa correta (campos novos `.optional()` → docs antigos e `getGeneralRanking` intactos). `.strict()` em todos os schemas novos. Binário respeitado: `points` é métrica única (sem `correct` redundante, sem `correctWinners`). Sem `any`; tsc strict exit=0; suite 1673/1673. Testes assertam comportamento (`safeParse.success`), cobrem bounds, `.strict` e compat — não testam mocks. Nenhum bug, falha de segurança ou quebra de contrato encontrada.

## Critical Issues
Nenhum.

## Warnings

### WR-01: `distributionBucketSchema` sem invariante `min ≤ max`
**File:** `src/schemas/statistics.ts:38-45`
**Issue:** `min`/`max` são `z.int().min(0)` independentes — um bucket invertido (`min:100, max:0`) passa na validação. Risco baixo (buckets gerados server-side com faixas fixas na TASK-03), mas o schema é o contrato e não trava o dado inválido.
**Fix (deferível p/ TASK-03, onde a geração de buckets nasce):**
```ts
export const distributionBucketSchema = z
  .object({ label: nonEmptyString, min: z.int().min(0), max: z.int().min(0), count: z.int().min(0) })
  .strict()
  .refine((b) => b.min <= b.max, { message: "min deve ser ≤ max", path: ["max"] });
```

### WR-02: `poolStatsSchema` sem invariante `lowestPoints ≤ highestPoints`
**File:** `src/schemas/statistics.ts:48-59`
**Issue:** `lowestPoints`/`highestPoints`/`averagePoints` independentes — permite `lowest > highest`. Risco baixo (gerado server-side), mas hardening barato.
**Fix (deferível p/ TASK-03):** `.refine((s) => s.lowestPoints <= s.highestPoints, ...)`.

## Info
- Consistência com primitivos do projeto (`nonEmptyString`, `percentageSchema`, `isoDateTime`, `z.int().min`) — OK.
- `averagePoints: z.number().min(0)` corretamente fracionário (média) vs demais inteiros — OK.

## Verdict: approved with adjustments

WARNINGs são hardening opcional sobre dados gerados pelo backend; **não bloqueiam** e são naturalmente endereçados na TASK-03 (geração de buckets/stats), onde os `.refine` ficam próximos da lógica que produz os valores. Nenhuma ação obrigatória na TASK-01.
