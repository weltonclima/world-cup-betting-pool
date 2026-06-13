# SPEC

## 1. Task id and title
- Task: TASK-04
- Title: Tela `(app)/group/predictions` — admin lança palpite manual

## 2. Objective
Tela onde o admin de grupo seleciona um **participante aprovado** do seu grupo + um **jogo bloqueado**, informa o placar via `ScoreInput`, e salva via `useCreateManualPrediction`. Se já existe palpite, **diálogo de confirmação** mostrando atual→novo (A2) antes de sobrescrever. Estados loading/empty/error cobertos. Atrás de `GroupAdminGuard` (já no `group/layout.tsx`). Consistente com `design-system/MASTER.md` e telas `(app)/group/*`.

## 3. In scope
- Rota `src/app/(app)/group/predictions/page.tsx` (server component fino → renderiza o componente client da feature).
- Componente client `src/features/groupAdmin/components/GroupManualPredictions.tsx` (mirror estrutural de `GroupPendingUsers`).
- Seletor de **participante** (aprovados via `useGroupUsers("approved")`) — `<select>` nativo acessível (sem componente Select no projeto).
- Seletor de **jogo bloqueado** (de `useMatches()` filtrado por `selectLockedMatches(matches, now)`), rótulo `TimeCasa x TimeFora` + placar real se `finished` (lookup via `useTeams()`).
- `ScoreInput` (reuso) para homeScore/awayScore.
- Botão "Salvar palpite": se já existe palpite do alvo p/ aquele jogo (derivar de dados já disponíveis na tela — ver §6), abrir `ConfirmActionDialog` com atual→novo; senão submeter direto.
- Submit via `useCreateManualPrediction().mutate(...)`; sucesso → `toast.success` + reset do form; erro → toast (hook já faz `onError`).
- Estados: loading (skeleton), erro (retry), vazio (sem participantes **ou** sem jogos bloqueados), sucesso.
- Entrada de navegação "Palpites manuais" nas Ações Rápidas do `GroupDashboard` (link p/ `/group/predictions`).

## 4. Out of scope
- Endpoint, service, hooks (TASK-02/03 entregues).
- Badge de origem no card de palpite do participante (TASK-05).
- Novo endpoint de listagem de palpites do grupo (não existe; ver §6 sobre como saber se há palpite anterior).
- Notificar o participante.
- Mudança no `ScoreInput`/`ConfirmActionDialog`/`GroupAdminGuard`.

## 5. Main technical areas involved
- `src/app/(app)/group/predictions/page.tsx` (novo, server thin).
- `src/features/groupAdmin/components/GroupManualPredictions.tsx` (novo, `"use client"`).
- Reuso: `useGroupUsers` (`@/features/groupAdmin/hooks`), `useCreateManualPrediction` (idem), `useMatches` (`@/features/matches/hooks`), `useTeams` (`@/features/home/hooks`), `selectLockedMatches` + `isPredictionLocked` (`@/features/predictions/lib`), `ScoreInput` (`@/features/predictions/components`), `ConfirmActionDialog` (`@/features/admin/components`), `GroupAdminSubHeader`/estados (padrão `GroupPendingUsers`).
- `src/features/groupAdmin/components/GroupDashboard.tsx` (add card de ação).
- `ui-spec`: `ai/ui-spec/task-palpites-manuais-grupo-04.md`.

## 6. Business rules and behavior
- **Guard:** rota sob `group/layout.tsx` → `GroupAdminGuard` já protege (role group_admin/super_admin; senão redirect `/home`). Confirmar, não reimplementar.
- **Participante:** só `useGroupUsers("approved")`. Se lista vazia → empty state ("Nenhum participante aprovado").
- **Jogo:** `now = new Date()` (no client, no render/handler), `selectLockedMatches(matches, now)`. Se vazio → empty state ("Nenhum jogo bloqueado para lançar palpite"). Rótulo: `${homeTeam.name} x ${awayTeam.name}`; se `status==="finished"` anexar placar real `(2 x 0)`.
- **Detecção de palpite anterior (overwrite A2):** não há endpoint de leitura de palpites do grupo no client (Rules). Estratégia: o diálogo de confirmação dispara **sempre que o admin salvar** (mensagem: "Se já houver um palpite para este participante neste jogo, ele será **sobrescrito**. Confirmar?"). Não tentar ler o palpite anterior no client. O endpoint (TASK-02) faz read-before-write e auditoria do anterior→novo server-side — a transparência fica na auditoria, não na UI. (Decisão: confirmação incondicional pré-submit, simples e segura; evita leitura proibida pelas Rules.)
- **Submit:** `mutate({ targetUid, matchId, homeScore, awayScore })`. `isPending` desabilita form e botões. Sucesso → `toast.success("Palpite lançado.")`, limpar seleção/scores. Erro tratado pelo hook (`onError` → toast).
- **Acessibilidade:** labels com `htmlFor`; `<select>` com `aria-label`/label; alvos ≥44px; foco visível; dialog já acessível.

## 7. Contracts and interfaces
- Consome `GroupManualPredictionInput = { targetUid, matchId, homeScore, awayScore }`.
- `useGroupUsers("approved") → GroupUser[]` (`{ user, rankingPoints?, rankingPosition? }`).
- `useMatches() → MatchWithId[]`; `useTeams() → TeamWithId[]`.
- `ConfirmActionDialog` props: `{ open, onOpenChange, title, description, confirmLabel, confirmVariant, pending, onConfirm }`.
- `ScoreInput` props: `{ label, value, onChange, disabled?, min?, max? }`.

## 8. Data and persistence impact
- Nenhum direto. Escrita ocorre via endpoint (TASK-02). Tela só lê (membros/jogos/teams) e dispara mutation.

## 9. Required tests
TDD **não** (UI; lógica pura já coberta em 01/02/03). Test phase mínima de valor:
- Render do componente com mocks dos hooks: estados empty (sem participantes; sem jogos bloqueados), e happy (seleção habilita submit). Usar testing-library se já houver setup no projeto; se não houver infra de render-test para telas, **skip com justificativa** (validação via `/local-env` + build) — não montar infra nova só p/ isto.
- Não testar wiring de `useMutation`/toast (baixo valor).

## 10. Acceptance criteria
- Rota existe, protegida pelo guard do layout (confirmado).
- Fluxo: seleciona participante + jogo bloqueado → informa placar → confirma → mutation dispara com payload correto.
- Empty/loading/error/sucesso cobertos.
- Só jogos bloqueados aparecem; só aprovados aparecem.
- Acessível (labels, foco, alvos ≥44px).
- `tsc` sem erros novos; build verde; sem `any`.
- Card "Palpites manuais" no dashboard linka `/group/predictions`.

## 11. Constraints
- Strict TS, sem `any`. `now` injetado no client (sem `new Date()` dentro de helpers puros).
- Não ler palpites de outros users no client (Rules) — confirmação incondicional.
- Reusar componentes existentes; não criar Select novo se `<select>` nativo basta.
- Seguir `design-system/MASTER.md` (tokens semânticos, sem hex; min-h 44px; focus-visible).
- Precedência de design: `patterns/nextjs` > ui-ux-pro-max; context7 confirma API.

## 12. Execution cost profile
- ui-spec: sonnet/high
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high
- ui-review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: Cria a tela `GroupManualPredictions` (page + componente, seletores, form, dialog). `/ui-spec` + `/patterns:nextjs` obrigatórios.

## 14. Open questions
Nenhuma travada. Decisão de "confirmação incondicional" registrada em §6 (evita leitura proibida pelas Rules; transparência real fica na auditoria server-side).
