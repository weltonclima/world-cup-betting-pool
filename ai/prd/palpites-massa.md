# PRD — Fluxo de Palpites em Massa (Copa 2026)

> Feature slug: `palpites-massa`
> Fontes de verdade: `docs/prd-03-1/` — **PRD03.3-Sistema-Palpites-Copa-2026.md** (definitiva, substitui 3.1/3.2), **PRD03.4-UX-Wireframes-Copa-2026.md** (UX/wireframes), 16 PNGs de tela (`PRD03-01`…`PRD03-16`) + 3 PNGs bônus. Em conflito, vence 3.3 sobre 3.1/3.2; wireframes (PNG + 3.4) prevalecem sobre prosa para layout.
> Gerado: 2026-06-07

---

## 1. Resumo da feature

Substituir o fluxo atual de palpite jogo-a-jogo (TASK-07/08/09: detalhe de partida + formulário individual + lista) por uma **jornada de preenchimento em massa** que permite completar toda a Copa do Mundo 2026 em poucos minutos.

A jornada é um wizard com 9 etapas: Hub → Seleção de Grupo → Palpite em massa do grupo (6 jogos/tela) → Classificação prevista → Resumo dos 12 grupos → Ranking dos melhores terceiros → Chave eliminatória interativa (16 avos → oitavas → quartas → semis → 3º lugar → final) → Resumo final → Envio.

KPI primário: **taxa de conclusão dos palpites**. Meta de UX: preencher um grupo em < 60s; copa inteira em 3–5 min; ≥ 70% menos cliques que o fluxo atual.

O sistema de pontuação **não muda**: placar exato = +1, qualquer outro = 0 (PRD-00). Esta feature altera **como** o usuário registra palpites, não como pontua.

---

## 2. Escopo consolidado

### Estrutura do torneio (Copa 2026 — formato FIFA 48 seleções)
- 12 grupos (A–L), 4 seleções por grupo, 6 jogos por grupo = **72 jogos de fase de grupos**.
- Classificam-se: 12 primeiros + 12 segundos + 8 melhores terceiros = **32 seleções**.
- Eliminatórias: 16 avos (16 confrontos) → oitavas (8) → quartas (4) → semis (2) → disputa de 3º lugar (1) → final (1) = **32 confrontos eliminatórios**.
- Total de jogos no torneio: 72 + 32 = **104** (alinhado ao "72/104" dos wireframes do Hub).

### Telas no escopo (16)
| Tela | Nome | Função |
|---|---|---|
| PRD03-01 | Hub de Palpites | Progresso global + cards por fase + CTA contínuo |
| PRD03-02 | Seleção de Grupo | Grid 3×4 dos grupos A–L com status/percentual |
| PRD03-03 | Palpite em massa do grupo | 6 jogos numa tela; nav TAB; auto-save |
| PRD03-04 | Classificação prevista | Tabela 1º–4º calculada dos placares; confirmar |
| PRD03-05 | Resumo dos 12 grupos | Classificados de cada grupo; continuar |
| PRD03-06 | Ranking dos melhores terceiros | 8 melhores 3ºs por critério FIFA; gerar chave |
| PRD03-07 | Chave 16 avos | Confrontos gerados; seleção de vencedor |
| PRD03-08 | Oitavas | Idem, gerado das escolhas anteriores |
| PRD03-09 | Quartas | Idem |
| PRD03-10 | Semifinais | Idem |
| PRD03-11 | Final + 3º lugar | Final + disputa de 3º |
| PRD03-12 | Resumo final | Campeão/vice/3º/4º; confirmar e enviar |
| PRD03-13 | Sem palpites (empty) | Estado vazio do hub/listas |
| PRD03-14 | Em andamento | Estado de fase/grupo parcial |
| PRD03-15 | Enviado | Estado pós-envio |
| PRD03-16 | Bloqueado | Estado de fase/jogo encerrado |

### Modos
- **Modo grupo a grupo:** usuário escolhe grupo no grid e preenche.
- **Modo "⚡ Completar Copa":** fluxo contínuo encadeado (Grupo A → … → L → eliminatórias) sem voltar ao hub entre etapas.

### Fora de escopo (explícito)
- Telas **BONUS-01/02/03** (Progresso Geral, Chave Completa, Dicas) e palpites bônus (campeão/artilheiro — coleção `bonus_predictions`) — feature separada; **não** entram nesta PRD.
- Cálculo de pontuação real e ranking (já cobertos por PRD-02/PRD-04 — `predictions/score` e `rankings`).
- Ingestão de dados da Copa (já coberto por integração API-Football, TASK-04/05).

---

## 3. Entendimento do sistema (partes relevantes)

### Arquitetura de dados (PRD-07 v2.0)
- Dados da Copa (teams, matches, standings) vêm da **API-Football via Route Handlers Next** (`/api/matches`, `/api/teams`, `/api/standings`) → React Query no client. O browser **nunca** fala com a API-Football.
- Palpites: **leitura** via Firebase Client SDK direto (`listPredictionsByUid`, Rules permitem read próprio); **escrita** exclusivamente via `POST /api/predictions` (Admin SDK server-side). Rules negam write client-direto.

### Modelo de dados existente (reuso)
- `predictionSchema` = `{ uid, matchId, homeScore, awayScore, status?, points? }` — `status`/`points` só o servidor grava. `predictionInputSchema` = `{ matchId, homeScore, awayScore }`.
- `matchSchema` = `{ homeTeamId, awayTeamId, kickoffAt, stage, round?, groupId?, venue?, status, homeScore, awayScore }`. `stage ∈ {grupos, oitavas, quartas, semifinal, terceiro, final}`. `matchId` = `String(fixture.id)` da API-Football.
- `groupSchema` = `{ name, teamIds[] }`. **Nota:** não há `stage "16 avos"` no enum `stageSchema` — o enum atual tem `oitavas` como primeira eliminatória, **não contempla 16 avos**. Conflito direto com o formato 48-seleções da PRD (ver §5/§6).
- `predictionDocId(uid, matchId)` gera id determinístico; `isPredictionLocked(match, now)` decide bloqueio por kickoff.

### Feature `predictions` existente (reuso)
- Componentes: `ScoreInput`, `PredictionForm`, `PredictionListCard`, `PredictionFilters`, `PredictionList`, `PredictionLockedState`, `PredictionSuccess`.
- Hooks: `usePredictions`, `useUpsertPrediction`, `usePredictionsList`. Helpers: `predictionsHelpers`, `predictionLabels`.
- Rotas atuais: `/predictions` (lista, TASK-08), `/matches/[id]/predict` (form individual, TASK-07/09).

### Endpoints existentes
`GET /api/matches`, `GET /api/matches/[id]`, `GET /api/teams`, `GET /api/standings`, `POST /api/predictions`, `POST /api/predictions/score`. **Não existe** endpoint de batch/submit nem de bracket.

---

## 4. Análise de impacto técnico

### Módulos afetados
- **`features/predictions`** — extensão grande: novos componentes de wizard, hub, grid de grupos, grade de jogos do grupo, tabela de classificação, bracket interativo, resumo. Reuso de `ScoreInput`.
- **`features/matches`** — leitura/derivação de jogos por grupo e por fase (agrupar `listMatches()` por `groupId`/`stage`).
- **Novo domínio: bracket/eliminatórias** — não há modelo. Decisão pendente sobre persistência (§6).
- **`schemas`** — `stageSchema` precisa de `dezesseis-avos` (ou equivalente); novo schema de classificação prevista e/ou bracket pick.
- **`app`** — novas rotas sob `(app)/predictions/...` (hub, grupo, bracket). IA/navegação muda: item "Palpites" passa a abrir o Hub, não a lista atual.

### Persistência e contratos
- **Auto-save:** PRD pede "auto save a cada alteração". Definir camadas: (a) rascunho local (localStorage, alinhado à estratégia de cache do CLAUDE.md — filtros/preferências persistidos) e (b) persistência server. Sem batch endpoint, 72 jogos = 72 POSTs — custo/latência. **Recomenda-se** `POST /api/predictions/batch` (lista de inputs, valida e grava em lote via Admin SDK `batch()`), preservando regras de lock/aprovação por item.
- **Classificação prevista (PRD03-04):** derivada **client-side** dos 6 placares do grupo (pontos/saldo/gols pró/contra) — não é dado de servidor. Decidir se é apenas visual ou se gera entidade persistida.
- **Bracket (PRD03-07…11):** confrontos das eliminatórias dependem das escolhas do usuário (classificados + vencedores), **não** dos fixtures reais até a Copa definir os times. Mapear "pick de vencedor" para o modelo `prediction` (que é placar exato) é o maior ponto em aberto (§5/§6).
- **Submit final (PRD03-12):** "Confirmar e Enviar" sugere transição de rascunho→enviado. Não há campo de estado de submissão no modelo atual. Decidir: enviar = upsert de todos os palpites pendentes vs. flag de "submetido".

### Integrações
- Sem nova integração externa. Reuso de `fetchAllMatches`/`/api/matches` e Firestore Admin.

### Performance / escala
- < 100 usuários — escala trivial. Foco em **latência percebida** no preenchimento (auto-save não pode travar a digitação) e em **número de chamadas** (batch vs. N requests).

### Migração / rollout
- Coexistência com fluxo antigo: decidir se `/matches/[id]/predict` é mantido (deep-link/edição pontual) ou descontinuado. PRD diz "substitui". Recomenda-se **manter o registro por partida** como fallback e trocar a IA do menu "Palpites" para o Hub.

---

## 5. Riscos

1. **Modelo de palpite das eliminatórias (ALTO).** O sistema pontua placar exato por partida; o wireframe da chave (PRD03-07) pede "toque no vencedor" (sem placar). Ou (a) a chave também exige placar exato por confronto (consistente com pontuação, mas atrita com o UX de "só escolher vencedor"), ou (b) a chave é só uma projeção visual não pontuada e o palpite pontuável continua sendo placar por jogo. Decisão define todo o modelo de dados da chave.
2. **Times TBD nas eliminatórias (ALTO).** Fixtures de eliminatória existem na API-Football com mando/confronto indefinidos até a Copa avançar. `prediction.matchId` referencia fixture real — mas o usuário monta a chave com base nas **suas** previsões de classificação, que podem divergir dos confrontos reais. Risco de não conseguir casar palpite ↔ fixture.
3. **`stageSchema` não contempla 16 avos (MÉDIO).** Enum atual começa em `oitavas`. Formato 48-seleções tem 16 avos. Alterar enum impacta matches, rankings (`rankingScopeSchema`), estatísticas por fase.
4. **Dados de grupo incompletos (MÉDIO).** Depende de `matches.groupId` e `groups` populados para os 12 grupos A–L. Se a API-Football ainda não expõe os grupos/fixtures de 2026, as telas ficam sem dados reais (precisa de fallback/seed ou estado vazio).
5. **Auto-save x lock (MÉDIO).** Auto-save frequente pode bater em jogos já bloqueados (kickoff passado) e gerar 423 em massa. Precisa de tratamento silencioso por item e feedback agregado.
6. **Custo de N requests sem batch (BAIXO/MÉDIO).** 72 POSTs no "Completar Copa" — UX ruim e custo. Mitigar com batch endpoint.
7. **Desvio de design system (BAIXO).** Wireframes usam **shell verde** (header/CTA verdes) enquanto `design-system/MASTER.md` define shell neutro (verde só em auth). Resolver no `/screen` (estender tokens ou tematizar a área de palpites).

---

## 6. Ambiguidades e lacunas

- **A1.** Eliminatórias são pontuadas por **placar exato** ou só por **acerto de vencedor/classificado**? (PRD-00 só define placar exato.) — bloqueia modelo de dados da chave.
- **A2.** A "classificação prevista" (PRD03-04) e o "ranking de terceiros" (PRD03-06) são **pontuáveis** ou apenas derivações visuais para montar a chave?
- **A3.** Como persistir picks de bracket quando os confrontos derivam das previsões do usuário e não dos fixtures reais? (Entidade `Bracket` própria por usuário? Reuso de `predictions` com `matchId` de fixture real?)
- **A4.** "Auto save" = somente local (rascunho) ou também grava no servidor a cada alteração? Quando ocorre a persistência server — por jogo, ao "Salvar Grupo", ou só no "Confirmar e Enviar" final?
- **A5.** "Confirmar e Enviar" (PRD03-12) introduz estado de submissão? O modelo atual não tem flag de "enviado/rascunho". É necessário?
- **A6.** Regra de **desbloqueio de fases** ("fases futuras bloqueadas até definição"): desbloqueia quando o usuário completa a fase anterior, ou quando a Copa define os confrontos reais, ou ambos?
- **A7.** Critérios FIFA de desempate (PRD03-04/06): lista exata e ordem (pontos → saldo → gols pró → confronto direto → fair play → sorteio)? Quais aplicáveis com dados disponíveis? Usuário pode ajustar empate manualmente (PRD03.1 menciona "ajustar critérios")?
- **A8.** O fluxo antigo (`/matches/[id]/predict`, lista TASK-08) é **removido** ou **mantido** como edição pontual/fallback?
- **A9.** Existe deadline global de envio (ex.: início da Copa) além do lock por kickoff de cada jogo?
- **A10.** `system_settings` guarda algum flag para habilitar/ocultar o fluxo de massa (feature toggle)?

> Estas ambiguidades devem ser resolvidas no `/plan` e/ou via decisão do usuário antes das tasks de eliminatória. As tasks de grupos (Hub, grid, palpite em massa, classificação visual) podem prosseguir com menor risco.

### 6.1 Decisões resolvidas (usuário, 2026-06-07)

| # | Decisão |
|---|---|
| A1 | Eliminatória **pontua placar exato** por confronto (consistente com PRD-00). A chave usa input de placar (como grupos); vencedor é **derivado** do placar previsto. |
| A2 | Classificação prevista (PRD03-04) e ranking de terceiros (PRD03-06) são **derivações visuais NÃO pontuadas**. Só os 104 placares (72 grupos + 32 eliminatórias) pontuam. |
| A3 | **Sem coleção `Bracket` nova.** Reusa `predictions` contra **fixtures reais** (`matchId`). A chave é projeção visual derivada das previsões do usuário; o palpite pontuável é o placar por fixture. |
| A4 | Auto-save em **duas camadas**: rascunho **local** (localStorage) a cada alteração; **persistência server** ao "Salvar Grupo"/transição de etapa (batch), **não** por tecla. |
| A5 | "Confirmar e Enviar" faz **upsert dos palpites pendentes**; **sem** nova flag de estado de submissão. "Enviado" é derivado da existência dos palpites no servidor. |
| A6 | Fase desbloqueia ao **completar a fase anterior** no wizard; persistência de eliminatória só quando os **fixtures reais** estiverem definidos. |
| A7 | Desempate **FIFA padrão**: pontos → saldo de gols → gols pró → confronto direto → sorteio. **Sem** ajuste manual de empate pelo usuário. |
| A8 | **Manter** `/matches/[id]/predict` e registro por partida como fallback/edição pontual. Item "Palpites" reaponta para o **Hub**. |
| A9 | Deadline = **lock por kickoff** de cada jogo (`isPredictionLocked`). **Sem** deadline global adicional nesta entrega. |
| A10 | **Sem** feature toggle em `system_settings` nesta entrega. |

**Consequência de A1+A3:** a tela PRD03-07 ("toque no vencedor") passa a usar **input de placar** por confronto (o vencedor é derivado). Reaproveita `ScoreInput`. A projeção da chave avança o time de maior placar previsto; empate de placar em eliminatória exige tratamento de avanço (definir no spec da chave — ex.: exigir placar não-empatado, ou decidir por critério).

### 6.2 Decisões de fonte de dados (usuário, 2026-06-07)

> **SUPERSEDED:** As decisões D-API/D-MOCK/D-GROUP abaixo (caminho API-Football pago) foram substituídas pela série **D-OF** (provedor openfootball, grátis). Mantidas como histórico. D-BRACKET e D-PERSIST permanecem válidas (com ajuste em D-BRACKET para placeholders do openfootball).

| # | Decisão (histórico — superseded) |
|---|---|
| ~~D-API~~ | ~~Provedor = API-Football pago, season 2026.~~ Substituída por D-OF1. Probe ao vivo confirmou: plano free bloqueia 2026/2025; 2022 é formato antigo (32 times) — não serve. |
| ~~D-MOCK~~ | ~~Expandir mock api-football p/ formato 2026.~~ Substituída por D-OF1 (dados reais 2026 já disponíveis no openfootball, sem mock). |
| ~~D-GROUP~~ | ~~groupId via /standings da API-Football.~~ Substituída por D-OF3 (`groupId` vem direto de `match.group` do openfootball). |

### 6.2.1 Decisões openfootball (usuário, 2026-06-07) — ATIVAS

| # | Decisão |
|---|---|
| D-OF1 | **Provedor = `openfootball/worldcup.json` (grátis, sem chave, domínio público).** Fonte: `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`. Confirmado ao vivo: formato 2026 (12 grupos A–L, 72 jogos de grupo + mata-mata Round of 32→Final). Lido server-side via Route Handlers, cacheado (Next revalidate + React Query). Mantém a interface `ApiFootballClient` (renomeável p/ `CopaDataClient`) + Route Handlers + `matchSchema`/`teamSchema`; troca só implementação do client, mappers e config. Client HTTP api-football antigo é aposentado (interface preservada). |
| D-OF2 | **matchId estável:** mata-mata usa `m{num}` (campo `num` 73–104 do openfootball). Jogos de grupo (sem `num`) usam slug determinístico `{date}-{slug(team1)}-{slug(team2)}`. Palpites chaveiam por esse `matchId`. |
| D-OF3 | **Identidade de time via registry estático de 48 seleções:** `nome openfootball → { id, code (FIFA 3 letras), flagUrl, name }`. `id` = code (ex.: "BRA"). `flagUrl` via CDN de bandeiras grátis por código ISO. Atende `teamSchema` (code/flag obrigatórios) + `/api/teams`. `groupId` vem de `match.group` ("Group A" → "A"). Constante mantida em `src/server/copaData/teamRegistry.ts`. |
| D-OF4 | **Placeholders de mata-mata** (`"2A"`, `"1E"`, `"W74"`, `"L101"`) são mantidos como referência de slot em `homeTeamId`/`awayTeamId` quando o time real ainda não foi resolvido. Eles **codificam o seeding FIFA** — a lib de chave (TASK-03) os parseia para montar a chave do usuário a partir das classificações previstas, eliminando a tabela de seeding hardcoded. A UI exibe rótulo humano ("2º do Grupo A", "Vencedor do jogo 74"). |
| D-OF5 | **Parsing de horário:** `time` no formato `"HH:MM UTC±H"` → `kickoffAt` ISO com offset (ex.: `"2026-06-11T13:00:00-06:00"`), combinando `date` + `time`. |
| D-OF6 | **status:** openfootball ainda sem `score` (Copa não iniciada) → todos `scheduled`. Quando `score.ft` for populado pela comunidade, mapear p/ `finished` + goals. Frescor de resultados depende de commits do openfootball (aceito). |
| D-BRACKET | (Ajustada) A estrutura da chave vem dos **fixtures de mata-mata do openfootball** (placeholders de seeding + `num`), não de tabela FIFA hardcoded. TASK-03 parseia placeholders para projetar a chave a partir das previsões; palpite pontuável = placar exato por `matchId` (A1/A3). |
| D-PERSIST | (Mantida) **Só `predictions` (+ `users`) persistem no Firestore.** Todo dado da Copa (teams, groups, matches, bracket) é lido live via `CopaDataClient` → Route Handlers → React Query. Nenhum seed de dados da Copa no banco. |

---

## 7. Impacto UI/Layout

- **UI Impact:** yes
- **Platforms:** web (mobile-first; responsivo até desktop — bracket expandido horizontal no desktop)
- **Screens:** 16 telas novas/alteradas (PRD03-01…16) — wizard de palpites em massa + estados (empty/andamento/enviado/bloqueado). Item de navegação "Palpites" reaponta para o Hub.
- **Product type:** Sports betting pool / bracket challenge (estilo FotMob/ESPN/Google Play Games) — mobile-first.
- **Recommended style direction:** Esportivo limpo e funcional, consistente com `design-system/MASTER.md` (cards elevados, raios arredondados, baixa distração). **Decisão pendente:** wireframes usam destaque **verde** no shell/CTA da área de palpites — alinhar com MASTER (que hoje reserva verde para auth). Resolver no `/screen` via tema de escopo (à la `.auth-theme`) ou extensão de tokens esportivos (`--color-win/loss/draw` já previstos no MASTER §2.4).
- **Design complexity:** **high** — wizard multi-etapa, grade de inputs com navegação por teclado, tabela de classificação calculada, bracket interativo responsivo, auto-save, múltiplos estados.

> Flag `/screen` obrigatório para toda task com saída de tela. Primeira task de UI deve referenciar `design-system/MASTER.md`; gerar overrides por página quando necessário.

---

## 8. Preocupações de implementação (alto nível, sem tasks)

- **Reuso máximo da feature `predictions`** — `ScoreInput` e `useUpsertPrediction` são a base; o palpite em massa do grupo é, na essência, N `ScoreInput` orquestrados com auto-save e nav por teclado.
- **Derivação client-side** de classificação e terceiros (pontos/saldo/desempate) deve ficar em `features/predictions/lib` com testes unitários fortes (lógica pura, candidata a TDD).
- **Endpoint batch** (`POST /api/predictions/batch`) recomendado antes do "Completar Copa", reaproveitando validação/lock/aprovação por item do handler atual.
- **Decisão de modelo da chave** (A1/A3) é pré-requisito para qualquer task de eliminatória — sequenciar grupos primeiro.
- **`stageSchema`** precisa de revisão para 16 avos antes das tasks de chave (afeta matches/rankings/estatísticas).
- **Auto-save resiliente**: debounce + fila + reconciliação de erros por item (lock/aprovação) sem travar a digitação; rascunho local em localStorage.
- **Acessibilidade**: navegação por TAB entre placares (requisito explícito), alvos de toque ≥ 44px, foco visível, `aria` em inputs de placar e no bracket interativo.
- **IA/navegação**: reapontar "Palpites" para o Hub; decidir destino do fluxo antigo (A8).
