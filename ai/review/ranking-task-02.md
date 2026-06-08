# REVIEW — TASK-02 (Ranking PRD-05)

**Depth:** standard · **Files reviewed:** 5 src + 4 testes · **Status:** issues_found (1 WARNING — corrigido nesta passagem)

## Scope reviewed
`src/features/rankings/lib/{rankingSort,accuracy,evolution,distribution,index}.ts` + `__tests__/*`.

## Summary
Helpers puros, bem fatiados, sem I/O, sem `any`, tsc strict, suite verde. Lógica de desempate, aproveitamento, evolução e distribuição corretas e cobertas por testes que assertam valores de retorno (não mocks). Revisão adversarial encontrou **1 defeito de correção** em `compareRanking` (comparação de data), corrigido com teste de regressão.

## Critical Issues
Nenhum.

## Warnings

### WR-01: `compareRanking` comparava `firstPredictionAt` lexicograficamente (CORRIGIDO)
**File:** `src/features/rankings/lib/rankingSort.ts:48` (antes do fix)
**Issue:** `return fa < fb ? -1 : 1` comparava strings ISO diretamente. `isoDateTime` aceita offsets (`{offset:true}`), então `"2026-06-01T10:00:00Z"` e `"2026-06-01T07:00:00-03:00"` representam o **mesmo instante** mas têm ordem lexicográfica diferente — desempate por "data do 1º palpite" ficaria incorreto entre participantes empatados em points/accuracy/wrong. Impacto: baixo (só afeta ordem de empate), mas é correção.
**Fix aplicado:** compara por instante via `Date.parse` (`ta - tb`); mesmo instante cai para desempate por `uid`; fallback defensivo para string só se `Date.parse` falhar (datas já validadas upstream). +2 testes de regressão (offset equivalente, ordenação por instante). 31/31 verde.

## Info
- `rankParticipants` usa `[...list]` + `.map` com spread → não muta entrada (confirmado por teste de snapshot). OK.
- `buildDistribution` faixas contíguas sem gaps, `min≤max` garantido (ranges fixos), topo aberto via `maxPoints`. OK.
- `computeAccuracy` trata denom 0 e clampa. OK.

## Verdict: approved

WR-01 era o único achado e foi corrigido nesta passagem com teste de regressão (commitado junto à TASK-02). Sem itens pendentes.
