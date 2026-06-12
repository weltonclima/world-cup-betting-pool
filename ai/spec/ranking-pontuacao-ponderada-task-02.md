# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Regra de pontuação ponderada em `scorePrediction` (TDD)

## 2. Objective
Reescrever a única fonte de verdade da pontuação (`scorePrediction`) para
retornar `points ∈ {0, 5, 10}` e `status ∈ {correct, partial, wrong, pending}`,
derivando o vencedor do sinal de `homeScore − awayScore` do palpite e da
partida. Regra de **dois critérios**: placar exato = 10; vencedor real acertado
(sem placar exato) = 5; resto = 0. Concentrar a regra **exclusivamente** aqui —
nenhum consumidor recalcula vencedor.

## 3. In scope
- Reescrever o corpo de `scorePrediction` em
  `features/predictions/lib/predictionsHelpers.ts`:
  - `match.status !== "finished"` → `{ status: "pending", points: 0 }`.
  - `finished` com `homeScore`/`awayScore` null (inconsistência) →
    `{ status: "wrong", points: 0 }` (conservador — mantém comportamento atual).
  - placar exato (home e away batem) → `{ status: "correct", points: 10 }`.
  - vencedor real acertado **e não é empate** → `{ status: "partial", points: 5 }`.
  - empate inexato, vencedor errado → `{ status: "wrong", points: 0 }`.
- Estreitar `ScorePredictionResult.points` de `0 | 1 | 5 | 10` para `0 | 5 | 10`
  (remover o legado `1` do **tipo de retorno** — carryforward do review da
  TASK-01). Atualizar o comentário da interface.
- Atualizar a doc-string de `scorePrediction` (não é mais "binária").
- Migrar a suíte `features/predictions/lib/__tests__/predictionsHelpers.test.ts`
  (bloco `describe("scorePrediction")`, linhas ~205–271) que crava
  `points ∈ {0,1}` para a tabela-verdade ponderada (R5).

## 4. Out of scope
- **Não** mudar `derivePredictionDisplayStatus` (badge do 3º estado é a TASK-04).
  Consequência temporária aceita: `partial` cai no ramo `else → "errou"` até a
  TASK-04 — registrar no §14, não corrigir aqui.
- **Não** mudar `recalc.ts`, `accuracy.ts`, `distribution`, `pool_stats`,
  `longestStreak` (separação pontos × exatos é a TASK-03).
- **Não** mudar `predictionSchema.points` (mantém `{0,1,5,10}` na **leitura** —
  legado `1` segue válido; só o tipo de retorno da função estreita).
- **Não** tocar `predictionStatusSchema` (já tem `partial` desde a TASK-01).
- **Não** mexer em `isPredictionLocked`, `selectLockedMatches`, `predictionDocId`.

## 5. Main technical areas involved
- `src/features/predictions/lib/predictionsHelpers.ts` — `scorePrediction`
  (corpo) + `ScorePredictionResult` (narrow do tipo).
- `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts` — migração
  da tabela-verdade.

## 6. Business rules and behavior
Derivação do vencedor por **sinal** (O(1), sem campo "winner", que não existe):
- `sign(prediction.homeScore − prediction.awayScore)` vs.
  `sign(match.homeScore − match.awayScore)`.

Tabela-verdade (só quando `match.status === "finished"` e scores não-null):

| Caso | Palpite | Real | Resultado |
|---|---|---|---|
| Placar exato | 2×1 | 2×1 | `correct` / **10** |
| Empate exato | 0×0 | 0×0 | `correct` / **10** |
| Vencedor certo, placar errado | 2×1 | 3×1 | `partial` / **5** |
| Vencedor certo, placar errado | 1×0 | 2×0 | `partial` / **5** |
| Vencedor errado (invertido) | 2×1 | 1×2 | `wrong` / **0** |
| Empate previsto, jogo decidido | 1×1 | 2×1 | `wrong` / **0** |
| Empate previsto, empate real inexato | 1×1 | 2×2 | `wrong` / **0** (D1) |
| Vitória prevista, jogo empatou | 2×1 | 1×1 | `wrong` / **0** |

Fora-finished e null:
| Caso | Resultado |
|---|---|
| `scheduled` / `live` / `postponed` (não-finished) | `pending` / **0** |
| `finished` + scores null | `wrong` / **0** |

**D1 (empate estrito):** palpite de empate só pontua com placar exato (10).
Qualquer outro empate previsto = 0. O +5 **exige** um vencedor real acertado
(nunca empate). Piso 0 — nunca negativo.

Função pura: `now` nunca interno; sem side effects; idempotente.

## 7. Contracts and interfaces
- `ScorePredictionResult`:
  - `status: "correct" | "partial" | "wrong" | "pending"` (inalterado desde TASK-01)
  - `points: 0 | 5 | 10` (narrow: remove `1`)
- Assinatura de `scorePrediction(prediction: Prediction, match: MatchWithId):
  ScorePredictionResult` — inalterada.
- Nenhum contrato Zod muda nesta task.

## 8. Data and persistence impact
- Nenhuma migração. `scorePrediction` não persiste — quem grava é o Route
  Handler `/score` (palpite) e o recalc (ranking), ambos fora do escopo.
- Docs legados `points: 1` continuam válidos na **leitura** (`predictionSchema`
  intocado). O próximo `/score` regrava com o domínio ponderado.

## 9. Required tests
TDD **obrigatório** (regra de cálculo condicional — "TDD Decision Rule").
Em `predictionsHelpers.test.ts`, bloco `scorePrediction`, cobrir a tabela §6:
- exato decidido → `correct`/10; empate exato → `correct`/10.
- vencedor certo placar errado (≥2 casos: mandante e visitante) → `partial`/5.
- vencedor errado / invertido → `wrong`/0.
- empate previsto + jogo decidido → `wrong`/0.
- empate previsto + empate real inexato (1×1 vs 2×2) → `wrong`/0 (D1).
- vitória prevista + jogo empatou → `wrong`/0.
- não-finished (`scheduled`/`live`/`postponed`) → `pending`/0.
- `finished` + scores null → `wrong`/0.
- idempotência preservada (atualizar o valor esperado de 1 → 10).
- Atualizar os casos atuais que esperam `points: 1` → `points: 10`.

## 10. Acceptance criteria
- `scorePrediction` retorna exatamente a tabela §6; nenhum caminho retorna `1`.
- `partial`/5 só emitido com vencedor real acertado sem placar exato.
- `ScorePredictionResult.points` é `0 | 5 | 10`; projeto compila (`tsc`) sem erro
  novo em `src/`.
- Suíte `predictionsHelpers.test.ts` verde, com a tabela-verdade ponderada.
- Nenhum arquivo fora do §5 alterado.
- `derivePredictionDisplayStatus` runtime inalterado (regressão visual de
  `partial→errou` é esperada e coberta na TASK-04).

## 11. Constraints
- Regra **exclusivamente** em `scorePrediction` — nenhum consumidor deriva
  vencedor.
- Derivar vencedor por sinal de `home − away`, não por campo inexistente.
- Função pura, sem `new Date()` interno, idempotente.
- Não ampliar escopo p/ recalc/UI/schema.

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: função pura de domínio (cálculo de pontuação) + testes unitários. Sem
  tela, componente ou interação.

## 14. Open questions
- **`partial → "errou"` temporário:** `derivePredictionDisplayStatus` mapeia
  `status === "correct" ? "acertou" : "errou"`, então `partial` exibirá "errou"
  na Lista de Palpites entre o merge desta task e a TASK-04. Decisão: **aceitar**
  a degradação temporária (TASK-04 introduz a badge "acertou o vencedor"). Não
  antecipar a correção aqui — mantém o escopo cirúrgico e a ordem do plano.
