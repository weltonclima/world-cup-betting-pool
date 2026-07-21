# PLAN — Multi-Championship & Public Launch

> Fonte: `ai/prd/multi-championship-launch.md`. Épico fatiado em 21 tasks independentes, sequenciadas foundation → dados/persistência → config/ranking → UI → lançamento público → validação. Decisões travadas (§6 do PRD): matchId compat, catálogo curado (23 campeonatos), onboarding auto-serviço com moderação no grupo, arquivamento → Histórico. Revisado pelo gsd-plan-checker (2 bloqueadores + warnings dobrados).

## 1. Planning summary

O épico transforma o produto de torneio único (Copa 2026) em plataforma multi-campeonato auto-serviço. A maior fonte de risco é o **namespacing de matchId** (TASK-03) — precisa preservar `predictions`/`rankings` legados da Copa (compat) enquanto habilita ids namespaced para campeonatos novos. A camada ESPN precisa de **spike de validação** (TASK-01) antes de generalizar, pois o payload/paginação variam por liga. Ranking, arquivamento e onboarding são frentes independentes que dependem da fundação de dados. Cada task é entregável isoladamente; o piloto end-to-end vira real quando TASK-01→06 fecham para um campeonato não-Copa.

## 2. Recommended execution phases

- **Phase 1 – Foundation (dados + ESPN)**: TASK-01, 02, 03, 04
- **Phase 2 – Data source & persistence/archive**: TASK-05, 06, 13, 14
- **Phase 3 – Pool config & ranking**: TASK-07, 11, 21, 12
- **Phase 4 – UI segmentation & history**: TASK-08, 09, 10, 20, 15
- **Phase 5 – Public launch (onboarding)**: TASK-16, 17, 18
- **Phase 6 – Validation & release readiness**: TASK-19

> Total: **21 tasks** (19 originais + TASK-20 standings de liga e TASK-21 rotas/cron, ambas splits do plan-checker).

## 3. Tasks

### TASK-01 – Spike de validação ESPN multi-liga
- Type: integration
- Goal: Provar que a API pública ESPN serve os 23 slugs curados de forma utilizável (shape do payload, paginação por range de datas, disponibilidade de schedule/placar) antes de generalizar o cliente.
- Scope: **Validação em dois níveis, cobrindo os 23 slugs** (decisão travada "cada slug"): (a) DEEP em 3 representativos — 1 liga `bra.1`, 1 copa não-FIFA `uefa.champions`, 1 seleção `conmebol.america` — shape completo, paginação, mapper. (b) SMOKE automatizado nos 20 restantes — resposta 200 + presença dos campos-chave (`events[]`, teams, status, date). Chamar `site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard`, medir eventos/chamada vs cap de 100. Produz matriz de validação por slug (aprovado/paginação necessária/campos ausentes/reprovado) — não código de produção. Slugs reprovados saem do catálogo de TASK-02.
- Main modules/files likely involved: script/spike sob `scratchpad`, referência `src/server/copaData/espn{Client,Types,Mapper}.ts`.
- Dependencies: none
- Story points: 3
- Criticality: high
- Technical risk: high
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: Bloqueia decisões de TASK-02/04. RESULTADO: 23/23 aprovados (0 reprovados); bra.1 e uefa.champions exigem paginação (cap 100). Matriz em ai/spec/task-multi-championship-launch-01-results.md. Se um slug falhar, remove-se do catálogo antes de habilitar. Sem SLA da ESPN — documentar rate-limit observado.

### TASK-02 – Schema `championship` + catálogo curado
- Type: domain
- Goal: Modelar o conceito de campeonato como contrato de primeira classe e registrar o catálogo curado dos 23 campeonatos validados.
- Scope: `championshipSchema` (id, slug ESPN, nome pt-BR, temporada, `type: "league" | "cup"`, janela de datas, `status: "upcoming" | "live" | "archived"`), types derivados, registry estático `CHAMPIONSHIP_CATALOG` (só slugs aprovados no spike). Helpers `getChampionship(id)`, `isCupType`.
- Main modules/files likely involved: `src/schemas/championships.ts`, `src/types/championships.ts`, `src/server/copaData/championshipCatalog.ts`.
- Dependencies: TASK-01
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Copa 2026 (`fifa.world`) entra no catálogo como campeonato legado com flag de compat de matchId.

### TASK-03 – matchId namespaced com compat da Copa
- Type: domain
- Goal: Permitir ids de partida únicos entre campeonatos sem quebrar `predictions/{matchId}` e escopos de ranking da Copa 2026.
- Scope: Estender derivação de matchId para `{championshipId}:{slug}` em campeonatos novos; `fifa.world` continua emitindo ids legados (`m1`, slug atual) via branch de compat. Funções `namespacedMatchId(championshipId, base)` e `parseMatchId`. Testes de snapshot garantindo bytes idênticos para Copa.
- Main modules/files likely involved: `src/server/copaData/{matchId,espnMatchId}.ts`, testes de snapshot existentes de paridade.
- Dependencies: TASK-02
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: MAIOR risco de regressão do épico. Invariante: nenhum matchId da Copa muda. Fazer cedo e blindar com snapshot. Guardas de colisão do separador ':' (base+id) adicionadas na review — dupla-aplicação lança em vez de duplicar prefixo.

### TASK-04 – Parametrizar cliente/mapper ESPN por liga
- Type: integration
- Goal: Remover o hardcode `fifa.world` da camada ESPN e derivar ranges de datas por campeonato/temporada.
- Scope: `EspnScoreClient` recebe slug de liga; `ESPN_TOURNAMENT_RANGES` vira função `deriveRanges(championship)` (janela da temporada, split por cap de 100). `mapEspnEventsToMatches` recebe `championshipId` e injeta em cada match (usa TASK-03 para o id). Ramificação de mapper onde o shape divergir (achados do spike).
- Main modules/files likely involved: `src/server/copaData/espn{Client,Mapper}.ts`, `config.ts`.
- Dependencies: TASK-02, TASK-03
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Ligas longas (38 rodadas) exigem muitos ranges — atenção a latência/rate-limit. `espnBracketMap` só se aplica a `type: "cup"`. ESCOPO REFINADO (spec-time): entrega client-por-slug + `deriveRanges` + helper `matchBaseId` (base=`event.id` p/ novos, legado p/ Copa; namespacing TASK-03). Mapeamento COMPLETO liga→MatchWithId (stage/round/championshipId) movido p/ TASK-05, pois exige evoluir `matchSchema`/`stageSchema` (liga não tem fase Copa). Decisão travada com o usuário: 100% ESPN ao vivo, base=event.id.
- Status: done
- Phases done: spec, tdd, implement, test, review

### TASK-05 – `matchSchema.championshipId` + `getEffectiveMatches` por campeonato
- Type: domain
- Goal: Anexar campeonato a toda partida e escopar a fonte efetiva de partidas por campeonato.
- Scope: Campo aditivo `championshipId` em `matchSchema` (default na leitura = `fifa.world` para docs legados). `getEffectiveMatches(championshipId)` busca base ESPN daquele campeonato + overlay de overrides filtrado por campeonato. `readPersistedMatches` filtra por `championshipId`. **Inclui índice composto Firestore + Rules de `matches` por `championshipId`** (movido de TASK-13, pois TASK-05/06 já fazem query por campeonato — evita query falha no intervalo).
- Main modules/files likely involved: `src/schemas/matches.ts`, `src/server/copaData/matchSource.ts`, `firestore.indexes.json`, `firestore.rules`.
- Dependencies: TASK-03, TASK-04
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Ponto de convergência da fundação; a partir daqui um campeonato-piloto pode ir end-to-end. **WR-02 da review TASK-04 (BLOQUEADOR ao ligar em prod):** `deriveRanges` usa janela jan–dez do ano da `season`; temporada europeia ago–mai atravessa DOIS anos-calendário → adicionar `seasonStart`/`seasonEnd` opcionais ao catálogo (schema TASK-02) e derivar a janela deles ANTES de rotear liga de temporada partida em produção. `deriveRanges` já lança em `season` não-`YYYY` (ex.: "2025-26") como salvaguarda. INCORPORA (movido da TASK-04): mapper COMPLETO liga→MatchWithId — evoluir `stageSchema` p/ ligas (sem fase Copa; ex.: stage `liga` + `round` = rodada) e usar `matchBaseId` (event.id) da TASK-04. Persistência de dado de jogo SÓ no arquivamento (TASK-13); ao vivo é 100% ESPN.

### TASK-06 – Rotas de partidas escopadas por campeonato
- Type: api
- Goal: Expor partidas/standings/bracket por campeonato via Route Handlers.
- Scope: `api/matches` e `api/matches/[id]` aceitam `?championship=`; novo `api/championships` (lista catálogo + habilitados no pool). Cache tiers reusados. Bracket route só responde para `cup`.
- Main modules/files likely involved: `src/app/api/matches/*`, `src/app/api/championships/route.ts`, `src/services/matches.ts`.
- Dependencies: TASK-05
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: pending
- Phases done: (none)
- Notes: Manter compat: sem `?championship=` → default `fifa.world` (não quebra clientes atuais).

### TASK-07 – Config de campeonatos no pool + API de settings
- Type: application
- Goal: Persistir quais campeonatos o grupo habilita e o modo de ranking.
- Scope: Campos aditivos optional em `poolSchema`: `enabledChampionships: string[]`, `rankingMode: "geral" | "por-campeonato"` (defaults na leitura = Copa habilitada, modo geral). `PATCH /api/group/settings` aceita os campos (valida contra catálogo). Enforcement server-side.
- Main modules/files likely involved: `src/schemas/pools.ts`, `src/app/api/group/settings/route.ts`, `src/server/admin/adminPools.ts`.
- Dependencies: TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: pending
- Phases done: (none)
- Notes: Segue padrão de flags aditivas já consolidado (`splitPhaseRanking`, `allowInvites`). Teto de campeonatos/pool a definir na spec.

### TASK-08 – Dashboard do grupo: seção Campeonatos
- Type: application
- Goal: UI no dashboard group_admin para habilitar/desabilitar campeonatos e alternar modo de ranking.
- Scope: Nova seção "Campeonatos" em `groupAdmin`: lista do catálogo com toggle por campeonato + switch de modo de ranking (geral/por-campeonato). Consome/persiste via TASK-07. Estados, acessibilidade, empty state. **is_frontend: true**.
- Main modules/files likely involved: `src/features/groupAdmin/components/*`, hooks de settings.
- Dependencies: TASK-07
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: pending
- Phases done: (none)
- Notes: Frontend → aciona /ui-spec + /patterns:nextjs + /ui-review.

### TASK-09 – Seletor de campeonato + segmentação de jogos/palpites
- Type: application
- Goal: Estado transversal de "campeonato ativo" e segmentação das telas de jogos e palpites.
- Scope: Seletor (abas/dropdown) alimentado pelos campeonatos habilitados do pool; estado compartilhado (context/query param). `MatchList`, palpites e home passam a filtrar pelo campeonato ativo. Um só campeonato habilitado → seletor oculto. **is_frontend: true**.
- Main modules/files likely involved: `src/features/matches/*`, `src/features/predictions/*`, `src/features/home/*`, novo provider de campeonato ativo.
- Dependencies: TASK-06, TASK-07
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: pending
- Phases done: (none)
- Notes: Frontend → /ui-spec + /patterns:nextjs + /ui-review. Cuidar de não regredir a UX atual de campeonato único. **As agregações da home (`useHomeDashboard`: jogos abertos, donut raio-x, percentil) NÃO são só filtro** — precisam ganhar a dimensão campeonato de forma explícita na spec, não como efeito colateral do seletor (alerta do plan-checker).

### TASK-10 – Bracket/derivations condicionados ao tipo (cup vs league)
- Type: domain
- Goal: Evitar que a suposição de mata-mata quebre ligas de pontos corridos (gate puro de tipo).
- Scope: Gatear `worldcup/bracket`, `BracketView`, best-thirds e derivations de fase atrás de `championship.type === "cup"`. Ligas NÃO exibem chaveamento. Palpites de bônus/best-thirds ocultos para `league`. **A tabela de classificação de liga é a TASK-20** (task própria, não incluída aqui).
- Main modules/files likely involved: `src/server/worldcup/bracket.ts`, `src/features/worldcup/*`, `src/features/predictions/*` (bonus/best-thirds).
- Dependencies: TASK-05, TASK-09
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Split do checker — standings de liga saiu para TASK-20. Aqui fica só o gate de tipo.

### TASK-11 – Núcleo de scoring/recalc escopado por campeonato
- Type: domain
- Goal: Pontuar e recalcular rankings por campeonato (núcleo de domínio), sem tocar exposição/cron (TASK-21).
- Scope: Escopos por campeonato — `pool-{id}-{championshipId}-{dimensão}` onde a dimensão de fase só existe para `cup` (liga usa dimensão única). `recalc.ts` itera sobre campeonatos habilitados. **Scoring de liga NÃO aplica bônus/best-thirds** (só placar exato/parcial) — evita referenciar lógica Copa-only. **Verificar/ajustar chave idempotente de notificação** (`games-{uid}-{matchId}`) sob matchId namespaced para não colidir entre campeonatos ao vivo.
- Main modules/files likely involved: `src/server/rankings/recalc.ts`, `src/server/notifications/*`, scoring de `src/features/predictions/lib`.
- Dependencies: TASK-05, TASK-07, TASK-10
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Split do checker (era 8 SP). Não regredir escopos legados da Copa (`pool-{id}-geral`). Depende de TASK-10 pela forma do escopo cup-vs-league.

### TASK-12 – Ranking geral agregado (modo geral vs por-campeonato)
- Type: domain
- Goal: Implementar o modo "geral" que agrega pontos entre campeonatos habilitados.
- Scope: Agregação server-side dos escopos por campeonato → ranking geral do pool; alternância pela config `rankingMode`. Decidir soma bruta vs normalização (gap aberto do PRD) na spec. Exibição respeita o modo.
- Main modules/files likely involved: `src/server/rankings/*`, `src/features/rankings/*`, `api/rankings/pool`.
- Dependencies: TASK-11, TASK-21
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Reusa precedente `splitPhaseRanking` (abas). Frontend leve de exibição pode ser incluído.

### TASK-13 – Pipeline de arquivamento (snapshot → Firestore)
- Type: persistence
- Goal: Persistir o schedule completo de um campeonato finalizado no banco como fonte-da-verdade congelada.
- Scope: Detectar campeonato 100% `finished` → Admin SDK grava todas as partidas em `matches/{id}` (schedule completo, não só overrides) → **congela também o ranking/estatísticas finais** em snapshot dedicado (ex.: `history/{poolId}/{championshipId}`) para que mudanças futuras em recalc/pesos não alterem o histórico → marca `championship.status = "archived"`. Job/rota administrativa. (Índices/Rules de `matches` por `championshipId` já em TASK-05.)
- Main modules/files likely involved: novo `src/server/copaData/archive.ts`, `src/server/rankings/*` (leitura do ranking final), Route Handler admin, `firestore.rules`.
- Dependencies: TASK-05
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Definir gatilho de "finalizado" (gap do PRD) na spec. Volume de escrita — batch em chunks de 500.

### TASK-14 – Precedência de leitura para campeonatos arquivados (banco-first)
- Type: domain
- Goal: Servir campeonatos arquivados do banco, sem depender da ESPN.
- Scope: `getEffectiveMatches` ramifica por status: `archived` → lê snapshot do banco primeiro (ESPN ignorada); `live/upcoming` → ESPN + overlay. Rotas e cache respeitam. Fallback: arquivado sem snapshot → erro claro.
- Main modules/files likely involved: `src/server/copaData/matchSource.ts`, `worldcup/cache.ts`.
- Dependencies: TASK-13
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)

### TASK-15 – Seção Histórico (telas de campeonatos antigos)
- Type: application
- Goal: Área de "Histórico" que lista campeonatos arquivados com ranking/jogos/estatísticas congelados.
- Scope: Nova rota/telas de Histórico: lista de campeonatos `archived` + detalhe (ranking final, jogos, estatísticas do pool). Campeonatos arquivados saem da área ativa (seletor/jogos) e aparecem só no Histórico. Servido do banco. **is_frontend: true**.
- Main modules/files likely involved: nova feature `src/features/history/*` (ou sub de worldcup), rotas `src/app/(app)/historico/*`.
- Dependencies: TASK-14, TASK-12
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: pending
- Phases done: (none)
- Notes: Frontend → /ui-spec + /patterns:nextjs + /ui-review.

### TASK-16 – Cadastro auto-serviço → cria grupo → group_admin ativo
- Type: application
- Goal: Fluxo de onboarding público: usuário se cadastra criando um grupo, é auto-aprovado e vira group_admin de um pool ativo, sem gate super_admin.
- Scope: Novo caminho signup+create-group: cria `users/{uid}` `status: approved`, `role: group_admin`, `groupId`; cria `pools/{id}` `status: active`, `adminId: uid`, `allowInvites: true`; seta claims (`role`, `groupId`); gera link de convite. Coexiste com o fluxo moderado existente (não substitui). Ajuste em `promoteFirstAdmin` para não conflitar.
- Main modules/files likely involved: `src/app/api/groups/route.ts` (ou nova rota `signup-with-group`), `src/features/auth/*`, `functions/` (`promoteFirstAdmin`), `firestore.rules` (create pool), `middleware.ts`.
- Dependencies: TASK-07
- Story points: 8
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Atravessa 4 camadas de auth. Criador auto-aprovado; convidados NÃO (TASK-17). Rules de `pools` create hoje `if false` — só via Admin SDK.

### TASK-17 – Moderação de convidados pelo group_admin
- Type: application
- Goal: Membros que entram pelo link de convite ficam `pending` até aprovação do group_admin do grupo.
- Scope: Garantir que `redeem` de convite cria/associa user `status: pending` no pool; group_admin aprova/rejeita via console já existente (`api/group/users/*`). Notificação ao admin de novo pedido. Ajustar UX de convite para deixar claro que precisa aprovação.
- Main modules/files likely involved: `src/app/api/invite/[code]/redeem/route.ts`, `src/features/groupAdmin/*`, `src/features/auth/*` (invite flow), notifications factory.
- Dependencies: TASK-16
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: pending
- Phases done: (none)
- Notes: Grande parte já existe (fluxo de aprovação group_admin). Foco: garantir convidado nasce `pending` e admin é notificado.

### TASK-18 – Anti-abuso do cadastro público
- Type: integration
- Goal: Proteger o cadastro aberto contra spam/pools lixo antes do lançamento.
- Scope: Verificação de e-mail (Firebase email verification) e/ou rate-limit por IP na criação de grupo; bloquear criação de múltiplos pools por conta sem verificação. Sinalizar pools não verificados fora da busca.
- Main modules/files likely involved: `src/features/auth/*`, Route Handlers de signup/create-group, possivelmente Cloud Function/middleware.
- Dependencies: TASK-16
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Requisito de release, não opcional. Escopo mínimo viável decidido na spec (email verification é o piso).

### TASK-19 – Validação E2E + release readiness
- Type: test
- Goal: Validar o épico end-to-end e preparar rollout.
- Scope: Fluxo completo de um campeonato-piloto não-Copa: habilitar → palpitar → scoring/recalc → ranking (geral e por-campeonato) → arquivar → Histórico; cadastro auto-serviço → convite → moderação. Cron de scoring varrendo campeonatos ativos. Checklist de rollout (feature flag por pool, migração leve de docs legados).
- Main modules/files likely involved: testes de integração, `/local-env`, `/gate`, `.github/workflows/score-cron.yml`.
- Dependencies: todas
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Status: pending
- Phases done: (none)

### TASK-20 – Tabela de classificação de liga (pontos corridos)
- Type: domain
- Goal: Prover a superfície primária de resultados para campeonatos `type: "league"` (12 dos 23), que não têm chaveamento.
- Scope: Derivação server-side da classificação (J/V/E/D, saldo, gols, pontos) a partir das partidas do campeonato + tela de tabela. Substitui bracket para ligas. Cache tier reusado. Congela junto no arquivamento (TASK-13). **is_frontend: true**.
- Main modules/files likely involved: novo `src/server/leagues/standings.ts`, `src/features/worldcup/*` (ou nova sub-feature `leagueTable`), rota `api/leagues/standings`.
- Dependencies: TASK-05, TASK-10
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/high
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Bloqueador do plan-checker — sem isto, ligas ficam sem tela de resultados. Frontend → /ui-spec + /patterns:nextjs + /ui-review.

### TASK-21 – Exposição de ranking por campeonato + cron sweep
- Type: api
- Goal: Expor os rankings escopados por campeonato e fazer o cron de scoring varrer campeonatos ativos.
- Scope: Rotas `rankings/[scope]` e `rankings/pool` reconhecem a dimensão campeonato (mantendo compat com escopos legados da Copa). Cron GitHub Actions (`score-cron.yml`) itera campeonatos habilitados/ativos por pool. `/api/predictions/score` aceita/deriva o campeonato.
- Main modules/files likely involved: `src/app/api/rankings/*`, `src/app/api/predictions/score/route.ts`, `.github/workflows/score-cron.yml`.
- Dependencies: TASK-11
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: pending
- Phases done: (none)
- Notes: Split do checker (extraído da TASK-11). TASK-12 (geral agregado) depende deste.

## 4. Dependency map

- TASK-01 → (base do catálogo) → TASK-02
- TASK-02 → TASK-03, TASK-07
- TASK-03 → TASK-04
- TASK-02, TASK-03 → TASK-04
- TASK-03, TASK-04 → TASK-05
- TASK-05 → TASK-06, TASK-10, TASK-13, TASK-20
- TASK-06, TASK-07 → TASK-09
- TASK-07 → TASK-08, TASK-11, TASK-16
- TASK-05, TASK-09 → TASK-10
- TASK-05, TASK-07, TASK-10 → TASK-11
- TASK-10 → TASK-20
- TASK-11 → TASK-21
- TASK-11, TASK-21 → TASK-12
- TASK-13 → TASK-14
- TASK-14, TASK-12 → TASK-15
- TASK-16 → TASK-17, TASK-18
- todas → TASK-19

## 5. Recommended execution order

1. TASK-01 (spike — desbloqueia catálogo)
2. TASK-02 (schema + catálogo)
3. TASK-03 (matchId compat — risco crítico, cedo)
4. TASK-04 (ESPN parametrizado)
5. TASK-05 (matchSchema + fonte por campeonato + índices)
6. TASK-06 (rotas por campeonato)
7. TASK-07 (config no pool)
8. TASK-08 (dashboard campeonatos)
9. TASK-09 (seletor + segmentação)
10. TASK-10 (gate cup vs league)
11. TASK-20 (tabela de classificação de liga)
12. TASK-11 (núcleo scoring/recalc por campeonato)
13. TASK-21 (rotas de ranking + cron sweep)
14. TASK-12 (ranking geral agregado)
15. TASK-13 (arquivamento + congela ranking)
16. TASK-14 (leitura banco-first)
17. TASK-15 (Histórico)
18. TASK-16 (cadastro auto-serviço)
19. TASK-17 (moderação convidados)
20. TASK-18 (anti-abuso)
21. TASK-19 (validação E2E + release)

## 6. Planning risks and blockers

- **TASK-03 (matchId compat) — crítico**: qualquer vazamento de namespacing para a Copa invalida palpites/rankings legados. Blindar com snapshot antes de avançar.
- **TASK-01 (spike ESPN) — bloqueador externo**: depende de a API não-oficial servir cada slug; slugs que falharem saem do catálogo. Sem SLA.
- **TASK-11 (ranking por campeonato) — 8 SP**: task mais complexa; toca scoring, recalc, rotas e cron. Regressão da Copa é risco.
- **TASK-16 (onboarding) — atravessa 4 camadas de auth**: Rules, claims, middleware, functions. Precisa cuidado para não abrir brecha de auto-promoção.
- **TASK-18 (anti-abuso)**: depende de decisão de produto sobre piso de verificação; é requisito de release.
- **TASK-12 (ranking geral)**: gap aberto — soma bruta vs normalização entre campeonatos heterogêneos; decidir na spec.
- **Rollout**: recomenda-se feature-flag por pool (campeonatos habilitados default = só Copa) para lançar incrementalmente.
- Tasks candidatas a TDD: 02, 03, 04, 05, 07, 10, 11, 12, 13, 14, 16, 17, 20.
- **Correções do plan-checker aplicadas**: TASK-20 (standings de liga) e TASK-21 (rotas+cron) criadas; índices `matches` movidos p/ TASK-05; ranking congelado no arquivamento (TASK-13); TASK-11 agora depende de TASK-10 e trata idempotência de notificação + scoring de liga sem bônus; home aggregations explicitadas na TASK-09.
