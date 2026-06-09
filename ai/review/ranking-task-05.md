# REVIEW — TASK-05 (Ranking PRD-05)

**Depth:** standard · **Files:** 6 hooks + 2 barrels · **Status:** clean (0 BLOCKER, 0 WARNING)

## Summary
Hooks finos e corretos, consistentes com `useGeneralRanking`. Cache herda do QueryClient global (sem override — A3). `enabled` guards corretos; `useMyRanking` deriva uid de `useAuth`. Query-keys `user` (UserRankingResult) e `profile` (Statistics) **separadas** — colisão de cache eliminada (bug pego no implement). Reexport de `useGeneralRanking` reusa a key da Home (sem duplicar dado). `"use client"` em todos. Sem `any`; tsc 0; suite 1732/1732.

## Critical Issues
Nenhum.

## Warnings
Nenhum.

## Info
- Keys placeholder (`"__none__"`/`"__anon__"`) só existem sob `enabled:false` → nenhum fetch disparado e nenhuma entrada de cache criada até haver valor real. Inofensivo.
- `queryFn` usa `groupId!`/`uid!` — seguro pois `enabled` bloqueia execução sem valor (contrato do TanStack Query).
- Toda consulta via `useQuery` (CLAUDE.md) — nenhum `fetch`/`useEffect` manual.
- Sem testes unitários dedicados (wiring; decisão do spec) — cobertura virá via componentes (TASK-08..13). Adequado: testes superficiais de "useQuery chamado" seriam ruído.

## Verdict: approved
