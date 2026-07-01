# PLAN — Auto-refresh ao retornar à página

## 1. Planning summary

Feature pequena, baixo risco, puramente client-side. Duas mudanças ortogonais:
- **TASK-01** — refetch no foco de janela (troca de aba), global no QueryClient.
- **TASK-02** — refetch no mount dos hooks de ranking + matches (navegação de volta).

Nenhum impacto server-side, schema, ou deploy. TDD não se aplica (config change, não regra de negócio). Ordem: TASK-01 primeiro (mudança global de base), TASK-02 depois (overrides por hook).

## 2. Recommended execution phases

- **Phase 1 – foundation**: TASK-01 (config global do QueryClient).
- **Phase 2 – exposure**: TASK-02 (overrides por hook).

## 3. Tasks

### TASK-01 – refetchOnWindowFocus "always" no QueryClient global
- Type: infra
- Goal: garantir que trocar de aba/janela e voltar ao app dispara refetch de todas as queries, ignorando staleTime.
- Scope: adicionar `refetchOnWindowFocus: "always"` em `defaultOptions.queries` do `makeQueryClient`; atualizar teste de opções.
- Main modules/files likely involved:
  - `src/providers/QueryProvider.tsx`
  - `src/providers/__tests__/QueryProvider.test.tsx`
- Dependencies: nenhuma
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: mudança de maior alcance (todas as queries). Validar que testes que mockam QueryClient não quebram. Não mexer no staleTime.

### TASK-02 – refetchOnMount "always" nos hooks de ranking e matches
- Type: application
- Goal: garantir que navegar de volta às telas de ranking e jogos busca dados frescos no mount, ignorando staleTime.
- Scope: adicionar `refetchOnMount: "always"` nas chamadas `useQuery` de: `useRanking`, `usePoolRanking`, `usePoolRankingByScope`, `useMatches`, `useNextMatch`.
- Main modules/files likely involved:
  - `src/features/rankings/hooks/useRanking.ts`
  - `src/features/rankings/hooks/usePoolRanking.ts`
  - `src/features/rankings/hooks/usePoolRankingByScope.ts`
  - `src/features/matches/hooks/useMatches.ts`
  - `src/features/home/hooks/useNextMatch.ts`
- Dependencies: TASK-01 (base config; ortogonal mas ordenada por coerência)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: override por hook (menor privilégio), não global. Ajustar/estender testes existentes dos hooks se verificarem opções de query. `useRecentResults` NÃO entra (já 5min). Bracket NÃO entra (refetchInterval próprio).

## 4. Dependency map

```
TASK-01 (foundation) → TASK-02 (exposure)
```

TASK-02 depende de TASK-01 apenas por coerência de sequência; tecnicamente são ortogonais e poderiam ser aplicadas em qualquer ordem.

## 5. Recommended execution order

1. TASK-01
2. TASK-02

## 6. Planning risks and blockers

- Nenhum blocker externo. Sem clarificação pendente.
- Risco único: teste de `QueryProvider` que verifica `defaultOptions` precisa ser atualizado junto com TASK-01 (mesma task).
- Sem rollout precaution — mudança client-side, revertível por deploy.

---

plan-checker skipped (small low-risk plan — 2 straightforward tasks, sem criticidade/risco alto).
