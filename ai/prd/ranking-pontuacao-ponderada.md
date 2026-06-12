# PRD — Pontuação ponderada do ranking + redesign do pódio

## 1. Feature summary

Dois eixos independentes no domínio de ranking:

**A. Regra de pontuação ponderada.** Substituir a pontuação **binária** atual
(placar exato = 1 ponto, senão 0) por uma regra de **dois critérios**:

| Resultado do palpite | Pontos |
|---|---|
| Acertou o placar exato | **10** |
| Errou o placar, mas acertou o time vencedor | **5** |
| Errou o vencedor (ou empate não previsto) | **0** |

**B. Redesign do pódio (top 3) na tela de ranking.** Cards das posições 1/2/3
menores, sem scroll horizontal, com **foto de perfil** no avatar (hoje só
iniciais) e **detalhamento** que torne 2º e 3º distinguíveis (hoje só nome +
pontos, sem indicação clara de posição).

Os dois eixos compartilham a tela de ranking mas são tecnicamente
independentes — A é regra de domínio + persistência, B é apresentação.

## 2. Consolidated scope

### A — Pontuação ponderada
- Reescrever `scorePrediction` (`features/predictions/lib/predictionsHelpers.ts`)
  para retornar `points ∈ {0, 5, 10}` derivando o vencedor a partir de
  `homeScore`/`awayScore` do palpite e da partida.
- Ampliar o contrato de `points`:
  - `predictionSchema.points`: `0 | 1` → aceitar `0 | 5 | 10` **e** os valores
    legados `1` para não invalidar docs já gravados (ver Risco R1).
  - `ScorePredictionResult.points`: `0 | 1` → `0 | 5 | 10`.
- Atualizar a agregação em `server/rankings/recalc.ts`, que **recomputa tudo do
  zero** via `scorePrediction` (não confia nos campos persistidos) — logo o
  ranking se auto-corrige no próximo recalc, sem migração de dados de ranking.
- Reavaliar as métricas derivadas que hoje misturam "pontos" com "acertos
  exatos": `accuracy`, `correctByStage`, `wrong`, `longestStreak`,
  `pool_stats`, distribuição.

### B — Redesign do pódio
- `RankingPodium` em `GeneralRanking.tsx`: cards menores, sem overflow
  horizontal, badge/medalha de posição visível em cada card (1º/2º/3º),
  detalhamento (pontos + aproveitamento + indicador de posição).
- Avatar com **foto real** (`user.avatarUrl`, data URL base64 — PRD-06)
  com fallback de iniciais. Exige propagar `avatarUrl` até a `RankingEntry`.

## 3. System understanding relevant to this feature

- **Pontuação (núcleo):** `scorePrediction(prediction, match)` — função pura,
  só pontua `match.status === "finished"`, retorna `{ status, points }`.
  `status ∈ "correct" | "wrong" | "pending"`. Único ponto de verdade da regra.
- **Recalc:** `recalcRankings(db)` lê palpites crus + partidas efetivas, pontua
  in-process via `scorePrediction` e grava `rankings/*`, `statistics/*`,
  `pool_stats/current`. Idempotente. Disparado best-effort no save de placar
  (`PUT /api/admin/matches/[id]`) e no cold-start (`ensureRankingsFresh`).
- **`/api/predictions/score`:** grava `{ status, points }` em cada doc de
  palpite via `scorePrediction`. **Não** alimenta o ranking (recalc ignora os
  campos persistidos) — serve só exibição na lista de palpites.
- **Contratos:**
  - `predictionSchema.points = z.literal(0).or(z.literal(1))` — **precisa mudar**.
  - `rankingEntrySchema.points = z.int().min(0)` — já aceita qualquer inteiro;
    o comentário "=== acertos exatos" fica **obsoleto** (passa a ser pontos
    ponderados).
  - `RankingEntry`: `{ uid, nickname, name?, position, points, wrong?, accuracy? }`
    — **sem** `avatarUrl`. Precisa ganhá-lo para B.
  - `userSchema.avatarUrl?: string` (data URL base64) — fonte da foto.
- **UI ranking:** `GeneralRanking.tsx` → `RankingPodium` (top 3, ordem visual
  2-1-3 via `order-*`, só `AvatarFallback` de iniciais, sem nº de posição
  visível) + `RankingRow` (lista paginada). Mesmo padrão de avatar/iniciais em
  `MyRanking`, `PhaseRanking`, `ParticipantProfile`.
- **Vencedor:** não existe campo "winner"; deriva-se de
  `homeScore`/`awayScore` (home > away, away > home, ou empate).

## 4. Technical impact analysis

**Módulos afetados**
- `features/predictions/lib/predictionsHelpers.ts` — `scorePrediction` (núcleo).
- `schemas/predictions.ts` — literal de `points`.
- `schemas/rankings.ts` — comentário/semântica de `points` (sem mudança de tipo).
- `server/rankings/recalc.ts` — agregação ponderada e métricas derivadas.
- `app/api/predictions/score/route.ts` — sem mudança de lógica (delega a
  `scorePrediction`), mas o tipo de `points` muda.
- `features/rankings/lib/*` — `accuracy`/`rankParticipants`/`distribution` se a
  semântica de aproveitamento mudar.
- `features/rankings/components/GeneralRanking.tsx` — pódio (B).
- `RankingEntry` type + `toEntry()` no recalc — propagar `avatarUrl`.

**Fluxos afetados**
- Save de placar → recalc → ranking (pontos passam a ser ponderados).
- Pontuação por fase / por grupo / pool — todos somam `points`, herdam o peso.
- Lista de palpites (badge "acertou/errou") — surge um 3º estado (acertou o
  vencedor) a decidir (ver Ambiguidade Q3).

**Contratos**
- `predictionSchema.points` muda de domínio (breaking se não acomodar legado).
- `RankingEntry` ganha `avatarUrl?` (aditivo, retrocompatível).

**Persistência**
- Sem migração de `rankings/*` (recalc reconstrói). Docs de palpite legados têm
  `points: 1` — o **schema de leitura** precisa continuar aceitando, senão o
  `safeParse` no recalc descarta o palpite (Risco R1).

**Performance / consistência**
- Sem novo custo: recalc já itera todos os palpites. Derivar vencedor é O(1).
- Propagar `avatarUrl` (base64) para `RankingEntry` aumenta o **tamanho do doc
  `rankings/*`** (N participantes × imagem base64). Risco de estourar o limite
  de 1 MB/doc do Firestore em pools grandes (Risco R2).

## 5. Risks

- **R1 — Schema rejeita pontos legados.** Estreitar `points` para `{0,5,10}`
  invalida docs gravados com `points: 1`; `safeParse` no recalc os **descarta
  silenciosamente** → ranking subnotifica. Mitigar aceitando `{0,1,5,10}` na
  leitura, ou re-rodar `/score` antes do deploy.
- **R2 — `avatarUrl` base64 no doc de ranking.** Inserir N imagens base64 em
  `rankings/{scope}` pode exceder 1 MB/doc e inflar o payload do GET. Mitigar:
  só propagar foto para o **top 3**, ou servir foto por endpoint separado /
  buscar no client por uid.
- **R3 — Semântica de "accuracy"/"correct" contaminada.** `accuracy`,
  `correctByStage`, `longestStreak`, distribuição e `pool_stats` hoje assumem
  "ponto = acerto exato". Com pesos, "X pontos" ≠ "X acertos". Sem separar
  conceitos, estatísticas e gráficos ficam enganosos (regressão semântica).
- **R4 — `status` insuficiente.** `"correct"|"wrong"` não representa o 5-pontos.
  Forçar 5 pontos com `status:"wrong"` quebra badges e `longestStreak`.
- **R5 — Regressão de testes.** Há suíte dedicada cravando `points ∈ {0,1}`
  (`predictions.test.ts`, `predictionsHelpers.test.ts`) — todas precisam migrar.
- **R6 — Empate.** A regra textual ("o time que você palpitou ganhou") não
  cobre palpite de empate. Decisão de produto pendente (Q1).

## 6. Decisões (travadas)

- **D1 — Empate = 0 (estrito).** Palpite de empate só pontua com **placar
  exato** (10). Qualquer empate inexato, ou vencedor errado, = **0**. O bônus de
  5 só existe quando há um vencedor real e o palpite acertou esse vencedor.
  Nunca há pontos negativos (piso 0).
- **D2 — Aproveitamento (`accuracy`) inalterado.** Continua sendo
  **% de placares exatos / jogos finalizados** (mesma semântica de hoje). Os
  pontos ponderados (0/5/10) são métrica **separada**. `accuracy`,
  distribuição e `pool_stats` não passam a refletir o peso.
- **D3 — Badge nova na lista de palpites.** Introduzir 3º estado visual
  **"acertou o vencedor" (+5)** além de "acertou"/"errou". Novo
  `status:"partial"` em `scorePrediction`/`predictionStatusSchema`, badge própria
  em `derivePredictionDisplayStatus`. **Não** conta para `longestStreak`
  (streak = só placares exatos).
- **D4 — Foto em todos os avatares.** Propagar `avatarUrl` para a lista inteira,
  não só o top 3. Mitigar R2 **reduzindo a resolução/qualidade** da imagem
  (re-encode/downscale) ao propagar para `RankingEntry`, mantendo o doc abaixo
  de 1 MB. Avaliar na implementação: downscale no recalc vs. servir thumbnail.
- **D5 — Retroativo = sim.** A nova regra recontabiliza **todo** o histórico no
  próximo recalc (pontos de jogos já finalizados mudam). Comportamento natural
  do recalc (reconstrói do zero) — nenhuma lógica extra de congelamento.
- **D6 — Detalhamento do card do pódio (aberto p/ ui-spec).** Indicador de
  posição visível (1º/2º/3º), foto, nome, pontos e aproveitamento. Layout final
  definido no `/ui-spec`.

## 7. Recommended implementation concerns

- Concentrar a regra **exclusivamente** em `scorePrediction` (única fonte) e
  cobrir com testes-tabela: exato, vencedor-certo, vencedor-errado, empate
  (todas as variações de Q1).
- Separar claramente **pontos ponderados** de **contagem de acertos exatos** no
  recalc para preservar a semântica de `accuracy`/distribuição (R3).
- Decidir o domínio de `points` no schema antes de mexer (R1) — preferir
  aceitar o legado na leitura.
- Tratar A (regra/domínio, TDD obrigatório) e B (UI, frontend/ui-spec) como
  tasks separadas no plano.
- Para B, propagar `avatarUrl` só onde o custo de payload é aceitável (R2/Q4).
