# PLAN — Pontuação ponderada do ranking + redesign do pódio

## 1. Planning summary

Dois eixos independentes da PRD `ranking-pontuacao-ponderada`:

- **Eixo A — regra de pontuação ponderada** (0/5/10) — núcleo de domínio +
  persistência + recálculo. Toca a única fonte de verdade (`scorePrediction`) e
  o agregador (`recalc.ts`). É a parte crítica e de maior risco: introduz um
  terceiro estado (`partial`) e força **separar pontos ponderados de acertos
  exatos** em todo o recalc para preservar a semântica de `accuracy` /
  `distribution` / `longestStreak` (D2/R3/R4).
- **Eixo B — redesign do pódio + foto real** — apresentação. Propaga
  `avatarUrl` até `RankingEntry` (com mitigação de payload — R2/D4) e redesenha
  os cards do top-3.

7 tasks, em 4 fases. A (TASK-01→04) e B (TASK-05→07) são tecnicamente
independentes; B só depende de A por ordem de edição do mesmo arquivo
(`recalc.ts`), não por lógica. TDD obrigatório nas tasks de regra (02, 03) e
recomendado nos contratos (01).

Decisões da PRD já travadas (D1–D6) — o plano não reabre nenhuma:
D1 empate=0 salvo placar exato · D2 accuracy permanece %exato · D3 novo estado
`partial`/badge "+5" fora do streak · D4 foto em todos os avatares + downscale
· D5 retroativo via recalc · D6 layout do card no `/ui-spec`.

**plan-checker:** agent `gsd-plan-checker` indisponível neste harness;
verificação goal-backward feita manualmente (cobertura §6). Cada requisito da
PRD mapeia a uma task.

## 2. Recommended execution phases

- **Fase 1 — Fundação (contratos):** TASK-01. Amplia status e domínio de
  `points` antes de qualquer comportamento. Tolera legado (R1).
- **Fase 2 — Regra de negócio (Eixo A):** TASK-02 (regra pura), TASK-03
  (recalc ponderado) — TDD. TASK-04 (badge do 3º estado na lista de palpites).
- **Fase 3 — Pódio + foto (Eixo B):** TASK-05 (propagar avatarUrl), TASK-06
  (redesign do pódio), TASK-07 (foto nos demais avatares de ranking).
- **Fase 4 — Validação e release:** coberta pelo `/flow` (test → review →
  local-env → release por task; validação cruzada no fim).

## 3. Tasks

### TASK-01 – Contratos: estado `partial` + domínio de `points` tolerante a legado
- **Type:** persistence (schema/contrato de domínio)
- **Goal:** preparar os contratos para a regra ponderada sem mudar
  comportamento ainda: adicionar o estado `partial` e ampliar o domínio de
  `points`, mantendo leitura de docs legados (`points: 1`).
- **Scope:**
  - `schemas/shared.ts` → `predictionStatusSchema`: adicionar `"partial"`
    (acertou o vencedor, +5). Documentar a semântica no enum.
  - `schemas/predictions.ts` → `predictionSchema.points`: de
    `z.literal(0).or(z.literal(1))` para aceitar **`{0,1,5,10}`** na leitura
    (R1 — `.strict()` + `safeParse` no recalc descartaria o doc se o valor não
    casasse; `1` legado precisa continuar válido até o próximo `/score`).
  - `features/predictions/lib/predictionsHelpers.ts` →
    `ScorePredictionResult`: `points: 0 | 1` → `0 | 5 | 10`; `status` ganha
    `"partial"`.
  - `schemas/rankings.ts` → atualizar o comentário obsoleto de `points`
    ("=== acertos exatos") para "pontos ponderados no escopo" (sem mudança de
    tipo: já é `z.int().min(0)`).
- **Main modules/files likely involved:** `src/schemas/shared.ts`,
  `src/schemas/predictions.ts`, `src/schemas/rankings.ts`,
  `src/features/predictions/lib/predictionsHelpers.ts`,
  `src/schemas/__tests__/predictions.test.ts` (R5 — assert que `5` e `10`
  passam e `1` legado ainda passa).
- **Dependencies:** nenhuma.
- **Story points:** 2
- **Criticality:** high (um erro aqui descarta palpites silenciosamente no
  recalc — R1)
- **Technical risk:** medium
- **Recommended TDD later:** yes (regra de validação — aceitar `{0,1,5,10}`,
  rejeitar fora do conjunto)
- **Execution cost:**
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- **Notes:** task de contrato pura, sem lógica de pontuação. Não tocar
  `scorePrediction` (fica na TASK-02). Mudar só tipos/enum/literais. `partial`
  ainda não é emitido por ninguém após esta task — só passa a existir no
  domínio.

### TASK-02 – Regra de pontuação ponderada em `scorePrediction` (TDD)
- **Type:** domain
- **Goal:** reescrever a única fonte de verdade da pontuação para retornar
  `points ∈ {0,5,10}` e `status ∈ {correct, partial, wrong, pending}` derivando
  o vencedor de `homeScore`/`awayScore`.
- **Scope:**
  - Reescrever `scorePrediction` (`predictionsHelpers.ts`):
    - `match.status !== "finished"` → `{ status: "pending", points: 0 }`.
    - placar exato → `{ status: "correct", points: 10 }`.
    - vencedor real acertado (sinal de `home−away` igual no palpite e na
      partida, **e** não é empate) → `{ status: "partial", points: 5 }`.
    - empate inexato, vencedor errado, ou scores null em `finished` →
      `{ status: "wrong", points: 0 }`.
  - **D1 (empate estrito):** palpite de empate só pontua com placar exato (10);
    qualquer outro empate previsto = 0. O +5 exige um vencedor real acertado.
  - Tabela-verdade de testes: exato (10); vencedor certo placar errado (5);
    vencedor errado (0); empate previsto + jogo decidido (0); empate previsto +
    empate real inexato (0); empate exato (10); `finished` com score null (0,
    `wrong`); não-`finished` (`pending`).
- **Main modules/files likely involved:**
  `src/features/predictions/lib/predictionsHelpers.ts`,
  `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts` (migrar a
  suíte que crava `points ∈ {0,1}` — R5).
- **Dependencies:** TASK-01 (tipos de `status`/`points`).
- **Story points:** 3
- **Criticality:** critical (núcleo — todo o ranking herda este resultado)
- **Technical risk:** high
- **Recommended TDD later:** yes (regra de cálculo/condicional — caso clássico
  da "TDD Decision Rule")
- **Execution cost:**
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- **Notes:** concentrar a regra **exclusivamente** aqui (nenhum consumidor
  deve recalcular vencedor). Derivar vencedor por sinal de `home−away` (O(1)),
  não por campo "winner" (não existe). Função pura, `now` nunca interno.

### TASK-03 – Recalc ponderado: separar pontos × acertos exatos (TDD)
- **Type:** domain (agregação) / application
- **Goal:** fazer o ranking somar **pontos ponderados** enquanto `accuracy`,
  `longestStreak`, `distribution`, `wrong` e `correctByStage` continuam
  refletindo **acertos exatos** (D2/R3/R4) — sem regressão semântica.
- **Scope (`server/rankings/recalc.ts`):**
  - No laço de agregação (`scorePrediction(pred, match)`): hoje `correct =
    status === "correct"` e `agg.pointsGeral += points`. Introduzir contagem
    **separada** de acertos exatos por escopo (geral/fase/grupo) além dos
    pontos ponderados:
    - `pointsGeral` (ranking) passa a acumular pontos ponderados (5/10).
    - novo acumulador `correctGeral` (e por fase/grupo) = nº de `status ===
      "correct"` — alimenta `accuracy`, `distribution`, `pool_stats.totalCorrect`
      e `correctByStage` (mantém "acertos exatos", D2).
    - `wrong` continua só `status === "wrong"` (R4: `partial` **não** é wrong;
      também **não** é exato → não entra em accuracy nem em streak).
    - `finishedPreds[].correct` (insumo de `longestStreak`) permanece
      `status === "correct"` (streak = só placar exato, D3).
  - `RankableParticipant.points` agora carrega **pontos ponderados** → o
    ranking ordena por pontos ponderados. `accuracy` passada ao
    `rankParticipants`/`toEntry` é computada de `correct*`, não de `points*`.
    Revisar `computeAccuracy(points, finished)` → passar a contagem de exatos,
    não pontos (`accuracy.ts` doc e call-sites).
  - `pool_stats`: `highestPoints`/`averagePoints`/`distribution` — decidir por
    D2: `totalCorrect` e `distribution` seguem exatos; `highest/averagePoints`
    passam a refletir pontos ponderados (são "pontos"). Documentar a distinção
    no doc.
  - `statistics/{uid}`: `totalCorrect` = exatos; manter. (campo já se chama
    `totalCorrect` — não renomear para pontos.)
- **Main modules/files likely involved:** `src/server/rankings/recalc.ts`,
  `src/features/rankings/lib/accuracy.ts`,
  `src/features/rankings/lib/rankingSort.ts` (comentário "points === acertos"
  fica obsoleto; avaliar se o critério de desempate "mais acertos exatos" deixa
  de ser redundante — sob pesos, `accuracy DESC` já desempata por exatos no
  mesmo denominador; documentar), `src/app/api/rankings/recalc/__tests__/`,
  testes de `accuracy`/`distribution`.
- **Dependencies:** TASK-02 (consome o novo retorno de `scorePrediction`).
- **Story points:** 5
- **Criticality:** critical
- **Technical risk:** high
- **Recommended TDD later:** yes (agregação com invariantes: pontos ≠ exatos;
  partial não conta em accuracy/streak/wrong)
- **Execution cost:**
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- **Notes:** task mais arriscada do plano. O recalc reconstrói do zero (D5
  retroativo "de graça"), mas a separação pontos × exatos atravessa geral,
  pools, 5 fases, grupos, statistics e pool_stats — fácil regredir um deles.
  Definir no spec uma tabela "campo → fonte (ponderado | exato)" e travá-la nos
  testes.

### TASK-04 – Badge do 3º estado ("Acertou o vencedor +5") na lista de palpites
- **Type:** application (frontend)
- **Goal:** expor o estado `partial` ao usuário com badge própria, sem quebrar
  os badges existentes nem o streak.
- **Scope:**
  - `derivePredictionDisplayStatus` (`predictionsHelpers.ts`): mapear
    `status === "partial"` → novo `PredictionDisplayStatus`
    (`"acertou_vencedor"`), mantendo a precedência atual (finished > lock >
    pending).
  - `PredictionDisplayStatus` ganha `"acertou_vencedor"`.
  - `predictionLabels.ts`: rótulo ("Acertou o vencedor" / "+5") e cor própria
    (`PREDICTION_DISPLAY_STATUS_LABEL` e `_COLOR`).
  - Atualizar consumidores que assumem 3 estados: `PredictionListCard.tsx`,
    `PredictionFilters.tsx`, `predictionLabels`, `usePredictionsList.ts` —
    garantir que o novo valor não caia em `default`/exhaustiveness.
- **Main modules/files likely involved:**
  `src/features/predictions/lib/predictionsHelpers.ts`,
  `src/features/predictions/lib/predictionLabels.ts`,
  `src/features/predictions/components/PredictionListCard.tsx`,
  `src/features/predictions/components/PredictionFilters.tsx`,
  `src/features/predictions/hooks/usePredictionsList.ts`, e os testes
  correspondentes em `__tests__`.
- **Dependencies:** TASK-02 (precisa do `status: "partial"`).
- **Story points:** 2
- **Criticality:** medium
- **Technical risk:** low
- **Recommended TDD later:** yes (mapeamento condicional do novo estado +
  exhaustiveness)
- **Execution cost:**
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** `is_frontend: true` → dispara `/ui-spec` + `/patterns:nextjs` +
  `/ui-review` no `/flow`. Reusar `bg-win/loss` tokens; cor intermediária para
  o +5 (ex.: âmbar/verde-claro) definida no ui-spec.

### TASK-05 – Propagar `avatarUrl` até `RankingEntry` (com mitigação de payload)
- **Type:** persistence / api
- **Goal:** levar a foto real (base64, PRD-06) até as entradas de ranking sem
  estourar o limite de 1 MB/doc do Firestore nem inflar o GET (R2/D4).
- **Scope:**
  - `schemas/rankings.ts` → `rankingEntrySchema`: adicionar
    `avatarUrl: z.string().optional()` (aditivo, retrocompatível). `RankingEntry`
    (type inferido) herda.
  - `server/rankings/recalc.ts` → `toEntry()`: ler `u.avatarUrl` do user e
    incluí-lo na entry.
  - **Mitigação R2/D4 (decidir no spec/implement):** opção preferida —
    **downscale/re-encode** da imagem ao propagar (reduzir resolução/qualidade
    p/ manter o doc < 1 MB). Alternativas a avaliar: propagar só ao top-3, ou
    servir thumbnail por endpoint/uid separado. Registrar a decisão e um guard
    de tamanho (truncar/omitir avatar se exceder orçamento por doc).
- **Main modules/files likely involved:** `src/schemas/rankings.ts`,
  `src/server/rankings/recalc.ts`, `src/types/rankings.ts` (inferido),
  possível util de downscale em `src/server/...` ou `src/lib/...`,
  `src/schemas/__tests__/rankings.test.ts`, testes do recalc.
- **Dependencies:** TASK-03 por ordem (mesmo `recalc.ts`/`toEntry`); sem
  dependência lógica com o Eixo A.
- **Story points:** 3
- **Criticality:** high (estouro de 1 MB derruba o `set` do doc de ranking)
- **Technical risk:** high
- **Recommended TDD later:** yes (guard de orçamento de tamanho — entrada
  grande deve degradar, não quebrar o doc)
- **Execution cost:**
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: opus/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** downscale de base64 em Node não tem `canvas` nativo — avaliar
  `sharp` (já no projeto?) vs. estratégia de thumbnail por endpoint. Se o custo
  for alto, fallback aceitável: propagar foto só ao top-3 (atende o redesign do
  pódio) e manter iniciais no resto, **mas D4 pede lista inteira** — confirmar
  no spec antes de estreitar.

### TASK-06 – Redesign do pódio (top-3) com foto e indicador de posição
- **Type:** application (frontend)
- **Goal:** cards do pódio menores, sem scroll horizontal, com foto real
  (fallback iniciais), medalha/badge de posição visível e detalhamento que
  torne 2º e 3º distinguíveis (D6/B).
- **Scope (`features/rankings/components/GeneralRanking.tsx`):**
  - `RankingPodium`: reduzir tamanho dos cards, garantir ausência de overflow
    horizontal (sem `gap` que force scroll; layout responsivo).
  - Avatar: usar `AvatarImage src={entry.avatarUrl}` + `AvatarFallback`
    (iniciais) — `AvatarImage` (Radix) já existe em `components/ui/avatar.tsx`.
  - Badge/medalha de posição (1º/2º/3º) visível em cada card.
  - Detalhamento: pontos (ponderados) + aproveitamento + indicador de posição.
  - Manter ordem visual 2-1-3 e a acessibilidade do `aria-label`.
- **Main modules/files likely involved:**
  `src/features/rankings/components/GeneralRanking.tsx`,
  `src/components/ui/avatar.tsx` (consumo), testes de componente do ranking.
- **Dependencies:** TASK-05 (precisa de `entry.avatarUrl`).
- **Story points:** 3
- **Criticality:** medium
- **Technical risk:** medium
- **Recommended TDD later:** no (apresentação pura; cobrir via `/ui-review` +
  teste de render leve)
- **Execution cost:**
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** `is_frontend: true` → `/ui-spec` (layout final do card, D6) +
  `/patterns:nextjs` + `/ui-review`. Pontos exibidos agora são ponderados —
  rótulo "pts" permanece coerente. Conferir contraste do card 1º (fundo
  `primary`) com a foto.

### TASK-07 – Foto real nos demais avatares de ranking
- **Type:** application (frontend)
- **Goal:** estender a foto real (D4 "lista inteira") aos avatares fora do
  pódio: linha da lista e telas correlatas que hoje só mostram iniciais.
- **Scope:**
  - `RankingRow` (em `GeneralRanking.tsx`): `AvatarImage src={entry.avatarUrl}`
    + fallback.
  - Mesmo padrão em `MyRanking`, `PhaseRanking`, `ParticipantProfile` (PRD cita
    o mesmo padrão de avatar/iniciais nesses pontos) — onde houver
    `RankingEntry`/uid com `avatarUrl` disponível.
- **Main modules/files likely involved:**
  `src/features/rankings/components/GeneralRanking.tsx` (RankingRow),
  `src/features/rankings/components/MyRanking*.tsx`,
  `PhaseRanking*.tsx`, `ParticipantProfile*.tsx` (confirmar nomes reais no
  spec), `src/components/ui/avatar.tsx`.
- **Dependencies:** TASK-05 (avatarUrl na entry). Independe de TASK-06.
- **Story points:** 2
- **Criticality:** low
- **Technical risk:** low
- **Recommended TDD later:** no (apresentação)
- **Execution cost:**
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** `is_frontend: true` → `/ui-spec` (pode reusar artefato do pódio) +
  `/ui-review`. Verificar que `avatarUrl` chega a cada superfície (algumas
  telas podem ler de outra fonte que não `RankingEntry` — confirmar no spec; se
  faltar, propagar no recalc correlato).

## 4. Dependency map

```
TASK-01 (contratos)
   └─> TASK-02 (scorePrediction)
          ├─> TASK-03 (recalc ponderado)
          │       └─(ordem, mesmo arquivo)─> TASK-05 (avatarUrl em RankingEntry)
          │                                       ├─> TASK-06 (pódio)
          │                                       └─> TASK-07 (demais avatares)
          └─> TASK-04 (badge 3º estado)
```

- A (01→02→03, +04) e B (05→06/07) são independentes em lógica.
- TASK-05 depende de TASK-03 **só por ordem** (ambas editam `recalc.ts`/
  `toEntry`) — evita conflito de merge. Se isoladas em worktrees, podem ir em
  paralelo e fazer merge sequencial.

## 5. Recommended execution order

1. **TASK-01** — contratos (fundação; destrava tudo, tolera legado R1)
2. **TASK-02** — regra ponderada (núcleo, TDD)
3. **TASK-03** — recalc ponderado (maior risco, TDD)
4. **TASK-04** — badge do 3º estado (fecha o Eixo A visível)
5. **TASK-05** — propagar avatarUrl (abre o Eixo B; mitigação R2)
6. **TASK-06** — redesign do pódio (ui-spec)
7. **TASK-07** — foto nos demais avatares

## 6. Planning risks and blockers

- **TASK-03 é o ponto crítico (R3/R4):** separar pontos ponderados de acertos
  exatos atravessa 6 superfícies de saída (geral/pools/fases/grupos/statistics/
  pool_stats). Mitigação: tabela "campo → fonte" travada em testes no spec.
- **TASK-05 (R2) tem incerteza técnica real:** downscale de base64 server-side
  depende de lib (`sharp`?) não confirmada. Bloqueio leve — decidir
  downscale vs. thumbnail-por-endpoint vs. top-3-only no `/spec`. D4 pede lista
  inteira; só estreitar com aprovação.
- **R1 (legado `points: 1`):** TASK-01 deve aceitar `{0,1,5,10}` na leitura
  **antes** de qualquer deploy de TASK-02/03, senão o recalc descarta palpites
  legados. Garantir essa ordem (01 antes de 02/03).
- **R5 (regressão de testes):** suítes `predictions.test.ts`,
  `predictionsHelpers.test.ts`, `rankings.test.ts`, e testes de recalc/standings
  cravam `points ∈ {0,1}` — migram dentro das respectivas tasks (01/02/03), não
  em task separada.
- **TDD obrigatório:** TASK-02 e TASK-03 (regra + agregação). Recomendado:
  TASK-01, TASK-04, TASK-05 (validação/guard). TASK-06/07 sem TDD (UI).
- **Cobertura de requisitos (goal-backward):** Eixo A regra → 01+02; recalc/
  métricas → 03; badge D3 → 04. Eixo B avatar → 05; pódio D6 → 06; demais
  avatares D4 → 07. D1/D2/D5 → 02+03; R1 → 01; R2 → 05; R3/R4 → 03; R5 →
  01/02/03. Nenhum requisito da PRD sem task.
