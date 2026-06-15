# PRD — Regra de Empate Parcial na Pontuação

## 1. Feature summary

Adicionar uma nova regra de pontuação: quando o usuário apostou em empate (qualquer placar onde `homeScore === awayScore`) e o jogo terminou empatado (com placar diferente do apostado), o usuário ganha **5 pontos** (`partial`). Hoje esse caso retorna `wrong` (0 pts). As demais regras não mudam.

Tabela completa pós-feature:

| Situação                                          | Status     | Pontos |
|---------------------------------------------------|------------|--------|
| Placar exato acertado                             | `correct`  | 10     |
| Acertou o vencedor (não-empate), placar errado    | `partial`  | 5      |
| Apostou empate + jogo empatou, placar errado      | `partial`  | 5      |
| Apostou empate + jogo teve vencedor              | `wrong`    | 0      |
| Apostou vencedor + jogo empatou                  | `wrong`    | 0      |
| Placar totalmente errado                          | `wrong`    | 0      |
| Jogo não finalizado                               | `pending`  | 0      |

## 2. Consolidated scope

**In scope:**
- Alterar `scorePrediction` (`src/features/predictions/lib/predictionsHelpers.ts`) para retornar `partial (5)` quando `matchSign === 0 && predictionSign === 0` e o placar não é exato.
- Atualizar testes unitários de `scorePrediction` (2 casos que mudam de `wrong` → `partial`).
- Decidir e implementar o label de display para o novo caso `partial` de empate — novo valor `"acertou_empate"` em `PredictionDisplayStatus` ou reusar `"acertou_vencedor"`.
- Atualizar `derivePredictionDisplayStatus` e seus testes conforme decisão do label.
- Atualizar comentários inline que descrevem a regra D1 (hoje documentam "empate previsto = 0").
- Nenhuma migração de dados no Firestore — o recalc (`recalcRankings`) já recomputa do zero via `scorePrediction`; rodar o recalc após o deploy recalcula todos os pontos historicamente corretos.

**Out of scope:**
- Regras de pontuação para fases eliminatórias (prorrogação, pênaltis).
- Qualquer mudança na estrutura de dados do Firestore.
- Alterações no schema Zod de `Prediction` ou `Match`.

## 3. System understanding relevant to this feature

### Função central
`scorePrediction(prediction, match): ScorePredictionResult` em `src/features/predictions/lib/predictionsHelpers.ts` (linha 116–147). Função pura, testável em isolamento. O único ponto de mudança de lógica.

### Linha crítica atual (linha 141–143)
```ts
const matchSign = Math.sign(match.homeScore - match.awayScore); // 0 = empate
const predictionSign = Math.sign(prediction.homeScore - prediction.awayScore);
if (matchSign !== 0 && predictionSign === matchSign) {  // <-- exclui empates explicitamente
  return { status: "partial", points: 5 };
}
```
A remoção de `matchSign !== 0 &&` é a mudança mínima suficiente para implementar a nova regra (o caso exato já foi capturado antes e retorna `correct`).

### Tipo `ScorePredictionResult`
`status: "correct" | "partial" | "wrong" | "pending"` — o status `partial` já existe, não precisa de novo valor de status de pontuação.

### Tipo `PredictionDisplayStatus`
`"pendente" | "acertou" | "acertou_vencedor" | "errou" | "bloqueado"` — hoje `partial` → `"acertou_vencedor"`. A nova regra produz `partial` para um caso semanticamente diferente (empate, não vencedor). É uma decisão de produto/UX se reusar `"acertou_vencedor"` ou criar `"acertou_empate"`.

### Pipeline de recalc
`recalcRankings` e `recalcPoolRanking` (`src/server/rankings/recalc.ts`) recomputam do zero via `scorePrediction` — não dependem dos campos `status/points` persistidos nos docs `predictions`. Um único `POST /api/rankings/recalc` após o deploy republica todos os rankings com os pontos corretos. Nenhum script de migração necessário.

### Testes impactados
`src/features/predictions/lib/__tests__/predictionsHelpers.test.ts`:
- Linha 252–255: `"D1: empate previsto + empate real inexato (1×1 previsto, 2×2 real) → wrong"` → passa a ser `partial (5)`.
- Linha 346: `"D1: empate previsto + jogo decidido → 'errou'"` — permanece `wrong` (game não empatou).
- Labels do `derivePredictionDisplayStatus` para o novo `partial` de empate dependem da decisão de UX.

## 4. Technical impact analysis

| Área | Impacto |
|---|---|
| `scorePrediction` | 1 condição alterada (remoção de `matchSign !== 0 &&`) |
| `PredictionDisplayStatus` | Possível novo valor `"acertou_empate"` (ou reuso de `"acertou_vencedor"`) |
| `derivePredictionDisplayStatus` | 1 branch adicional se novo label criado |
| Testes unitários | ~3–5 casos alterados/adicionados |
| Comentários inline | Atualizar JSDoc da `scorePrediction` e descrição D1 |
| Firestore `predictions` docs | Nenhuma mudança de schema; campos `status/points` persistidos ficam stale até recalc |
| Rankings/estatísticas | Recalc post-deploy recomputa tudo corretamente |
| UI de palpites (badges) | Necessita novo badge/label se `"acertou_empate"` criado |
| `recalc.ts` | Sem mudança de lógica — já usa `scorePrediction` como oracle |
| APIs de pontuação (`/api/predictions/score`) | Sem mudança de contrato — `status/points` são campos internos |

**Tamanho:** Mudança mínima e localizada. Risco de regressão baixo, desde que coberta por TDD.

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Docs `predictions` com `status/points` stale após deploy | Médio | Rodar `POST /api/rankings/recalc` imediatamente após deploy. O recalc ignora o campo persistido e recomputa. |
| Esquecer de atualizar testes D1 que agora mudam de `wrong` → `partial` | Baixo | TDD RED obrigatório antes de alterar `scorePrediction`. |
| Reusar `"acertou_vencedor"` para empate pode confundir usuário | Baixo | Decisão documentada no PRD; UI pode mostrar o mesmo badge com lógica clara. |
| Phases eliminatórias com empate no tempo regulamentar | Informação ausente | Consultar requisito: a regra nova se aplica a jogos de mata-mata que terminam empatados no tempo regulamentar? Copa do Mundo tem prorrogação/pênaltis — isso muda o placar final registrado. |

## 6. Ambiguities and gaps

1. **~~Label de display~~ RESOLVIDO:** criar novo valor `"acertou_empate"` em `PredictionDisplayStatus` (Opção 2). Requer badge/label próprio na UI.

2. **~~Fases eliminatórias~~ RESOLVIDO:** regra aplica em **todas as fases**, usando o placar final registrado (`homeScore`/`awayScore`). `scorePrediction` é phase-agnóstico — pontua pelo placar armazenado, independente de prorrogação/pênaltis. Se o placar final registrado for empate, a regra se aplica.

3. **Retroatividade:** espera-se que o recalc seja acionado manualmente pelo super_admin logo após o deploy, ou há um processo automático? O `dirty-by-finish` (`ensureRankingsFresh`) só recomputa quando a assinatura dos finalizados muda (novo jogo finaliza ou placar corrigido) — **não** recomputa se só a regra mudou. O super_admin deve acionar `POST /api/rankings/recalc` explicitamente.

## 7. Recommended implementation concerns

- **TDD obrigatório**: `scorePrediction` tem regras de negócio exatas e é regression-sensitive. Escrever os testes RED antes de qualquer mudança no `src`.
- **Operação pós-deploy**: documentar no release que o super_admin deve acionar o recalc manual após o deploy para republicar rankings com a nova regra aplicada a jogos já finalizados.
- **Decidir label antes de spec**: a decisão entre `"acertou_vencedor"` e `"acertou_empate"` afeta `PredictionDisplayStatus`, `derivePredictionDisplayStatus`, e possivelmente a UI de badges — deve ser resolvida no checkpoint do PRD, antes de `/spec`.
- **Custo pequeno**: 1 função pura, 1 tipo, ~5 testes. Planejamento de 1–2 tasks é suficiente.
