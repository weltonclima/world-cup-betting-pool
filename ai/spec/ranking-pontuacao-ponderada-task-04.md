# SPEC

## 1. Task id and title
- Task: TASK-04
- Title: Badge do 3º estado ("Acertou o vencedor" +5) na lista de palpites

## 2. Objective
Expor o estado `partial` de `scorePrediction` (TASK-02) ao usuário na Lista de
Palpites com um badge próprio, sem quebrar os badges existentes, o filtro de
chips, nem a semântica de streak. Hoje `derivePredictionDisplayStatus` colapsa
`partial` em `"errou"` (linha `status === "correct" ? "acertou" : "errou"`) —
isso passa a ser um 3º estado visível: **"Acertou o vencedor" (+5)**.

## 3. In scope
1. **`PredictionDisplayStatus`** (`predictionsHelpers.ts`): adicionar o valor
   `"acertou_vencedor"` à união (5 valores no total).
2. **`derivePredictionDisplayStatus`** (`predictionsHelpers.ts`): quando
   `match.status === "finished"`, mapear o `status` de `scorePrediction`:
   - `"correct"` → `"acertou"`
   - `"partial"` → `"acertou_vencedor"`
   - resto (`"wrong"`) → `"errou"`
   Manter a precedência atual (finished > lock > pending) intacta.
3. **`predictionLabels.ts`**: adicionar `acertou_vencedor` a
   `PREDICTION_DISPLAY_STATUS_LABEL` (rótulo `"Acertou o vencedor"`) e a
   `PREDICTION_DISPLAY_STATUS_COLOR` (cor intermediária distinta — ver §6).
4. **`PredictionListCard.tsx`**: adicionar `acertou_vencedor` ao mapa
   `STATUS_ICONS` (ícone `Trophy` da lucide-react, `size={12}`,
   `aria-hidden="true"`).
5. **`PredictionFilters.tsx`**: adicionar o chip de filtro
   `{ value: "acertou_vencedor", label: "Vencedor" }` ao array `CHIPS` (após
   "Acertos") e incluir `"acertou_vencedor"` na validação de `readStoredFilter`.

## 4. Out of scope
- **Não** alterar `scorePrediction` nem qualquer lógica de pontuação (TASK-02).
- **Não** tocar `recalc.ts`, `accuracy`, `longestStreak` ou qualquer agregação
  de ranking (TASK-03) — `partial` já está corretamente fora de streak/accuracy.
- **Não** alterar `predictionStatusSchema`/`predictionSchema` (TASK-01 — o estado
  `partial` já existe no domínio).
- **Não** propagar `avatarUrl` nem mexer em qualquer componente de ranking
  (TASK-05/06/07).
- **Não** mudar a lógica de filtragem em `usePredictionsList` (o tipo da união já
  flui; nenhuma mudança de código no hook).
- **Não** alterar o comportamento de `pendente`/`bloqueado`/`acertou`/`errou`.

## 5. Main technical areas involved
- `src/features/predictions/lib/predictionsHelpers.ts` — tipo
  `PredictionDisplayStatus` + `derivePredictionDisplayStatus`.
- `src/features/predictions/lib/predictionLabels.ts` — LABEL + COLOR.
- `src/features/predictions/components/PredictionListCard.tsx` — `STATUS_ICONS`.
- `src/features/predictions/components/PredictionFilters.tsx` — `CHIPS` +
  `readStoredFilter`.
- Testes correspondentes em
  `src/features/predictions/lib/__tests__/` e
  `src/features/predictions/components/__tests__/` (se existirem).

## 6. Business rules and behavior
- **Mapeamento do novo estado:** `partial` (acertou o vencedor real sem placar
  exato, +5) → display `"acertou_vencedor"`. Só ocorre em jogo `finished`.
- **Precedência inalterada:** `finished` ainda tem prioridade sobre `lock`;
  `lock` sobre `pending`. O novo estado só surge dentro do ramo `finished`.
- **Exhaustiveness:** todos os `Record<PredictionDisplayStatus, …>`
  (LABEL, COLOR, STATUS_ICONS) DEVEM ganhar a chave `acertou_vencedor` — o tipo
  `Record` força o erro de compilação se faltar; nenhum cai em `default`.
- **Cor (decisão inline, sem ui-spec):** `acertou_vencedor` usa uma cor
  intermediária distinta de `acertou` (verde/`win`), `errou` (vermelho/`loss`) e
  `pendente` (âmbar — já ocupado). Token escolhido: **lime**
  `"bg-lime-500/20 text-lime-700 dark:text-lime-400"` — lê como "quase vitória",
  família verde mas distinta do verde de vitória plena. (ui-spec, se rodado
  depois, pode refinar a tonalidade; o contrato é "intermediária + distinta".)
- **Rótulo:** `"Acertou o vencedor"` no badge; chip de filtro abreviado:
  `"Vencedor"`.
- **Filtro:** chip single-select com `value: "acertou_vencedor"`; a lista filtra
  por igualdade de `displayStatus` (mecânica de filtro já existente — só entra um
  valor novo no domínio). `readStoredFilter` deve aceitar o novo valor para
  persistência em localStorage.

## 7. Contracts and interfaces
- `PredictionDisplayStatus = "pendente" | "acertou" | "acertou_vencedor" |
  "errou" | "bloqueado"`.
- `derivePredictionDisplayStatus(prediction, match, now): PredictionDisplayStatus`
  — assinatura inalterada; só amplia o conjunto de retornos possíveis.
- `FilterChip = "todos" | PredictionDisplayStatus` — inalterado (herda o novo
  valor automaticamente).
- Nenhum schema Zod, endpoint, evento ou persistência Firestore muda. O badge é
  derivado client-side; nada novo é gravado.

## 8. Data and persistence impact
- Nenhum. `displayStatus` é derivado em runtime no client; não é persistido.
  `localStorage["predictions_filter"]` pode passar a guardar
  `"acertou_vencedor"` — chave já existente, valor aditivo, retrocompatível
  (valores antigos continuam válidos).

## 9. Required tests
TDD recomendado (mapeamento condicional de novo estado + exhaustiveness):
- **`derivePredictionDisplayStatus`:**
  - jogo `finished` + palpite `partial` (vencedor certo, placar errado, ex.:
    palpite 1×0 num jogo 2×0) → `"acertou_vencedor"`.
  - jogo `finished` + placar exato → `"acertou"` (regressão — segue igual).
  - jogo `finished` + vencedor errado → `"errou"` (regressão).
  - jogo `finished` + empate inexato previsto → `"errou"` (D1; `wrong`).
  - jogo bloqueado não-finished → `"bloqueado"` (precedência inalterada).
  - jogo agendado aberto → `"pendente"`.
- **Exhaustiveness dos mapas:** assert que `PREDICTION_DISPLAY_STATUS_LABEL`,
  `PREDICTION_DISPLAY_STATUS_COLOR` e `STATUS_ICONS` têm a chave
  `acertou_vencedor` com valor não-vazio (cobertura dos 5 estados).
- **Filtro:** `readStoredFilter` retorna `"acertou_vencedor"` quando o
  localStorage contém esse valor; `CHIPS` inclui o chip `Vencedor`.

## 10. Acceptance criteria
- `partial` aparece como badge "Acertou o vencedor" (cor lime distinta + ícone
  Trophy) na Lista de Palpites; nunca mais colapsa em "Errou".
- Os 5 estados de `PredictionDisplayStatus` têm label, cor e ícone — `tsc` sem
  erro novo em `src/` (a exaustividade dos `Record` garante).
- Chip "Vencedor" filtra exatamente os palpites `acertou_vencedor`; persistência
  em localStorage funciona para o novo valor.
- Badges/filtros existentes (acertou/errou/pendente/bloqueado) inalterados.
- Streak/accuracy/ranking não tocados (fora de escopo, já corretos).
- Suíte de predictions verde.

## 11. Constraints
- Apenas os 5 arquivos do §5. Nenhuma mudança em domínio de pontuação,
  agregação, schema ou ranking.
- Reusar tokens/padrões existentes (mesma estrutura de badge/chip); cor
  intermediária sem hex cru — usar escala Tailwind (`lime-*`), como os demais.
- Manter acessibilidade já presente: ícone `aria-hidden`, `aria-pressed` no chip,
  `min-h-[44px]` (WCAG 2.5.5).
- Não introduzir `default`/cast que burle a exaustividade do `Record`.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: altera componentes de UI (`PredictionListCard`, `PredictionFilters`) —
  badge visual + chip de filtro na Lista de Palpites. (No fluxo atual, por
  instrução do usuário, `/ui-spec` e `/ui-review` foram omitidos; a decisão de
  cor está cravada no §6.)

## 14. Open questions
- Nenhuma bloqueante. A tonalidade exata da cor (lime vs. teal vs. âmbar-verde)
  é a única decisão estética aberta — resolvida inline como `lime` no §6; um
  `/ui-review` posterior poderia refiná-la sem mudar o contrato.
