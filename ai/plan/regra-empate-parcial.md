# PLAN — Regra de Empate Parcial na Pontuação

## 1. Planning summary

Feature pequena e cirúrgica: 1 mudança de regra de negócio em `scorePrediction` + propagação de 1 novo valor de display status (`"acertou_empate"`). Dividida em 2 tasks:

- **TASK-01** — núcleo: regra de pontuação + novo display status, deixando typecheck verde (Records exaustivos atualizados). Regra de negócio regression-sensitive → TDD.
- **TASK-02** — UI aditiva: chip de filtro "Empates" na lista de palpites (opcional/UX, não bloqueia compilação).

A separação é honesta: TASK-01 entrega a regra completa e o build verde; TASK-02 é puro acréscimo de superfície de UX. Nenhuma migração de dados — recalc pós-deploy recomputa via `scorePrediction`.

plan-checker skipped (small low-risk plan — 2 tasks, risco técnico baixo, sem ambiguidade aberta após checkpoint do PRD).

## 2. Recommended execution phases

- **Phase 1 — business rule + display contract:** TASK-01
- **Phase 2 — UX exposure:** TASK-02

## 3. Tasks

### TASK-01 – Regra de empate parcial + novo display status `acertou_empate`
- Type: domain
- Goal: pontuar `partial (5)` quando o usuário apostou empate e o jogo terminou empatado com placar diferente; introduzir o display status `"acertou_empate"` para esse caso e propagá-lo a todos os consumidores de tipo exaustivo (mantendo `tsc` verde).
- Scope:
  - `scorePrediction`: remover a guarda `matchSign !== 0 &&` para que empate previsto + empate real (não exato) retorne `partial (5)`. Demais ramos inalterados.
  - `PredictionDisplayStatus`: adicionar `"acertou_empate"`.
  - `derivePredictionDisplayStatus`: no ramo `finished`, distinguir `partial` de empate (`prediction.homeScore === prediction.awayScore`) → `"acertou_empate"`; `partial` de vencedor → `"acertou_vencedor"`.
  - `predictionLabels.ts`: adicionar `acertou_empate` aos dois `Record` exaustivos (label "Acertou o empate" + classe de cor própria).
  - Atualizar JSDoc/comentários da regra D1 (hoje dizem "empate previsto = 0").
- Main modules/files likely involved:
  - `src/features/predictions/lib/predictionsHelpers.ts`
  - `src/features/predictions/lib/predictionLabels.ts`
  - `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts`
  - `src/features/predictions/components/__tests__/PredictionListComponents.test.tsx` (se asserta sobre labels/cores)
- Dependencies: none
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: `is_frontend` parcial — toca tipos/labels mas a lógica central é domínio puro. TDD foca em `scorePrediction` (casos D1 que mudam de `wrong`→`partial`) e em `derivePredictionDisplayStatus` (novo branch empate). Recalc não muda (já usa `scorePrediction` como oracle). Pós-deploy: super_admin deve acionar `POST /api/rankings/recalc` para republicar rankings de jogos já finalizados.

### TASK-02 – Chip de filtro "Empates" na lista de palpites
- Type: application
- Goal: expor o novo status na UI de filtros da lista de palpites, permitindo filtrar palpites com `"acertou_empate"`.
- Scope:
  - `PredictionFilters.tsx`: adicionar chip `{ value: "acertou_empate", label: "Empates" }` ao array `CHIPS` e incluir `"acertou_empate"` na guarda de `readStoredFilter`.
  - `usePredictionsList.ts`: garantir que o filtro `acertou_empate` seja tratado na lógica de filtragem (se houver switch/match por status).
  - Atualizar testes de filtro/hook conforme.
- Main modules/files likely involved:
  - `src/features/predictions/components/PredictionFilters.tsx`
  - `src/features/predictions/hooks/usePredictionsList.ts`
  - `src/features/predictions/hooks/__tests__/usePredictionsList.test.ts`
- Dependencies: TASK-01 (precisa do valor `"acertou_empate"` no tipo)
- Story points: 1
- Criticality: low
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: `is_frontend: true`. Puramente aditivo — não altera regra. TDD dispensado (filtro = wiring/UI, sem regra de negócio nova). UX: decidir se chip "Vencedor" e "Empates" são separados ou agrupados — default: separados.

## 4. Dependency map

```
TASK-01 (domínio + display contract)
   └─> TASK-02 (UI filter chip — precisa do tipo)
```

## 5. Recommended execution order

1. **TASK-01** — regra de negócio + contrato de display. Fundação.
2. **TASK-02** — chip de filtro UX. Depende do tipo de TASK-01.

## 6. Planning risks and blockers

- **Operação pós-deploy (não-bloqueante):** rankings de jogos já finalizados só refletem a nova regra após `POST /api/rankings/recalc` manual. Documentar no `/release`. O `dirty-by-finish` não dispara só por mudança de regra.
- **TASK-01 é a única com regra de negócio** — TDD obrigatório. Os testes D1 existentes (linha 252–255 do test file) mudam de expectativa (`wrong`→`partial`); cuidado para ajustá-los, não duplicá-los.
- **Sem blockers de clarificação** — ambiguidades A e B resolvidas no checkpoint do PRD (Opção 2 / todas as fases).
