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
- Status: done
- Phases done: spec, tdd, implement, test, review
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
- Status: done
- Phases done: spec, implement, test, review
- Notes: Manter compat: sem `?championship=` → default `fifa.world` (não quebra clientes atuais). Review: PASS (gsd adversarial). Fixes aplicados: M1 (DEFAULT_CHAMPIONSHIP_ID único no catálogo, matchSource+championshipParam importam), L4 (espnSlug removido da projeção pública). Follow-ups abertos: **L2 — bracket gate é só cup/league; cups de temporada longa (needsPagination+cup: uefa.champions, libertadores, eng.fa) alcançam deriveBracket WC-shaped → território da TASK-10 (gate por tipo/derivations); mitigado por rollout flag (default só Copa habilitada).** L3 (params fora do try em matches/[id] — inalcançável, não corrigido).

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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Aditivo/retrocompatível. Teto `MAX_ENABLED_CHAMPIONSHIPS=10`, piso 1. Files: `schemas/pools.ts` (2 campos + `rankingModeSchema` + constantes), `types/pools.ts` (`RankingMode`), `lib/poolChampionships.ts` (novo — helpers), `api/group/settings/route.ts` (PATCH + enforcement pré-update). 104 testes verdes, tsc+eslint limpos. Review: **approved**. GSD adversarial sem blockers; WR-01 (leitura filtra catálogo — id retirado não escapa a jusante) e IN-01 (retorno é cópia, sem aliasing) aplicados + testados. Q1 teto=10 (ajustável); Q2 rules de `pools` update validam por role/ownership, sem allowlist de campo → nada a mudar.

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
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
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
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
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
- Status: done
- Phases done: spec, ui-spec, tdd, implement, test, review, ui-review
- Status-detail: concluída — gate cup/league em CompetitionTabs/BracketView/GroupsView/best-thirds + rota worldcup/groups. Review approved (3854/3854, tsc 0, eslint 0); ui-review approved.
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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Split do checker (era 8 SP). Não regredir escopos legados da Copa (`pool-{id}-geral`). Depende de TASK-10 pela forma do escopo cup-vs-league. REVIEW achou CR-01 (gsd): cups não-legados geram matchId BARE (mapper da Copa) → colidem com a Copa; scoring agora GATED a `type: "league"` (único path namespaced) — cups ficam fora até ids namespaced (foundation). Follow-ups abertos: MR-02 (score_state pode estourar 1MB com N ligas → sharding), LR-02 (notif de liga mostra id numérico do clube). RECALC_VERSION 4→5.

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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Reusa precedente `splitPhaseRanking` (abas). Frontend leve de exibição pode ser incluído. TASK-21 review (gsd MEDIUM-1): os parsers client em `src/services/rankings.ts` (`getRankingByScope`/`getPoolRanking`/`getPoolRankingByScope`) hard-codam `rankingSchema`/`poolRankingResponseSchema` (`.strict()`+enum bare) → NÃO parseiam a resposta por campeonato (scope namespaced + `championshipId`). Esta task DEVE adicionar branch de parse championship-aware (usar `championshipRankingSchema`/`ChampionshipRanking`) + response schema do pool antes de ligar `?championship` à UI. LOW-2: rota pool anexa flags Copa (`splitPhaseRanking`/`ignoreOvertimeGoals`/`primaryColor*`) na resposta escopada — definir contrato limpo aqui.

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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Review: approved with adjustments (opus/high + gsd-code-reviewer). CRÍTICO CR-01 CORRIGIDO+regressão: re-arquivamento após o sweep apagar `rankings/{cid}-geral`/`pool-*` regravava `history/*` como `[]` (perda de dados) → freeze agora usa fonte-ao-vivo-se-não-vazia SENÃO preserva o `history/*` congelado. Corrigidos: LR-01 (log de participante omitido), LR-02 (`getChampionshipStatus` degrada em erro de leitura), LR-03 (audit em try/catch próprio — não vira 500 após commit). Follow-ups NÃO-bloqueantes: MR-01 freeze batch não-chunkado estoura teto 500 se >~498 bolões habilitam o campeonato (escala limitada; chunk quebraria atomicidade); MR-02 `statistics/{uid}` é agregado global cross-campeonato (segue a spec §7.2 — revisar quando houver stats por-campeonato / TASK-15); HR-01 arquivar antes do recalc congela estado atual (pré-condição operacional: arquivar após scoring assentar; CR-01-fix garante que nunca DESTRÓI snapshot bom). Suíte 4014/4014, tsc 0, eslint 0.
- Decisions (spec TASK-13): **1-A** status dinâmico via doc Firestore `championships/{id}` + resolver async (`getChampionshipStatus`/`loadChampionshipStatuses`) sobre default estático do catálogo; `getChampionship` segue síncrono/imutável. **2-A** freeze = ranking pool + global-do-campeonato + recorte de statistics em `history/{championshipId}__{scopeKey}`, snapshot-ANTES-do-flip via WriteBatch atômico (freeze+status juntos; schedule chunkado antes). Gates de recalc + score-route passam a resolver status dinâmico p/ blindar re-scoring. Rota `POST /api/admin/championships/[id]/archive`. Spec: ai/spec/task-multi-championship-launch-13.md.
- Notes: Definir gatilho de "finalizado" (gap do PRD) na spec. Volume de escrita — batch em chunks de 500. HAZARD carregado da TASK-21 (gsd MEDIUM-2, ver memória `archived-ranking-cleanup-hazard`): o gate "ativo" da TASK-21 tira liga `archived` do `championshipUnion`, e o cleanup do recalc (`ownedByLivePool`/`isStaleChampionshipGlobal`) APAGA docs fora da união. Ao congelar o snapshot: OU gravar em coleção/doc separado que o cleanup nunca varre, OU proteger docs de campeonato cataloged-but-archived no cleanup. Decidir ANTES do freeze — senão o próximo `ensureRankingsFresh` apaga o ranking congelado.

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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Review: approved-with-adjustments (opus/high + gsd-code-reviewer adversarial). Branch por status em `getEffectiveMatches`: LIGA não-legada `archived`+snapshot → banco-first (ESPN skip, ordenado por kickoffAt); sem snapshot → erro claro; CUP não-legado e legado `fifa.world` → sempre ESPN+overlay. **H1 CORRIGIDO** (gsd): branch original só gateava por `legacyMatchId`, mas cups carimbam `championshipId:"fifa.world"`+id BARE (memória `cup-matchid-not-namespaced`) → `readPersistedMatches(cupId)` filtraria tudo → falso-throw permanente + colisão com Copa; fixture de teste (uefa.euro cup) mascarava = false-green. FIX: gate `type === "league"` (mesma precedência do scoring gated-a-league da TASK-11); cups arquivados seguem ESPN até namespacing de cup (foundation). **M4 CORRIGIDO**: snapshot ordenado por `kickoffAt` (doc-id namespaced é lexicográfico ≠ cronológico). Aceitos/documentados: M2/M3 (assimetria degrade-safe de `getChampionshipStatus` — contrato do épico; apagão Firestore degrada liga arquivada p/ ESPN best-effort, route cobre via stale), L1 (full-collection scan sem where — perf fora do v1), L2 (recalc de cup archived não estoura — resolvido pelo gate de tipo). Compat Copa blindada: A7 (legado não lê status) + T1–T8 verdes. Suíte 4023/4023, tsc 0, eslint 0.

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
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, implement, test, review, ui-review
- Review: aprovado-com-ajustes. Corrigidos: gsd-H1 (detalhe /api/history/[id] não tinha gate de habilitação por pool → membro do pool A deep-linkava campeonato só do pool B e recebia snapshot __geral cross-pool; agora gate `getEnabledChampionships(pool).includes(id)` antes de status/history; groupId sempre da sessão) + guard-test H1; L1 (hasPoolSnapshot via safeParse, não existência crua); L2 (FrozenMatchList sinaliza erro de useTeams sem esconder placares); UI-review MEDIUM (h1 duplicado → h2 em HistoryLanding/HistoryDetail; layout já provê h1). RankingView extraído verificado byte-idêntico (sem regressão ranking ativo). Frozen não hidratado. Testes: 19 rota + 19 componente verdes (JSON), tsc 0. SEGMENTAÇÃO §3/§6.5/§10 RESOLVIDA (caminho A aprovado pelo usuário): helper puro `filterActiveChampionships(enabled, statuses)` em `poolChampionships.ts` + wire em `/api/group/championships` (carrega `loadChampionshipStatuses`, remove archived da área ativa). PROTEÇÃO ANTI-VAZIO: se filtrar zerar (pool Copa-only legado, `fifa.world` archived-default), devolve o conjunto original → seletor/jogos/palpites nunca ficam vazios; pool Copa-only segue servindo Copa até optar por campeonato novo (TASK-16). Fluído por `ActiveChampionshipProvider` (fonte única) → cobre seletor+jogos+palpites+ranking ativo. Testes §9: 5 unit de `filterActiveChampionships` + 2 de rota atualizados (segmenta archived / anti-vazio). Suíte COMPLETA 4066/4066, tsc 0, eslint 0.
- Notes: Frontend → /ui-spec + /patterns:nextjs + /ui-review. Rota final = /rankings/historico[/id] (sub-seção Ranking, não /historico standalone — ruling bottom-nav-limit). Implement: 19 novos + 4 modificados; RankingView extraído p/ `rankings/components/RankingView.tsx` (reuso sem regressão); rotas /api/history + /api/history/[id] (auth→groupId sessão, banco-first, sem hydrate); tsc 0, eslint 0.

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
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: Atravessa 4 camadas de auth. Criador auto-aprovado; convidados NÃO (TASK-17). Rules de `pools` create hoje `if false` — só via Admin SDK. SPEC: rota net-new `POST /api/signup/create-group` (Admin SDK, idToken-auth p/ user novo); guarda em `promoteFirstAdmin` (no-op se role já canônico privilegiado — evita clobber); claims `{role:group_admin, groupId}` gravados na rota (1ª gravação real de groupId no token — desbloqueia Rule de invites); sem mudança em rules/middleware; is_frontend: tela "Criar grupo". Open Q: Q1 default Copa, Q2 client cria Auth+idToken, Q3 super_admin seed manual.

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
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: Grande parte já existe (fluxo de aprovação group_admin). Foco: garantir convidado nasce `pending` e admin é notificado. SPEC: convidado JÁ nasce `pending` (services/auth signUp) → task foca notificação ao admin no `redeem` (factory `notifyJoinRequest` type:system, id determinístico `system-joinreq-{groupId}-{uid}`, best-effort pós-redemption-nova) + copy de aprovação na landing `/invite/[code]`. is_frontend:true (copy enxuta). REVIEW: aprovado (gsd + manual, 0 crit/high). Limitação conhecida (follow-up TASK-18/19): id determinístico `system-joinreq-{groupId}-{uid}` suprime re-notificação após reject(→blocked)+re-convite do MESMO user; só dispara com guard de redemption p/ user blocked (fora de escopo TASK-17). Redeem não checa pool `status:blocked` (gap pré-existente TASK-04/16).

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
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: Requisito de release, não opcional. Escopo mínimo viável decidido na spec (email verification é o piso). TDD aplicado (override do `tdd: N/A` — lógica de autorização/gating é regressão-sensível): RED→GREEN em create-group gate + activate-pool. Review: gsd-code-reviewer achou 1 blocker (BR2 409 "Você já possui um grupo." mal-classificado como slug-taken no client) → corrigido em `onboarding.ts` + teste de regressão. Residuais documentados: loop de promoção não-atômico (mascarado por BR2 ≤1 pool; follow-up WriteBatch), roteamento de erro por substring (mitigado; follow-up kind machine-readable), sem "reenviar e-mail" (spec Q2 fora do MVP). 111 files / 343 tests green, tsc exit 0. SPEC: piso = email verification; pool de conta não-verificada nasce `status:pending` (já fora da busca), limite 1 pool/conta (409), nova rota `POST /api/signup/activate-pool` promove pending→active pós-verificação (botão "Já verifiquei"). IP rate-limit/CAPTCHA/App Check = follow-up documentado (sem infra). is_frontend:true.

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
- Status: done
- Phases done: spec, implement, test, review
- Notes: TDD skipped (validação/observabilidade, sem regra de negócio nova — plan já marcava tdd:N/A; asserções no /test). Gap E2E encontrado e corrigido: `POST /api/predictions/score` não retornava `championshipsProcessed` apesar do contrato documentado em `score-cron.yml`. Campo aditivo = 1 (Copa) + ligas ativas com fetch OK; presente nas duas saídas 200. gsd-code-reviewer pegou BLOCKER real: 2 testes pré-existentes (`route.test.ts`, `route.notifications.test.ts`) faziam strict-`toEqual` da forma antiga → quebraram; corrigidos. Também: comentário stale do cron YAML atualizado, spread duplicado `[...leagueIds]` materializado 1×. Gate final: lint exit 0, vitest 4124/4124 (1280 files), next build exit 0, tsc --noEmit exit 0. Checklist formal de rollout fica no Stage 5 /release.

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
- Status: done
- Phases done: spec, ui-spec, tdd, implement, test, review, ui-review
- Status-detail: concluída — domínio computeLeagueStandings (TDD 8 casos), rota api/leagues/standings (gate league-only + cache read-through + resiliência stale por-fetch), extractLeagueTeamDisplay (ESPN), frontend LeagueTableView/LeagueStandingsTable/aba Classificação/StandingsLegend. Review approved-with-adjustments: H-1 (logo ESPN inválido quebrava z.url na rota) corrigido via sanitizeCrestUrl TDD; M-1/M-2 (compute+parse fora do try do fetch) corrigidos; ui-review L-A (caption sr-only sem campeonato) corrigido. Suíte 3987+ verde, tsc 0, eslint 0.
- Notes: Bloqueador do plan-checker — sem isto, ligas ficam sem tela de resultados. Frontend → /ui-spec + /patterns:nextjs + /ui-review. SPEC: display de clube NÃO vem de registry (clubes fora do TEAM_REGISTRY) → extrair name/crest dos competidores ESPN (add `logo` ao espnTeamSchema); tabela única pts→saldo→gols-pró→nome (sem H2H); reusa cache worldcup (chave `standings:{id}`); gate `type==="league"`; aba "Classificação" liga-only.

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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Split do checker (extraído da TASK-11). TASK-12 (geral agregado) depende deste. SPEC achou gap real: `rankingSchema` (`.strict()` + enum bare) NÃO parseia os docs `{id}-geral` da recalc §7.5 (scope namespaced + campo `championshipId`) → precisa `championshipRankingSchema` dedicado. Gate "ativo" = `status !== "archived"`. Cup escopável → `null` (não 400). REVIEW (opus + gsd adversarial): approved with adjustments. Invariantes core verificadas (compat byte-idêntica, sem vazamento multi-tenant, sem injeção no doc-id, gate correto/não-invertido). 4 achados, TODOS follow-up fora do escopo desta task: MEDIUM-1 (parsers client não championship-aware → TASK-12), MEDIUM-2 (cleanup apaga docs de liga archived → TASK-13, memória `archived-ranking-cleanup-hazard`), LOW-1 (helper não valida `scope` internamente — defense-in-depth; callers já validam), LOW-2 (flags Copa na resposta escopada → TASK-12). Verificação: tsc=0, vitest 3897/3897, eslint clean.

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
