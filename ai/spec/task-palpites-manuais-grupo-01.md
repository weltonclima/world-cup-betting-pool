# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Schemas — input de palpite manual, campos de origem no doc, tipo de log de auditoria

## 2. Objective
Estender a camada de contrato (Zod schemas + tipos derivados) para suportar palpites lançados manualmente pelo admin de grupo, **sem** quebrar palpites/testes existentes e **sem** introduzir a armadilha do `.strict()` (campo não declarado → `safeParse` falha → recalc descarta doc silenciosamente). Esta task é só schemas/tipos — nenhum endpoint, serviço ou UI.

## 3. In scope
- Novo `groupManualPredictionInputSchema` em `src/schemas/predictions.ts`:
  `{ targetUid, matchId, homeScore, awayScore }` (reusa `nonEmptyString` + `scoreSchema`).
- Estender `predictionSchema` (doc Firestore) com 3 campos **opcionais** de origem manual:
  - `editedBy?: nonEmptyString` — uid do admin que lançou.
  - `editedByRole?: roleSchema` — papel do autor da ação (validado pelo enum, não string solta).
  - `editedAt?: isoDateTime` — quando foi lançado/sobrescrito.
- Adicionar tipo `group_admin_manual_prediction` ao enum `systemLogTypeSchema` (append-only) em `src/schemas/systemLogs.ts`.
- Tipo derivado `GroupManualPredictionInput` em `src/types/predictions.ts`.
- Cobertura de testes nos `__tests__` de schemas (válido/inválido + round-trip não-descarte + retrocompat).

## 4. Out of scope
- Endpoint `POST /api/group/predictions` (TASK-02).
- Qualquer leitura/escrita Firestore, autorização, escopo, recalc (TASK-02).
- Serviço cliente / hooks / UI / badge (TASK-03/04/05).
- Validação cruzada de coerência (ex.: `editedBy` exige `editedAt`) — schema trata campos como independentes e opcionais; invariantes ficam no Route Handler (mesma política já adotada para `status/points`).

## 5. Main technical areas involved
- `src/schemas/predictions.ts` — `predictionSchema` (`.strict()`), novo input schema.
- `src/schemas/shared.ts` — reusa `roleSchema`, `nonEmptyString`, `scoreSchema`, `isoDateTime` (sem alteração).
- `src/schemas/systemLogs.ts` — enum `systemLogTypeSchema`.
- `src/types/predictions.ts` — tipos derivados.
- `src/schemas/__tests__/predictions.test.ts` (+ possivelmente `systemLogs.test.ts` se existir) — testes.

## 6. Business rules and behavior
- Campos de origem são **opcionais**: palpite normal (cliente) não os carrega; palpite manual (admin) os carrega. Doc antigo sem eles continua válido (retrocompat).
- `editedByRole` deve aceitar **somente** valores de `roleSchema`. Na entrega A4, na prática será `group_admin`, mas o schema valida o enum inteiro (não restringir aqui — evita acoplar schema à regra de autorização de TASK-02).
- `predictionSchema` permanece `.strict()`: os 3 campos novos **têm** de estar declarados no schema, senão um doc gravado com eles falha o `safeParse` e o caminho de recalc (`recalcRankings` → `predictionSchema.safeParse(doc.data())`) **descarta** o doc → palpite manual some do ranking. Este é o ponto crítico da task.
- `groupManualPredictionInputSchema` usa `targetUid` (não `uid`): deixa explícito que o alvo vem do body (validado/escopado no servidor em TASK-02), distinto do fluxo normal onde `uid` vem da sessão.

## 7. Contracts and interfaces
- `groupManualPredictionInputSchema`:
  ```
  { targetUid: nonEmptyString, matchId: nonEmptyString, homeScore: scoreSchema, awayScore: scoreSchema }
  ```
  (sem `.strict()` obrigatório — seguir padrão de `predictionInputSchema`, que faz strip de extras; decisão do implementador, mas manter consistência com input existente.)
- `predictionSchema` (doc) passa a aceitar adicionalmente: `editedBy?`, `editedByRole?`, `editedAt?` — todos opcionais.
- `systemLogTypeSchema` ganha `"group_admin_manual_prediction"`.
- Tipos: `export type GroupManualPredictionInput = z.infer<typeof groupManualPredictionInputSchema>`. `Prediction` (já derivado de `predictionSchema`) passa a expor os 3 campos opcionais automaticamente.

## 8. Data and persistence impact
- Sem migração: campos opcionais, docs existentes permanecem válidos.
- Sem novo índice.
- O contrato de doc é o que TASK-02 vai gravar — **drift de nome/tipo entre esta task e TASK-02 = palpite descartado no recalc**. Os nomes aqui são o contrato fonte-da-verdade.

## 9. Required tests
Em `src/schemas/__tests__/predictions.test.ts`:
- `predictionSchema` aceita doc com os 3 campos de origem (`editedBy/editedByRole/editedAt`) válidos.
- `predictionSchema` aceita doc **sem** os campos (retrocompat — não quebrar palpites normais).
- `predictionSchema` rejeita `editedByRole` fora de `roleSchema`.
- `predictionSchema` rejeita `editedBy` vazio.
- `predictionSchema` rejeita `editedAt` com formato inválido.
- **Round-trip não-descarte (crítico):** doc completo (`uid, matchId, homeScore, awayScore, status, points, editedBy, editedByRole, editedAt`) passa em `predictionSchema.safeParse` com `success === true` — prova que `.strict()` não rejeita o doc que TASK-02 vai gravar.
- `.strict()` ainda rejeita campo extra **não** declarado mesmo junto dos campos de origem.
- `groupManualPredictionInputSchema`: aceita input válido; rejeita `targetUid` ausente/vazio; rejeita placar negativo/não-inteiro; rejeita `matchId` ausente.
- Inferência de tipo: `Prediction["editedByRole"]` é `Role | undefined`; `GroupManualPredictionInput["targetUid"]` é `string`.
- `systemLogTypeSchema` aceita `"group_admin_manual_prediction"` (e demais permanecem válidos).

## 10. Acceptance criteria
- `pnpm vitest run` verde em todos os `__tests__` de schemas (existentes + novos), nenhum teste atual quebrado.
- `rtk tsc` sem erros de tipo (sem `any`).
- Round-trip não-descarte comprovado por teste.
- `editedByRole` pinado a `roleSchema`.
- Tipos derivados exportados e usados nos testes de inferência.

## 11. Constraints
- Não usar `any`. Não usar `z.intersection`/`.and` (refine dropado no Zod 4 — política do projeto).
- Campos novos **opcionais**; não tornar obrigatórios (quebraria palpite normal + docs antigos).
- Enum de log append-only (não reordenar/remover valores existentes).
- Comentários/domínio em pt-BR.
- Schema é fonte-única-de-verdade; tipos derivam dele (sem import circular schema↔types — tipos importam de `@/schemas/*`).

## 12. Execution cost profile
- tdd: sonnet/medium (schemas têm regra de validação pura — TDD cabe)
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Camada de schema/tipo pura. Nenhuma tela, componente ou interação.

## 14. Open questions
Nenhuma. Contrato e nomes de campo travados; TASK-02 deve consumir exatamente estes nomes.
