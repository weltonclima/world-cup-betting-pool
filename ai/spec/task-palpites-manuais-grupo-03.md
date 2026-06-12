# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Service client + hooks — palpite manual (membros aprovados, jogos bloqueados, mutation)

## 2. Objective
Camada cliente que liga a tela (TASK-04) ao endpoint `POST /api/group/predictions` (TASK-02): função de serviço tipada com erro pt-BR, hook de mutation React Query com invalidação correta, e reuso dos dados existentes (membros aprovados via `GET /api/group/users/approved`; jogos bloqueados derivados de `useMatches()` + `isPredictionLocked`). Sem nova leitura Firestore no client (Rules negam).

## 3. In scope
- `src/services/group.ts`: nova função `createGroupManualPrediction(input: GroupManualPredictionInput): Promise<GroupManualPredictionSaved>` — `POST /api/group/predictions`, mesmo padrão de `moderateGroupUser` (typed error `GroupServiceError`, `HTTP_ERROR_MESSAGES` + `toServiceError`, fetch `credentials:"same-origin"`, parse da resposta).
- Tipo do retorno `GroupManualPredictionSaved` (shape `saved` do endpoint) derivado de um schema Zod novo `groupManualPredictionSavedSchema` em `src/schemas/predictions.ts` (parse defensivo da resposta — não `as`).
- Hook `useCreateManualPrediction()` em `src/features/groupAdmin/hooks/` (mirror `useUpsertPrediction`): `useMutation`, `onSuccess` invalida palpites + ranking + membros; `onError` `toast.error`.
- Chave de query nova em `groupKeys` (`src/features/groupAdmin/hooks/groupKeys.ts`) se necessário p/ a lista de palpites do grupo.
- Helper de seleção (puro) p/ derivar **jogos bloqueados** de `MatchWithId[]`: `selectLockedMatches(matches, now)` usando `isPredictionLocked` — colocar junto aos helpers de predictions ou no feature groupAdmin. Reuso de `useMatches()` para a fonte.
- Reuso de `useGroupUsers("approved")` (já existe) para membros — **não** reimplementar.

## 4. Out of scope
- Tela / componentes / navegação (TASK-04).
- Badge de origem (TASK-05).
- Qualquer mudança no endpoint, schemas de input/origem (TASK-01/02 já entregaram), Firestore Rules.
- Novo endpoint de listagem de palpites do grupo (fora do PRD-12; a tela usa membros + jogos + mutation).

## 5. Main technical areas involved
- `src/services/group.ts` (add função + reuso de `toServiceError`/`extractErrorDetail`).
- `src/schemas/predictions.ts` (add `groupManualPredictionSavedSchema`) + `src/types/predictions.ts` (tipo derivado).
- `src/features/groupAdmin/hooks/useCreateManualPrediction.ts` (novo) + `groupKeys.ts` (chave, se preciso).
- Reuso: `useGroupUsers` (`@/features/groupAdmin/hooks`), `useMatches` (`@/features/matches/hooks`), `isPredictionLocked` (`@/features/predictions/lib`), `predictionsKeys`/`matchesKeys`/`homeKeys`/rankings keys p/ invalidação.

## 6. Business rules and behavior
- `createGroupManualPrediction`: POST com body `{ targetUid, matchId, homeScore, awayScore }`; em `!response.ok` → `throw await toServiceError(response)` (mapeia 400/403/404/409/422/500 p/ pt-BR, anexa `detail`); em ok → parse `groupManualPredictionSavedSchema` do `body.saved` (não `as`).
- `useCreateManualPrediction.onSuccess`: invalidar `predictionsKeys.all()`, `matchesKeys.predictions(uid_alvo)` se aplicável, a chave de ranking do grupo, e `groupKeys.usersByStatus("approved")` (lista pode exibir status de palpite). Aceitável invalidar de forma ampla (`predictionsKeys.all()` + chave raiz de ranking) — correção > micro-otimização. `onError`: `toast.error(error.message)`.
- `selectLockedMatches(matches, now)`: retorna só `matches.filter(m => isPredictionLocked(m, now))`. Puro, sem efeito.
- Erros nunca expõem dado sensível; mensagens pt-BR já vêm do endpoint/`HTTP_ERROR_MESSAGES`.

## 7. Contracts and interfaces
- **Input:** `GroupManualPredictionInput` (TASK-01) = `{ targetUid, matchId, homeScore, awayScore }`.
- **Resposta endpoint:** `{ saved: { id, uid, matchId, homeScore, awayScore, editedBy, editedByRole, editedAt } }`. `groupManualPredictionSavedSchema` valida o objeto `saved`; `editedByRole` via `roleSchema`; `editedAt` `isoDateTime`; `id/uid/matchId` `nonEmptyString`; scores `scoreSchema`.
- **Hook:** `useCreateManualPrediction(): UseMutationResult<GroupManualPredictionSaved, Error, GroupManualPredictionInput>`.
- **Service error:** reusa `GroupServiceError` existente (status + message pt-BR).

## 8. Data and persistence impact
- Nenhum. Camada cliente pura: chama Route Handler e invalida caches React Query. Sem acesso Firestore direto.

## 9. Required tests
TDD **não** aplicável (wiring/data-access; mapeamento trivial — comportamento crítico já coberto em TASK-02 e validado E2E na TASK-04). Cobertura mínima de valor (test phase, não-TDD):
- `selectLockedMatches`: filtra corretamente (jogo futuro/scheduled fora; encerrado/ao vivo/kickoff-passado dentro) — teste puro barato, alto valor (regra de seleção).
- `createGroupManualPrediction`: opcional, mock `fetch` — sucesso parseia `saved`; erro 409 vira `GroupServiceError` com message pt-BR. Incluir se barato; senão justificar skip (coberto pela rota).
Não inflar: sem teste de `useMutation` wiring (baixo valor).

## 10. Acceptance criteria
- `createGroupManualPrediction` compila, parseia a resposta por schema (não `as`), mapeia erros pt-BR.
- `useCreateManualPrediction` compila, invalida queries certas, `toast.error` no erro.
- `selectLockedMatches` filtra por `isPredictionLocked`; teste verde.
- Membros via `useGroupUsers("approved")` (sem reimplementar leitura).
- `tsc` sem erros novos em `src/`; sem `any`.

## 11. Constraints
- Strict TS, sem `any`. Parse de resposta por Zod, nunca `as`.
- Não ler Firestore no client (Rules). Membros só via endpoint existente.
- Reusar `toServiceError`/`GroupServiceError`/`extractErrorDetail` — não criar novo wrapper.
- Mensagens pt-BR. Não tocar endpoint/schemas de input/origem.

## 12. Execution cost profile
- tdd: n/a (não aplicável)
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Camada de serviço + hooks de dados. Sem UI/componentes (tela é TASK-04).

## 14. Open questions
Nenhuma. Contrato do endpoint travado em TASK-02; reusos existem.
