# REVIEW — TASK-04 (Ranking PRD-05)

**Depth:** standard · **Files:** rankings.ts, index.ts, rankings.test.ts · **Status:** clean (0 BLOCKER, 0 WARNING)

## Summary
Camada de serviço enxuta e consistente com o padrão `getGeneralRanking` original (erros crus, `.parse` por doc, sem tradução, sem React). Refactor `where`→`doc` correto: `getGeneralRanking` mantém assinatura/retorno e delega a `getRankingByScope("geral")`; suite full 1732/1732 (incl. Home) verde confirma não-regressão. Paths alinhados à TASK-03. `getUserRanking` correto. Sem `any`; tsc 0.

## Critical Issues
Nenhum.

## Warnings
Nenhum.

## Info
- `getGroupRanking("")` leria doc `grupo-` → `null` (inofensivo; groupId é controlado pela UI/hook). Sem ação.
- `getUserRanking` lê o ranking geral inteiro por chamada — correto e barato (<100 users, 1 doc). Sem N+1.
- Testes assertam path do `doc()` e objeto parseado (comportamento), mockam só `firebase/firestore`/`@/firebase` — não a função sob teste. Cobrem null/malformado/erro-cru/composição.

## Verdict: approved
