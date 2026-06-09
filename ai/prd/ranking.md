# PRD — Ranking (PRD-05)

> Fonte: `docs/prd-05/prd-05.md` + 6 imagens (fonte de verdade) em `docs/prd-05/`.
> Decisões do Tech Lead registradas em §6. Artefato gerado pelo `/prd`.

## 1. Feature summary

Área de **Ranking** do Bolão dos Parças: o participante acompanha posição, pontuação, acertos, aproveitamento e evolução, comparando-se com a comunidade. Composta por 6 telas sob a aba **Ranking** do Bottom Tab Bar:

1. **Ranking Geral** — classificação completa (abas Geral / Por Fase / Por Grupo), com destaque "Você".
2. **Meu Ranking** — resumo do desempenho pessoal + mini-gráfico de evolução.
3. **Ranking por Fase** — cards por etapa (Grupos, Oitavas, Quartas, Semi, Final) + Por Grupo.
4. **Evolução no Ranking** — gráfico de linha + lista de rodadas com indicador subiu/manteve/caiu.
5. **Perfil do Participante** — estatísticas de outro participante.
6. **Estatísticas Gerais** — visão agregada do bolão + distribuição de pontuação.

Escopo **full-stack**: backend recalcula rankings, grava snapshots de evolução e agrega estatísticas; frontend consome via React Query.

## 2. Consolidated scope

### Incluído
- 6 telas listadas, todas mobile-first e responsivas (360/390/430 → 768 → 1024+).
- Aba **Por Grupo** (presente nas imagens, ausente no texto do PRD — imagem prevalece).
- Backend de recálculo: Route Handler (Admin SDK) que, a partir das `predictions` já pontuadas (PRD-04), recalcula:
  - `rankings` por escopo (geral + 5 fases) e por grupo;
  - `statistics/{uid}` (totalCorrect, accuracy, longestStreak, correctByStage, positionHistory);
  - agregados do bolão (estatísticas gerais).
- Snapshots de evolução por rodada (alimenta Telas 02 e 04).
- Estados de tela: Loading (skeleton), Empty, Error (com "Tentar Novamente").
- Firestore Rules: ranking/estatísticas somente-leitura para o cliente; escrita só server-side.

### Excluído / fora do escopo
- Alteração do **modelo de pontuação** (mantém-se binário 1/0 — ver §6).
- Pontuação 3/1/0 e `correctWinners` do texto do PRD-05 (descartados por decisão).
- Notificações de mudança de posição (eventual PRD futuro).
- Bônus/palpites especiais (campeão, artilheiro) — pertencem a `bonus_predictions`, outro PRD.

## 3. System understanding (partes relevantes)

### Pontuação (já implementado — PRD-04)
- `scorePrediction()` (`src/features/predictions/lib/predictionsHelpers.ts:84`) → `{ status, points }` com `points: 0 | 1`. Placar exato → 1, senão → 0.
- `predictionSchema.points = z.literal(0).or(z.literal(1))` (`src/schemas/predictions.ts:25`). Gravado **só pelo servidor**.
- Route Handler de pontuação: `POST /api/predictions/score` (`src/app/api/predictions/score/route.ts`) — autorizado por `x-cron-secret` (cron externo) **ou** sessão admin. Idempotente (função pura + `set merge`). Itera partidas `finished`, pontua cada palpite.
- **Sem Firebase Cloud Functions** — lógica de servidor roda em Route Handlers Next (Admin SDK), disparada por cron externo/admin. Ver memory `architecture-copa-data`.

### Estruturas Firestore já modeladas (schemas existentes, hoje subutilizados)
- `rankings` (`src/schemas/rankings.ts`): **doc por escopo**, contendo `entries[]` ordenado. Entry atual = `{ uid, nickname, position, points }`. `rankingScopeSchema` = `geral | grupos | oitavas | quartas | semifinal | final`.
- `statistics/{uid}` (`src/schemas/statistics.ts`): `{ uid, totalCorrect, accuracy, longestStreak, correctByStage, positionHistory[] }`. `positionHistory` entry = `{ at, scope, position }`.
- Serviço de leitura: `getGeneralRanking()` (`src/services/rankings.ts`) — lê doc `scope:"geral"` via Client SDK, valida com Zod.
- Hook existente: `useGeneralRanking()` (`src/features/home/hooks/useGeneralRanking.ts`) — usado pelo card de ranking da Home.
- Página atual `src/app/(app)/rankings/page.tsx` é **placeholder**.

### Navegação
- Bottom Tab Bar definida em `src/components/layout/nav-items.ts`: Início / Jogos / Palpites / Ranking (`/rankings`, ícone Trophy) / Perfil. A aba Ranking já existe e aponta para a rota correta.

### Dados de partidas
- `matches`/`teams`/`groups` vêm de **Route Handlers Next → API-Football** (PRD-07), **não** do Firestore. Ranking deriva de `predictions` (Firestore) cruzadas com partidas `finished`. `correctByStage` exige saber a fase de cada partida (campo `stage` da partida).

## 4. Technical impact analysis

### Módulos / arquivos afetados
| Área | Arquivo(s) | Mudança |
|---|---|---|
| Schemas | `src/schemas/rankings.ts` | Estender `rankingEntrySchema` com `name`, `correct`, `wrong`, `accuracy` (binário). Adicionar escopo/estrutura "por grupo". |
| Schemas | `src/schemas/statistics.ts` | Adicionar agregados do bolão (estatísticas gerais) — novo schema `poolStatsSchema` ou doc dedicado. |
| Schemas | `src/schemas/shared.ts` | `rankingScopeSchema` — avaliar granularidade por grupo (A,B,C…) vs fase "grupos". |
| Tipos | `src/types/rankings.ts` | Tipos derivados atualizados. |
| Serviços | `src/services/rankings.ts` | Funções: ranking por fase, por grupo, ranking do usuário, perfil de participante, estatísticas gerais. |
| Backend | `src/app/api/rankings/recalc/route.ts` (novo) | Recalcula rankings + statistics + snapshots a partir das predictions pontuadas. Autorização igual ao score (cron secret/admin). Idealmente encadeado após `/api/predictions/score`. |
| Feature UI | `src/features/rankings/**` (novo) | Componentes das 6 telas, hooks React Query, helpers puros (cálculo de posição, indicador de evolução). |
| Rotas | `src/app/(app)/rankings/page.tsx` + sub-rotas | Substituir placeholder; rotas para meu-ranking, por-fase, evolução, perfil/[uid], estatísticas. |
| Rules | `firestore.rules` | `rankings`, `statistics` e doc de stats gerais: `allow read` (aprovados), `allow write: if false`. |
| Índices | `firestore.indexes.json` | Conforme queries finais (ver §5 — possivelmente desnecessário no modelo doc-por-escopo). |

### Fluxos
- **Recálculo:** cron/admin → `/api/predictions/score` (pontua) → `/api/rankings/recalc` (agrega). Lê todas `predictions` + partidas (`fetchAllMatches`), ordena por critérios de desempate, grava docs `rankings`, `statistics/{uid}` e stats gerais. Idempotente.
- **Leitura:** páginas client → hooks React Query → `services/rankings` → Firestore (Client SDK, somente leitura). Cache: herda QueryClient global (30min/24h); PRD-05 pede cache 5min — **conflito**, ver §6.
- **Destaque "Você":** comparar `entry.uid` com uid da sessão; aplicar estilo de realce + badge.

### Persistência / consistência
- Doc-por-escopo: 1 leitura traz ranking inteiro (<100 usuários) — barato e simples. Mantido (ver §6).
- Snapshots de evolução: append em `statistics.positionHistory` a cada recálculo, com `at`/`scope`/`position`. Crescimento limitado (poucas rodadas, <100 users).
- Estatísticas gerais: doc único `system_settings`/`statistics` agregado (maior, menor, média, total participantes, distribuição de faixas).

### Integrações externas
- Nenhuma chamada direta à API-Football pelo frontend (critério de aceite). Ranking só lê Firestore. Partidas via Route Handlers já existentes.

### Performance / escala
- <100 usuários: ranking inteiro em 1 doc por escopo. Render <2s trivial. Paginação de 20 (PRD) é cosmética/virtual no client — não exige query paginada no Firestore.

## 5. Risks

1. **`name` não desnormalizado no ranking.** `rankingEntry` atual só tem `nickname`. Telas mostram Nome + Apelido. Risco: leitura extra de `users` por entry. Mitigação: desnormalizar `name`+`nickname` no recálculo (1 join server-side).
2. **"Por Grupo" sem modelo definido.** `rankingScopeSchema` tem "grupos" (fase inteira), não grupos individuais (A–L). Telas mostram aba "Por Grupo". Risco de subespecificação — precisa decisão de granularidade (ver §6/Ambiguidades).
3. **Evolução por rodada exige histórico.** Hoje não há snapshots gravados. Se o recálculo não rodou em rodadas passadas, a evolução começa vazia. Risco: Telas 02/04 sem dados retroativos. Mitigação: aceitar histórico a partir do go-live; Empty state.
4. **Cache 5min (PRD) vs 30min (QueryClient global).** Override por-query necessário ou aceitar 30min. Decisão em §6.
5. **Definição de "Erros" e "Aproveitamento" sob binário.** "Erros" = palpites de partidas finalizadas que não acertaram. "Aproveitamento" = acertos / partidas com palpite finalizado. Precisa fixar denominador (jogos palpitados vs todos os jogos). Imagem mostra "12 de 48 jogos" → denominador = jogos disponíveis/finalizados, não só palpitados. Ver §6.
6. **Recálculo acoplado ao score.** Se rodarem separados, ranking pode ficar defasado de predictions. Mitigação: chamar recalc ao fim do score, ou cron único sequencial.
7. **Desempate por "Data do Primeiro Palpite".** Exige `createdAt` confiável em predictions (campo é `optional`). Risco de empate não-determinístico se ausente. Mitigação: fallback estável (uid).

## 6. Ambiguidades, lacunas e decisões

### Decisões já tomadas (Tech Lead)
- **D1 — Pontuação binária 1/0 vence.** Mantém CLAUDE.md + PRD-04. Ignora 3/1/0 e `correctWinners` do texto do PRD-05. Sob binário, **pontos === acertos exatos** (mesma métrica). Telas adaptam: remover "acertou vencedor"; não duplicar "Pontos" e "Acertos" (são o mesmo número). Exibir: **Acertos (=pontos)**, **Erros**, **Aproveitamento**.
- **D2 — Escopo full-stack.** Backend de recálculo + snapshots + stats agregadas (Route Handler/cron, sem Cloud Functions) + 6 telas.
- **D3 — Incluir aba "Por Grupo"** (imagem é fonte de verdade).
- **D4 — Data model: manter doc-por-escopo** (`rankings` com `entries[]`), já implementado e ótimo para <100 users. **Não** migrar para doc-por-usuário do texto do PRD-05.

### Ambiguidades a resolver no /plan ou via pergunta
- **A1 — Granularidade "Por Grupo":** ranking por grupo individual (A, B, C…) ou só a fase "grupos" consolidada? Imagem da Tela 03 mostra aba "Por Grupo" separada de "Por Fase". *Proposta:* ranking filtrado pelas partidas de cada grupo, seletor de grupo. Confirmar no plano.
- **A2 — Denominador do Aproveitamento:** "X de Y jogos" — Y = jogos finalizados (default proposto) vs jogos palpitados vs todos os jogos da Copa. *Proposta:* Y = partidas finalizadas elegíveis ao escopo.
- **A3 — Cache:** aceitar 30min do QueryClient global (proposto, simplicidade) ou override 5min por-query conforme PRD.
- **A4 — "Rodada":** Copa não tem rodadas lineares como liga. Mapear "rodada" para datas de recálculo (jornada) ou para fases? *Proposta:* cada execução de recálculo = um ponto de evolução (rotular por data/jornada).
- **A5 — Perfil do Participante:** acessível a partir de qualquer linha do ranking? Botão "Ver histórico de palpites" (imagem Tela 05) — abre lista de palpites do outro user (precisa permissão de leitura). Confirmar visibilidade de palpites alheios.

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** web (mobile-first, responsivo até desktop)
- **Screens:** 6 novas (Ranking Geral, Meu Ranking, Ranking por Fase, Evolução no Ranking, Perfil do Participante, Estatísticas Gerais) + substituição do placeholder `/rankings`.
- **Product type:** Sports betting pool / leaderboard & stats dashboard (consumer, mobile-first).
- **Recommended style direction:** Manter linguagem visual já estabelecida no app (tema verde/branco, cards shadcn, números grandes em destaque, badges, header verde de destaque). Consistente com Home/Palpites. Gráficos de linha para evolução (Recharts) e barras horizontais para distribuição de pontuação. Cada tarefa de UI roda `/screen` gerando `ai/screen/ranking-task-NN.md`, referenciando os screenshots de `docs/prd-05/` como contrato visual.
- **Design complexity:** medium-high (6 telas, 2 tipos de gráfico, abas, estados, destaque condicional, responsividade).

> Nota: `design-system/MASTER.md` não existe; o app usa artefatos `/screen` por tarefa como baseline. As imagens do PRD-05 são o contrato visual primário.

## 8. Implementation concerns (alto nível, sem tarefas)

- **Schemas primeiro:** estender `rankingEntrySchema` (name, correct, wrong, accuracy), definir estrutura "por grupo", schema de stats gerais, antes de serviços/UI. Zod é fonte única de tipos.
- **Helpers puros e testáveis:** cálculo de posição + desempate, indicador de evolução (subiu/manteve/caiu), faixas de distribuição — funções puras com testes (padrão do projeto: co-located `__tests__`, Vitest). Candidatos a `/tdd`.
- **Backend de recálculo** espelha o padrão de `/api/predictions/score` (autorização dupla, idempotência, paralelismo, `set merge`). Encadear após o score.
- **Reuso:** aproveitar `getGeneralRanking`/`useGeneralRanking` existentes; estender em vez de recriar. Manter contrato do card de ranking da Home.
- **Rules + segurança:** ranking/stats `read` para aprovados, `write: if false`. Pontuação só server-side (já garantido para predictions; replicar para rankings/statistics).
- **Estados:** skeleton/empty/error reutilizáveis entre as 6 telas.
- **Acessibilidade/touch:** alvos ≥44px, aria nas abas e linhas de ranking, contraste do destaque "Você" (fundo verde claro + badge).
- **Critérios de aceite (PRD-05):** ranking geral, por fase, posição própria, evolução, estatísticas; recálculo automático; mobile + desktop; dados do Firestore; zero chamadas diretas à API-Football.
