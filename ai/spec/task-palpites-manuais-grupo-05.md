# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Badge "lançado pelo admin" no card de palpite (transparência)

## 2. Objective
Exibir um badge discreto e acessível no card de palpite do participante **somente quando** o palpite foi lançado/sobrescrito pelo admin de grupo (campo `prediction.editedBy` presente). Puramente informativo — nenhuma mudança de pontuação ou ranking.

## 3. In scope
- Plumbing do sinal de origem manual até a UI: adicionar `isManual: boolean` a `PredictionListItem` (`usePredictionsList`), derivado de `Boolean(prediction.editedBy)`.
- Renderizar badge "Lançado pelo admin" em `PredictionListCard` quando `item.isManual` for `true`.
- Badge acessível (texto visível + ícone `aria-hidden`), estilo discreto com tokens semânticos (espelha o padrão de `PredictionStatusBadge`).

## 4. Out of scope
- Qualquer mudança em schema/endpoint/hooks de escrita (TASK-01/02/03 entregues).
- Mostrar QUEM (uid/nome do admin) ou QUANDO — só o fato "lançado pelo admin". (Transparência detalhada fica na auditoria server-side, TASK-02.)
- Exibir badge em telas de palpite de OUTROS usuários — o client não lê `predictions` alheios (Firestore Rules); a única superfície é a lista do próprio participante.
- Mudança de pontuação/algoritmo de ranking.
- Tooltip com biblioteca nova (não há componente Tooltip no projeto) — rótulo acessível via texto + `aria-label`/`title`.

## 5. Main technical areas involved
- `src/features/predictions/hooks/usePredictionsList.ts` (add campo `isManual` ao item + derivação no map).
- `src/features/predictions/components/PredictionListCard.tsx` (render condicional do badge).
- Teste: `src/features/predictions/components/__tests__/PredictionListComponents.test.tsx` (já existe — complementar).

## 6. Business rules and behavior
- Badge aparece **se e somente se** `prediction.editedBy` truthy. Palpite normal (sem `editedBy`) → nenhum badge.
- `prediction.editedBy` já é campo opcional declarado em `predictionSchema` (TASK-01); `usePredictions` entrega o doc completo, então o sinal está disponível sem nova query.
- Sem efeito em `displayStatus`, placar, ou ordenação.
- Texto do badge: "Lançado pelo admin". Ícone: `ShieldCheck` (lucide), `aria-hidden`.

## 7. Contracts and interfaces
- `PredictionListItem` ganha `isManual: boolean` (campo obrigatório no view-model; sempre derivado, nunca undefined).
- `PredictionListCard` consome `item.isManual` (sem nova prop externa).
- Sem mudança em contratos de rede/persistência.

## 8. Data and persistence impact
- Nenhum. Leitura apenas; campo já persistido pelo endpoint manual (TASK-02).

## 9. Required tests
TDD **não** (apresentação pura). Test phase mínima:
- `PredictionListCard`: renderiza badge "Lançado pelo admin" quando `item.isManual === true`.
- `PredictionListCard`: **não** renderiza badge quando `item.isManual === false`.
- (Opcional, se baixo custo) `usePredictionsList`: `isManual` derivado de `editedBy` — cobrir via o teste de compositor existente se já houver setup.

## 10. Acceptance criteria
- Badge aparece só com `editedBy` presente; não vaza em palpites normais.
- Acessível (texto visível, ícone `aria-hidden`, contraste via tokens).
- `tsc` sem erros novos; build verde; sem `any`.
- Sem regressão nos testes de `PredictionListCard`.

## 11. Constraints
- Strict TS, sem `any`.
- Tokens semânticos (sem hex); estilo discreto, não competir com o badge de status.
- Reusar padrão visual de `PredictionStatusBadge`; não introduzir lib de tooltip.
- Precedência de design: `patterns/nextjs` > ui-ux-pro-max (não reinvocado — decisão trivial reusa ui-spec TASK-04).

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: true
- reason: Adiciona elemento visual (badge) ao `PredictionListCard`.

## 14. Open questions
Nenhuma. Decisão de "só o fato, sem quem/quando" registrada em §4 (detalhe fica na auditoria server-side).
