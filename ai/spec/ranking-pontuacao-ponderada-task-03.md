# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Recalc ponderado — separar pontos ponderados × acertos exatos (TDD)

## 2. Objective
Fazer o recalc somar **pontos ponderados** (5/10) no que é "pontuação"
(ranking geral/fase/grupo/pool, `highest/lowest/averagePoints`) enquanto
**`accuracy`, `longestStreak`, `distribution`, `wrong`, `correctByStage` e
`*.totalCorrect` continuam refletindo acertos EXATOS** (`status === "correct"`),
sem regressão semântica (D2/R3/R4). Hoje, sob binário, `points === acertos
exatos`, então uma única contagem servia aos dois propósitos; com a regra
ponderada (TASK-02) os dois se separam e o recalc precisa carregar **dois
acumuladores** por escopo.

## 3. In scope
Arquivo principal: `src/server/rankings/recalc.ts`.

### 3.1 Acumulador `UserAgg` — separar pontos × exatos
Para cada escopo (geral, fase, grupo) passar a manter **dois** números:
- `points*` (ponderado) = soma de `points` de `scorePrediction` (5/10).
- `correct*` (exato) = contagem de `status === "correct"`.

Mudanças concretas em `UserAgg`:
- `pointsGeral: number` — **mantém** (agora soma ponderada).
- adicionar `correctGeral: number` — contagem de exatos no geral.
- `byStageScope: Map<…, { points: number; wrong: number }>` →
  `{ points: number; correct: number; wrong: number }`.
- `byGroup: Map<string, { points: number; wrong: number }>` →
  `{ points: number; correct: number; wrong: number }`.
- `correctByStage: Partial<Record<Stage, number>>` — **mantém o nome e o tipo**,
  mas passa a acumular **contagem de exatos** (hoje acumula `points`, linha
  170–171 — bug latente que só não aparece porque binário `points === count`).
- `finishedPreds[].correct` — **mantém** `status === "correct"` (streak = só
  placar exato, D3).

### 3.2 Laço de agregação (§4 do arquivo, ~linhas 152–189)
- `agg.pointsGeral += points;` — mantém (ponderado).
- `if (status === "correct") agg.correctGeral += 1;` — novo.
- `if (status === "correct") agg.correctByStage[match.stage] = (… ?? 0) + 1;`
  — trocar a condição `points > 0` por `status === "correct"` e somar **1**
  (não `points`). `partial` (5 pts) **não** entra em `correctByStage`.
- `if (status === "wrong") agg.wrongGeral += 1;` — mantém (R4: `partial` não é
  wrong).
- Nos blocos `byStageScope` e `byGroup`: somar `cur.points += points` (ponderado)
  **e** `if (status === "correct") cur.correct += 1`; `wrong` igual ao atual.

### 3.3 Accuracy — alimentar de exatos, não de pontos
`computeAccuracy(...)` deve receber a **contagem de exatos** do escopo, nunca os
pontos ponderados:
- Ranking geral (linha ~215): `computeAccuracy(a.correctGeral, finishedGeral)`.
- Fase (linha ~276): `computeAccuracy(a.correct, denom)` (do bucket de fase).
- Grupo (linha ~299): `computeAccuracy(a.correct, denom)` (do bucket de grupo).
- Statistics (linha ~353): `computeAccuracy(a.correctGeral, finishedGeral)`.
- Atualizar a doc-string de `computeAccuracy` em
  `src/features/rankings/lib/accuracy.ts`: remover "Sob binário, `points` ===
  acertos exatos"; deixar claro que o 1º argumento é **acertos exatos**, nunca
  pontos ponderados.

### 3.4 `RankableParticipant.points` (ranking) carrega ponderado
- Geral/fase/grupo/pool: o campo `points` passado a `rankParticipants`/`toEntry`
  segue sendo o **ponderado** (`a.pointsGeral` / `bucket.points`). O ranking
  ordena por pontos ponderados — comportamento desejado. `accuracy` do
  participante vem de `correct*` (3.3). `wrong` segue `status === "wrong"`.
- Pool herda de `geralParticipants` (já reusa o mesmo objeto) — nenhuma mudança
  extra além de `geralParticipants` já carregar `points` ponderado + `accuracy`
  de exatos.

### 3.5 Statistics por usuário (§8 do arquivo, ~linha 348)
- `totalCorrect: a.correctGeral` — **exatos** (campo se chama `totalCorrect`;
  não vira pontos). **Troca** de `a.pointsGeral` → `a.correctGeral`.
- `totalWrong: a.wrongGeral` — mantém.
- `accuracy: computeAccuracy(a.correctGeral, finishedGeral)` — exatos.
- `longestStreak: longestStreak(a.finishedPreds)` — mantém (já é só correct).
- `correctByStage: a.correctByStage` — mantém (agora contagem de exatos, 3.1).

### 3.6 Pool stats (§9 do arquivo, ~linhas 364–380) — D2
Distinção explícita pontos × exatos:
- `highestPoints` / `lowestPoints` / `averagePoints` → **ponderados** (lista de
  `a.pointsGeral`). Mantêm o nome "Points".
- `totalCorrect` → **exatos**: somatório de `a.correctGeral` (não de pontos).
  **Troca**: hoje `totalCorrect = soma(pointsList)`; passa a somar a lista de
  exatos.
- `distribution: buildDistribution(<lista de exatos>, finishedGeral)` →
  **exatos** (D2). Trocar o 1º argumento de `pointsList` (ponderado) para a
  lista de `correctGeral`.
- Documentar no objeto `poolStats` / comentário a fonte de cada campo
  (ponderado vs exato).

### 3.7 Comentários obsoletos
- `src/features/rankings/lib/rankingSort.ts`: o comentário "`points === acertos
  exatos (binário)`" e o head-comment "Sob pontuação binária `points === acertos
  exatos`" ficam obsoletos. Atualizar para: `points` = **pontos ponderados**;
  o desempate do PRD "mais acertos exatos" deixa de ser redundante com "maior
  pontuação", mas **não** se adiciona um critério novo nesta task — registrar que
  `accuracy DESC` (mesmo denominador no escopo) já desempata por exatos. **Sem
  mudança de assinatura/comportamento de `compareRanking`/`rankParticipants`.**

### 3.8 Migração de testes (R5)
Migrar `src/app/api/rankings/recalc/__tests__/route.test.ts` para a semântica
ponderada (valores esperados abaixo, §9) e **adicionar** casos `partial`.

## 4. Out of scope
- **Não** alterar `scorePrediction` (TASK-02, já concluída).
- **Não** alterar a assinatura nem a lógica de ordenação de `compareRanking` /
  `rankParticipants` (só comentário — 3.7). Não adicionar novo critério de
  desempate.
- **Não** mudar `buildDistribution`, `computeAccuracy` (corpo) — só os
  **call-sites** e as doc-strings; a aritmética interna fica.
- **Não** mexer em `predictionSchema`, `predictionStatusSchema`,
  `predictionsHelpers.ts`.
- **Não** propagar `avatarUrl` nem tocar `toEntry`/`rankingEntrySchema` (TASK-05).
- **Não** mudar `positionHistory`, auth, exclusão de não-aprovados, limpeza de
  pools órfãos, denominadores de fase/grupo, `firstPredictionAt`.
- **Não** renomear campos persistidos (`totalCorrect`, `correctByStage`,
  `highestPoints`, etc.) — só trocar a **fonte** que os alimenta.

## 5. Main technical areas involved
- `src/server/rankings/recalc.ts` — `UserAgg`, `emptyAgg`, laço de agregação,
  geral/fase/grupo/pool, statistics, pool_stats.
- `src/features/rankings/lib/accuracy.ts` — doc-string (sem mudar corpo).
- `src/features/rankings/lib/rankingSort.ts` — comentários (sem mudar corpo).
- `src/app/api/rankings/recalc/__tests__/route.test.ts` — migração + casos
  `partial`.

## 6. Business rules and behavior
Tabela **campo → fonte** (trava nos testes — invariante central da task):

| Campo de saída | Fonte | Inclui `partial`? |
|---|---|---|
| `rankings/*.entries[].points` (geral, fase, grupo, pool) | **ponderado** (5/10) | sim (+5) |
| `rankings/*.entries[].accuracy` | **exato** (correct/finished) | não |
| `rankings/*.entries[].wrong` | `status === "wrong"` | não (partial ≠ wrong) |
| `statistics.totalCorrect` | **exato** | não |
| `statistics.totalWrong` | `status === "wrong"` | não |
| `statistics.accuracy` | **exato** | não |
| `statistics.longestStreak` | **exato** (`finishedPreds.correct`) | não |
| `statistics.correctByStage[stage]` | **exato** (contagem, +1) | não |
| `pool_stats.highestPoints / lowestPoints / averagePoints` | **ponderado** | sim |
| `pool_stats.totalCorrect` | **exato** | não |
| `pool_stats.distribution` | **exato** | não |

Invariantes:
- `partial` (5 pts) soma a `points*`/`highest/avg/lowestPoints`, **não** soma a
  `correct*`, `accuracy`, `streak`, `wrong`, `correctByStage`, `totalCorrect`,
  `distribution`.
- `correct` (10 pts) soma aos dois lados.
- `wrong`/`pending` não somam a nada de pontos nem de exatos; `wrong` conta em
  `wrong*`/`totalWrong`.
- Piso 0; idempotente; função pura de pontuação.

## 7. Contracts and interfaces
- Nenhum schema Zod muda. `RankingEntry` inalterado (points segue `int().min(0)`,
  agora ponderado). `statistics`/`pool_stats` mesmos campos, fontes trocadas.
- `RankableParticipant` inalterado (campo `points` agora carrega ponderado —
  atualizar só o comentário do campo).
- Assinaturas de `computeAccuracy`, `buildDistribution`, `compareRanking`,
  `rankParticipants`, `recalcRankings` — inalteradas.

## 8. Data and persistence impact
- Nenhuma migração de dados. O recalc reconstrói tudo do zero (D5 retroativo de
  graça): ao rodar, os docs de ranking/statistics/pool_stats passam a refletir a
  nova semântica. Docs legados de palpite (`points: 1`) seguem lidos (R1) e são
  re-pontuados internamente por `scorePrediction` — os `points` persistidos do
  palpite **não** são usados no recalc (já era assim).
- `correctByStage` legado podia conter valores = pontos antigos; o recalc
  sobrescreve (`set merge`) com a contagem de exatos correta no próximo run.

## 9. Required tests
TDD **obrigatório** (agregação com invariantes). Migrar
`recalc/__tests__/route.test.ts`:

**Valores migrados (fixtures atuais — u1: 2 exatos; u2: 1 wrong):**
- `rankings/geral` u1.points: `2` → **20** (ponderado); u1.accuracy: **100**
  (2/2 exatos, inalterado); u2.points: **0**; u2.wrong: **1**.
- `rankings/oitavas` u1.points: `1` → **10**.
- `rankings/grupo-A` u1.points: `1` → **10**.
- `statistics/u1` totalCorrect: **2** (exato, inalterado); correctByStage
  grupos: **1**, oitavas: **1** (exato, inalterado — agora por condição
  `correct`, não por `points`); accuracy implícita 100.
- `pool_stats/current` highestPoints: `2` → **20** (ponderado); lowestPoints:
  **0**; totalCorrect: **2** (exato); distribution: bucket "0-39 pts" conta os 2
  participantes (exatos 2 e 0 caem na 1ª faixa).

**Novos casos `partial` (adicionar fixture com vencedor certo / placar errado):**
- Um palpite `partial` (ex.: palpite 1×0 num jogo 2×0) soma **+5** a
  `points` (geral/fase/grupo correspondente) e a `highest/averagePoints`.
- O mesmo `partial` **não** incrementa `accuracy`, `correctByStage`,
  `totalCorrect`, `longestStreak`, `wrong`, nem move a `distribution` de exatos.
- Invariante explícita: usuário só com `partial` tem `points > 0` mas
  `accuracy === 0` e `totalCorrect === 0`.
- Streak: sequência `correct, partial, correct` → `longestStreak === 1` (o
  `partial` quebra a sequência de exatos, D3).

Idempotência: manter o teste existente (duas execuções → mesmos entries).

## 10. Acceptance criteria
- Tabela §6 satisfeita exatamente; nenhum campo "exato" contaminado por pontos
  ponderados e vice-versa.
- `partial` soma a pontos, nunca a exatos/accuracy/streak/wrong/distribution.
- `tsc` sem erro novo em `src/`; suíte `recalc/route.test.ts` verde com a
  semântica ponderada + casos `partial`.
- Nenhum arquivo fora do §5 alterado; nenhuma assinatura de função alterada.
- Recalc permanece idempotente e puro.

## 11. Constraints
- Dois acumuladores por escopo — nunca derivar exato de ponderado por divisão
  (10→1, 5→0) por atalho; contar `status === "correct"` diretamente.
- Não ampliar escopo para avatarUrl/UI/schema.
- Preservar toda a mecânica já existente (auth, pools órfãos, positionHistory,
  denominadores, firstPredictionAt).
- Comentários atualizados onde a semântica binária ficou obsoleta (3.3, 3.7).

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: agregação de domínio server-side (recalc) + testes de Route Handler.
  Sem tela, componente ou interação.

## 14. Open questions
- Nenhuma bloqueante. Decisões D2/R3/R4 já travadas na PRD/plano: `distribution`
  e `totalCorrect` seguem exatos; `highest/avg/lowestPoints` seguem ponderados.
  A tabela §6 é a fonte de verdade e está cravada nos testes.
