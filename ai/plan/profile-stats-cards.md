# PLAN — Troca dos cards de estatísticas no perfil do ranking

## 1. Planning summary

Mudança puramente de apresentação em um único componente (`ProfileStatsGrid` dentro de `ParticipantProfile.tsx`). Dados já disponíveis no componente pai (`predictionsQuery.items`). Sem backend, schema ou migração. Uma única task cobre derivação + render + atualização de testes — escopo pequeno, indivisível de forma útil.

plan-checker pulado (plano pequeno, baixo risco — 1 task).

## 2. Recommended execution phases

- **Phase 1 – apresentação + testes** (única fase)

## 3. Tasks

### TASK-01 – Trocar cards Erros/Aproveitamento por Vitórias/Empates
- Type: application
- Goal: substituir os cards **Erros** e **Aproveitamento** de `ProfileStatsGrid` por **Vitórias** (palpites homeScore ≠ awayScore) e **Empates** (palpites homeScore === awayScore), mantendo **Acertos**.
- Scope:
  - derivar `wins`/`draws` de `items` (`ProfilePredictionItem[]`) no `ParticipantProfile`, memoizado
  - passar `wins`/`draws` como props para `ProfileStatsGrid`
  - reconstruir o `metrics` array do `ProfileStatsGrid` (3 cards: Acertos, Vitórias, Empates)
  - atualizar testes em `ParticipantProfile.test.tsx` (rótulos + cenários de contagem)
- Main modules/files likely involved:
  - `src/features/rankings/components/ParticipantProfile.tsx`
  - `src/features/rankings/components/__tests__/ParticipantProfile.test.tsx`
- Dependencies: nenhuma
- Story points: 2
- Criticality: low
- Technical risk: low
- Recommended TDD later: no (mudança de apresentação; testes atualizados na fase test cobrem a regressão)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review
- Notes: front-end (is_frontend: true). Card "Acertos" permanece `entry.points` (sem mudança semântica). Contagem inclui todos os palpites (tendência, não resultado). Fallback `0` quando sem palpites.

## 4. Dependency map

TASK-01 — sem dependências.

## 5. Recommended execution order

1. TASK-01

## 6. Planning risks and blockers

- Teste existente `"grade de métricas NÃO tem Pontos duplicado (3 células: Acertos/Erros/Aproveitamento)"` vai falhar até ser atualizado — esperado, parte do escopo da TASK-01.
- Nenhum blocker externo.
