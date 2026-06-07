# REVIEW — TASK-01 (Jogos / PRD-03)

> Spec: `ai/spec/jogos-task-01.md` · Plan: `ai/plan/jogos.md` (TASK-01)
> Arquivos: `src/features/matches/lib/{matchesHelpers,matchLabels,index}.ts` + `__tests__/matchesHelpers.test.ts`
> Data: 2026-06-07

## Verdict: **approved with adjustments**

Regra: nenhum BLOCKER → não rejeitado. 2 WARNINGs registrados (não bloqueiam avanço).

## Diagnostics (mcp__ide__getDiagnostics)
0 erros nos 3 arquivos. `tsc --noEmit` limpo. 48/48 testes novos, suíte 775 verde (JSON-confirmado).

## Acceptance criteria (spec §10)
Todos os 11 satisfeitos. Verificações-chave:
- AC7/AC8 — bloqueio: `now >= kickoffAt` e `globalLock === true` → "bloqueado" (boundary `>=` testado exatamente no kickoff). ✓
- AC6 — zero import de React/Firebase/hooks/services (só `date-fns` + `@/types`). ✓
- AC5 — TS strict, sem `any`. ✓
- AC9/AC10 — array vazio e id ausente sem lançar. ✓
- AC11 — rótulos pt-BR conferem com a tabela. ✓

## Findings

### WARNING-1 — Fonte dupla de verdade para rótulo de status do jogo
`deriveGameStatusLabel()` (função em `matchesHelpers.ts`) e `GAME_STATUS_LABEL` (const em `matchLabels.ts`) mapeiam `MatchStatus → rótulo pt-BR` de forma independente e duplicada. Mudança em um sem o outro causa divergência silenciosa.
- **Classificação:** WARNING (maintainability).
- **Ação:** na TASK-03 (consumidora dos labels p/ badges), consolidar — um deriva do outro. `matchesHelpers` não importa `matchLabels` hoje, então `matchLabels` pode importar `deriveGameStatusLabel` (value) e `matchesHelpers` manter só `import type` (type-only, sem ciclo runtime).

### WARNING-2 — Agrupamento por dia em UTC vs fuso do usuário
`groupMatchesByDay` e os rótulos "Hoje"/"Amanhã" comparam dia em UTC (decisão travada no spec §6.2). Para jogos sediados nas Américas (kickoff em UTC) perto da meia-noite, um usuário em BRT (UTC-3) pode ver o jogo numa seção de dia diferente do percebido localmente.
- **Classificação:** WARNING (UX, conforme spec — não é desvio).
- **Ação:** avaliar na TASK-04 `/screen` exibir data/hora no fuso do torneio ou do usuário. Não bloqueia TASK-01.

## Desvios do implementador (aceitos)
1. `filterMatches` cobre só `stage`+`teamId`; `predictionStatus` delegado ao compositor (TASK-02) — previsto no spec §6.3/§13. OK.
2. Construção de data local-midnight antes do `format()` p/ evitar day-shift de fuso — correto e consistente com o dateKey UTC. OK.
3. `!` non-null assertions nos testes após assert de length — seguro, evita `any`. OK.

## Test quality
Cobertura abrangente das arestas do spec §9 (boundary do bloqueio, cada status, globalLock, grouping today/tomorrow/other/empty/ordering, filtros isolados+combinados, busca home/away/none/case-insensitive, resolveTeam found/missing). Mocks inline (padrão do molde). Meaningful.

## Próximo passo
Avançar para Wave 2: TASK-02 (hooks compositor) + TASK-03 (componentes UI). W1 endereçado dentro da TASK-03; W2 dentro da TASK-04.
