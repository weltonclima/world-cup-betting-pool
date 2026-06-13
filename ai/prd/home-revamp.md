# PRD — Home Revamp (visão real dos palpites)

> Feature técnica: redesenhar a Home Dashboard (`/home`) com melhores conceitos de UX/UI,
> substituindo cards defasados/vazios por insights reais e acionáveis sobre o desempenho
> do usuário. **`is_frontend: true`** — stack Next.js 15 + React 19 + Tailwind v4 + shadcn.

## 1. Feature summary

A Home hoje é uma grade de 8 cards (TASK-05/06/10) onde várias métricas são números
isolados, redundantes ou vazios. O usuário não obtém "visão real dos seus palpites":
não vê tendência, contexto, nem comparação. Esta feature **reformula a camada de
apresentação da Home** — sem trocar o modelo de dados nem a arquitetura Read/Write —
para entregar feedback significativo aproveitando dados **já existentes** mas
subutilizados (`positionHistory`, `correctByStage`, `totalWrong`, pontos ponderados por
jogo).

Não é uma feature de backend: nenhuma coleção nova, nenhuma Route Handler nova
obrigatória. É **redesign de UI + reaproveitamento de dados já agregados** pelo recalc.

## 1.1 Decisões travadas (direção de UI por bloco)

Resolvidas com o usuário antes do `/plan`:

| Bloco atual | Decisão | Substituto |
|---|---|---|
| Trio Ranking/Acertos/Aproveitamento (3 cards compactos) | **Fundir** | **Hero único (A) + régua de percentil**: posição + tendência (`positionHistory` → `▲N`), aproveitamento com denominador (`accuracy`+`totalCorrect`/`totalWrong`), streak (`longestStreak`), sparkline de evolução, e **régua de percentil** vs bolão (`pool_stats`: `averagePoints`/`highestPoints`). |
| Fase Atual (vazio — flag admin) | **Substituir** | **E — Jogos abertos pra palpitar**: lista de fixtures sem palpite (kickoff futuro, respeitando `isPredictionLocked`) + deadline + CTA "Palpitar". Foco = ação de palpitar. |
| Meu Desempenho (redundante) | **Substituir** | **H — Raio-X dos palpites**: donut 3-vias placar exato (10) / só vencedor (5) / erro (0) sobre palpites finalizados. recharts. Mostra a *qualidade* das previsões. |
| Avisos (quase sempre vazio) | **Remover** | Eliminado. Avisos reais (trava de fase, prazo do lote, cadastro fechado) absorvidos como **faixa fina** dentro de E ou do card Próximo Jogo. |

Preservados sem mudança: HomeHeader, NextMatchCard, LastResultsCard.

## 2. Consolidated scope

Reformular/avaliar os seguintes blocos da Home:

1. **Trio de métricas (Ranking / Acertos / Aproveitamento)** — hoje 3 cards compactos com
   números crus e sem contexto. Reformular para comunicar **posição + tendência**
   (subiu/desceu/estável via `positionHistory`), **acertos com denominador** (acertos de N
   palpites), e **aproveitamento com leitura visual** (barra/anel + faixa qualitativa).
2. **Fase Atual** — hoje quase sempre vazio ("Fase não definida") porque depende da flag
   admin opcional `system_settings.currentStage`, raramente preenchida. Decidir entre
   **(a)** derivar a fase de dados reais de partidas (fixtures/datas Copa) ou **(b)**
   substituir o card por algo com valor garantido (ex.: contexto do próximo jogo / progresso
   do torneio).
3. **Meu Desempenho** — hoje 4 sub-métricas que **duplicam** o trio do topo (Acertos,
   Aproveitamento repetidos) + Maior sequência + Palpites (derivado). Redundante.
   Reformular para trazer informação **nova**: distribuição de resultados (exatos / vencedor
   / erros), desempenho por fase (`correctByStage`), ou evolução de pontos.
4. **Avisos** — hoje deriva no máximo 3 avisos de flags (`predictionsLocked`,
   prazo < 3h, `registrationOpen`); na maior parte do tempo mostra "Nenhum aviso".
   Decidir entre **(a)** enriquecer com avisos acionáveis (jogos sem palpite, prazo do
   próximo lote, mudança de posição) ou **(b)** substituir/fundir com outro bloco.

Fora de escopo: alterar regras de pontuação, recalc, schema de Firestore, fluxo de
escrita de palpites, ranking server-side.

## 3. System understanding relevant to this feature

### Composição atual (camada de UI)
- `HomeDashboard.tsx` renderiza header + grade: trio compacto (`RankingCard`,
  `CorrectScoresCard`, `AccuracyCard`) → `NextMatchCard` → `CurrentStageCard` →
  `LastResultsCard` → `PerformanceCard` → `NoticesCard`. Loading via skeletons,
  erro em nível de página.
- `useHomeDashboard.ts` (compositor TASK-05) orquestra 7 hooks (ranking do pool,
  statistics, próximo jogo, resultados recentes, teams, predictions, settings), faz joins
  client-side e expõe estrutura derivada + `isLoading/isError/refetch`.
- `homeDashboardHelpers.ts` concentra as funções puras de derivação (testáveis).

### Dados disponíveis HOJE (subutilizados)
- `statistics/{uid}` (schema `statistics.ts`): `totalCorrect`, **`totalWrong`** (opcional),
  `accuracy`, `longestStreak`, **`correctByStage`** (acertos por fase),
  **`positionHistory`** (série temporal de posições com `at`/`scope`/`position`/`round`).
- `rankingEntry` (schema `rankings.ts`): `position`, `points` (ponderados), `wrong`,
  `accuracy`, `avatarUrl`, `name/nickname` — por escopo (geral + 5 fases) e por grupo.
- Resultados recentes já trazem **pontos ponderados por jogo** (`scorePrediction`: 10/5/0)
  — base pronta para distribuição de resultados.
- `pool_stats`: `averagePoints`, `highestPoints`, `distribution` — contexto comparativo do
  bolão (já existe, não consumido na Home).

### Restrição arquitetural-chave
- Reads são Client SDK direto (gated por Rules); nenhuma métrica nova exige Route Handler.
- `system_settings.currentStage` é **opcional** e administrativa → não confiável como fonte
  de "fase atual". Partidas Copa vêm de Route Handlers (`/api/matches`) com `stage`/`round`
  reais — fonte derivável mais robusta.

## 4. Technical impact analysis

- **Módulos afetados:** somente `src/features/home` (components + lib helpers + possível
  ajuste em `useHomeDashboard`). Possível leitura adicional de `pool_stats` via um hook
  novo dentro de `features/home/hooks` (read client-side, sem nova rota).
- **Contratos:** sem mudança de schema. Se "Fase Atual" passar a derivar de partidas,
  `deriveCurrentStage` deixa de depender de `settings.currentStage` e passa a usar
  `stage`/`round` das partidas já carregadas — mudança interna ao helper, sem novo contrato.
- **Persistência/integrações:** nenhuma. `positionHistory`/`correctByStage`/`totalWrong`
  já são gravados pelo recalc; basta consumi-los. Confirmar que o recalc **popula** esses
  campos hoje (risco de virem vazios/parciais em docs legados — ver §5).
- **Performance:** trio + novos blocos derivam de queries já em cache (React Query
  30min/24h). Distribuição/tendência são cálculos O(n) sobre arrays pequenos no cliente —
  sem N+1, sem custo de rede adicional (exceto possível leitura de `pool_stats`).
- **Acessibilidade:** novos elementos visuais (barras/anéis/sparkline de tendência)
  precisam de equivalente textual (aria-label, valor numérico visível) — alvo mobile-first.

## 5. Risks

- **Dados agregados vazios/parciais (alto):** `positionHistory`, `correctByStage`,
  `totalWrong` são opcionais/podem estar vazios em contas novas ou docs legados. Cada bloco
  novo PRECISA de estado empty sólido — senão troca-se "card vazio" por "card quebrado".
  Mitigar: verificar o que o recalc grava de fato antes de prometer tendência/por-fase.
- **Regressão de testes (médio):** cada card da Home tem `__tests__` co-localizado e o
  compositor tem testes. Reescrever cards quebra snapshots/asserts — atualizar testes junto.
- **Tendência enganosa (médio):** `positionHistory` em pré-torneio (sem jogos) não tem
  série → "subiu/desceu" pode ser ruído. Definir regra clara de quando exibir tendência.
- **Derivar fase de partidas (médio):** lógica de "fase corrente" a partir de datas/stages
  de fixtures tem casos de borda (entre fases, fase de grupos com 3 rodadas simultâneas).
- **Escopo de redesign x dados reais:** "melhores conceitos de UX/UI" é amplo; risco de
  over-design. Travar direção visual no `/ui-spec` antes de implementar.

## 6. Ambiguities and gaps

- **"Melhorar ou substituir":** para Fase Atual, Meu Desempenho e Avisos o usuário deixou
  em aberto. Precisa decisão por bloco (melhorar vs substituir vs fundir) — resolver no
  `/plan` / `/ui-spec` com recomendação.
- **Tendência de ranking:** comparar contra qual baseline — recalc anterior, início da fase,
  ou início do torneio? `positionHistory.round` existe mas semântica de "round" na Copa é
  o nº da execução de recalc, não rodada linear.
- **Contexto comparativo:** usar `pool_stats` (média/maior pontuação) para dar régua ao
  usuário ("você está X% acima da média")? Agrega valor mas exige leitura extra.
- **Acertos "de N":** denominador = `totalCorrect + totalWrong`? `totalWrong` é opcional —
  fallback quando ausente precisa definição (derivar via accuracy, como hoje em
  `gamesPredicted`).
- **Avisos acionáveis:** "jogos sem palpite" exige cruzar fixtures abertos × predictions —
  dado disponível mas hoje não computado para esse fim.

## 7. Recommended implementation concerns

- Tratar como **redesign incremental por bloco**, não reescrita big-bang da Home —
  preservar header, próximo jogo e últimos resultados (que funcionam) e atacar os 4 blocos
  problemáticos.
- **Antes de planejar:** confirmar empiricamente o que o recalc grava em
  `statistics`/`rankings` (campos opcionais populados ou não) — define o que é prometível.
- Passar pelo track de UI (ui-spec → patterns:nextjs → ui-review) — feature é puramente
  visual; `ui-ux-pro-max` deve dirigir hierarquia, densidade e estados (loading/empty/erro)
  com prioridade mobile-first.
- Manter a disciplina do compositor: derivações novas em `homeDashboardHelpers.ts` (puras,
  testáveis), UI burra nos cards.
- Cada bloco novo entrega **estado empty intencional** com mensagem útil (ex.: "Faça seu
  primeiro palpite para ver seu desempenho"), nunca um "--" mudo.
