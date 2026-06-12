# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Contratos — estado `partial` + domínio de `points` tolerante a legado

## 2. Objective
Preparar os contratos (Zod + tipos) para a regra de pontuação ponderada **sem
mudar comportamento ainda**: adicionar o estado `partial` ao enum de status e
ampliar o domínio de `points` para aceitar `{0, 1, 5, 10}` na leitura,
mantendo docs legados (`points: 1`) válidos. Nenhuma lógica de pontuação muda
nesta task.

## 3. In scope
- `schemas/shared.ts` → `predictionStatusSchema`: adicionar valor `"partial"`
  com comentário de semântica ("acertou o vencedor, +5").
- `schemas/predictions.ts` → `predictionSchema.points`: trocar
  `z.literal(0).or(z.literal(1))` por uma união que aceite **`{0, 1, 5, 10}`**
  (o `1` legado segue válido até o próximo `/score` — R1).
- `features/predictions/lib/predictionsHelpers.ts` →
  `ScorePredictionResult`: `points: 0 | 1` → `0 | 5 | 10`; `status` ganha
  `"partial"` (passa a `"correct" | "partial" | "wrong" | "pending"`).
- `schemas/rankings.ts` → atualizar **apenas o comentário** obsoleto de
  `points` ("=== acertos exatos") para refletir "pontos ponderados no escopo"
  (sem mudança de tipo — já é `z.int().min(0)`).
- Atualizar os testes existentes que cravam `points ∈ {0,1}` para o novo
  domínio (R5), em `schemas/__tests__/predictions.test.ts`.

## 4. Out of scope
- **Não** tocar a lógica de `scorePrediction` (fica na TASK-02). O corpo da
  função e os literais que ela retorna (`points: 1`) **não** mudam aqui — só a
  *assinatura* do tipo `ScorePredictionResult` é ampliada. Manter a função
  compilando contra o novo tipo (o valor `1` ainda pertence ao domínio do
  schema, mas não ao novo tipo `0 | 5 | 10` — ver §6/§14).
- **Não** emitir `partial` de lugar nenhum (só passa a existir no domínio).
- **Não** mudar `recalc.ts`, `accuracy.ts`, badges, UI ou qualquer agregação.
- **Não** mudar `predictionInputSchema` / `groupManualPredictionInputSchema`
  (cliente nunca envia `points`/`status`).
- **Não** mudar o tipo de `rankingEntrySchema.points` (só comentário).

## 5. Main technical areas involved
- `src/schemas/shared.ts` — enum `predictionStatusSchema`.
- `src/schemas/predictions.ts` — literal de `points` no `predictionSchema`.
- `src/schemas/rankings.ts` — comentário de `points` (doc only).
- `src/features/predictions/lib/predictionsHelpers.ts` — tipo
  `ScorePredictionResult` (interface).
- `src/schemas/__tests__/predictions.test.ts` — migração das asserções de
  domínio de `points` + status.

## 6. Business rules and behavior
- **Status `partial`:** novo estado canônico de persistência — "acertou o time
  vencedor sem placar exato (+5)". Vai junto dos demais valores em inglês
  (chave de armazenamento estável). Posição no enum: após `correct`,
  documentado.
- **Domínio de `points` na leitura (R1):** o `predictionSchema` é a porta de
  leitura do recalc (`safeParse(doc.data())`). Deve aceitar:
  - `0` — errou / pendente (legado e novo).
  - `1` — **legado** (escrito pela regra binária; segue válido até re-score).
  - `5` — novo (acertou vencedor).
  - `10` — novo (placar exato).
  Qualquer outro valor (`2`, `-1`, `0.5`, `3`…) é rejeitado.
- **Sem coerência cruzada status↔points no schema:** mantém-se a regra atual —
  o schema trata `status` e `points` como campos independentes/opcionais; a
  invariante de negócio é do Route Handler/regra, não do schema de leitura.
- **`scorePrediction` inalterada nesta task:** continua retornando
  `{ status: "correct", points: 1 }` no caminho exato. Como o tipo de retorno
  passa a ser `points: 0 | 5 | 10`, o literal `1` no corpo deixa de ser
  atribuível → ver §14 (decisão de implementação para não quebrar o build sem
  introduzir lógica nova).

## 7. Contracts and interfaces
- `predictionStatusSchema` (Zod enum):
  `["pending", "correct", "partial", "wrong", "locked"]`.
  Tipo inferido `PredictionStatus` herda `"partial"`.
- `predictionSchema.points` (Zod): união aceitando `{0, 1, 5, 10}`, `.optional()`.
  Forma sugerida (preservar `.literal` por clareza de domínio fechado):
  `z.union([z.literal(0), z.literal(1), z.literal(5), z.literal(10)]).optional()`
  (ou `z.literal([0, 1, 5, 10])` se a versão de Zod do projeto suportar array
  literal — confirmar na implementação; o teste é a forma final).
- `ScorePredictionResult` (TS interface):
  - `status: "correct" | "partial" | "wrong" | "pending"`
  - `points: 0 | 5 | 10`
- `rankingEntrySchema.points`: inalterado (`z.int().min(0)`), só comentário.

## 8. Data and persistence impact
- Nenhuma migração. Docs legados `predictions/*` com `points: 1` continuam
  passando no `safeParse` do recalc — **invariante crítica** (sem isso, recalc
  descarta palpite silenciosamente, R1).
- Nenhuma escrita nova de `partial` nesta task.
- Forma do doc `predictions` inalterada (mesmos campos; só o domínio de `points`
  alarga).

## 9. Required tests
TDD recomendado (regra de validação de domínio). Em
`schemas/__tests__/predictions.test.ts`:
- `points`: aceita `0`, **`1` (legado)**, `5`, `10`.
- `points`: rejeita `2`, `-1`, `0.5`, `3` (fora do conjunto).
- Migrar os testes atuais "rejeita points = 2" — `2` continua inválido, mas
  agora deve haver casos explícitos aceitando `5` e `10`.
- `predictionStatusSchema`: aceita `"partial"` (somar ao loop de válidos);
  segue rejeitando `"scored"`/`"unknown"`/`""`.
- Inferência de tipo: `Prediction["points"]` agora
  `0 | 1 | 5 | 10 | undefined`; `Prediction["status"]` inclui `"partial"`.
- Atualizar a asserção `expectTypeOf<PredictionStatus>` para incluir `partial`.
- Guard de não-regressão: doc legado `{...valid, points: 1, status: "correct"}`
  segue válido.

## 10. Acceptance criteria
- `predictionStatusSchema` aceita `"partial"`; tipos inferidos propagam.
- `predictionSchema.points` aceita `{0,1,5,10}` e rejeita o resto.
- `ScorePredictionResult` tem o novo `status`/`points`; o projeto **compila**
  (`tsc`) sem erro novo.
- Suíte `predictions.test.ts` verde, incluindo os novos casos `5`/`10`/`partial`
  e o legado `1`.
- `scorePrediction` não teve mudança de comportamento (mesma saída runtime).
- Nenhum arquivo fora do §5 alterado.

## 11. Constraints
- Não introduzir lógica de pontuação ponderada (TASK-02).
- Preservar retrocompatibilidade de leitura (`points: 1`).
- `.strict()` do `predictionSchema` permanece — não declarar campos novos.
- Valores de enum em slug inglês minúsculo (convenção `shared.ts`).
- Não renomear campos nem mudar tipo de `rankingEntrySchema.points`.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: task de contrato/persistência pura (schemas Zod + interface TS +
  testes unitários). Sem tela, componente ou interação.

## 14. Open questions
- **Atribuição do literal `1` em `scorePrediction` sob o novo tipo
  `0 | 5 | 10`:** a TASK-01 amplia o *tipo* de retorno mas não a *lógica*. O
  corpo atual retorna `points: 1` no caminho `correct`, que deixa de ser
  atribuível a `0 | 5 | 10`. Decisão recomendada para manter o build verde sem
  antecipar a TASK-02: **trocar apenas o literal do caminho exato de `1` para
  `10`** (placar exato = 10 já é a regra final e não altera nenhuma agregação
  ainda binária além de pontuar 10 em vez de 1 no doc do palpite). Se a equipe
  preferir zero mudança de valor nesta task, alternativa é manter `points` como
  está e adiar a ampliação do tipo de retorno para a TASK-02 — **mas** isso
  contraria o escopo "ampliar `ScorePredictionResult` aqui". Confirmar no
  `/implement`: preferência por trocar `1 → 10` no caminho `correct` (mínimo,
  consistente com D-final) e deixar `partial`/`5` para a TASK-02.

---

# SPEC REPORT

## 1. Spec generated
- `ai/spec/ranking-pontuacao-ponderada-task-01.md`

## 2. Task covered
- TASK-01 — Contratos: estado `partial` + domínio de `points` tolerante a legado

## 3. Scope summary
- Enum `predictionStatusSchema` ganha `"partial"`; `predictionSchema.points`
  aceita `{0,1,5,10}` (legado `1` preservado, R1); `ScorePredictionResult`
  amplia `status`/`points`; comentário de `rankingEntrySchema.points`
  atualizado; testes de domínio migrados. Sem lógica de pontuação.

## 4. Main risks or open questions
- R1: schema de leitura **deve** aceitar `1` legado, senão o recalc descarta
  palpites. Travado em teste.
- Open: literal `1 → 10` no caminho `correct` de `scorePrediction` para o build
  compilar sob o novo tipo, sem introduzir a regra ponderada (resolver no
  `/implement`).

## 5. Frontend detected
- is_frontend: false
