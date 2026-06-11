# PLAN — Grupos e Eliminatórias (PRD-03.2)

> PRD: `ai/prd/grupos-eliminatorias.md` (v1.1, decisões 2026 travadas)
> Layout fonte de verdade: `docs/prd-03-1/prd-3-2.png`

## 1. Planning summary

8 tasks em 4 fases: contratos (schemas) → domínio puro (standings + bracket, ambos TDD) → exposição (rotas API + service/hooks) → UI (abas Jogos, tela Grupos, tela Eliminatórias). Backend não tem integração nova — tudo deriva de `src/server/copaData` existente. Maior risco concentrado em TASK-02 (desempate FIFA com confronto direto) e TASK-06 (refactor de tela testada). Frontend depende do backend pronto; dentro do frontend, abas primeiro, telas depois.

## 2. Recommended execution phases

- **Phase 1 – Foundation (contratos):** TASK-01
- **Phase 2 – Business rules (domínio puro):** TASK-02, TASK-03
- **Phase 3 – Exposure (API + data access):** TASK-04, TASK-05
- **Phase 4 – UI:** TASK-06, TASK-07, TASK-08

## 3. Tasks

### TASK-01 – Schemas e types do contrato worldcup
- Type: domain
- Goal: Contratos Zod + TS para standings e bracket — fonte única de verdade das respostas das rotas.
- Scope: `groupStandingSchema` (position, team {id,name,code,flagUrl}, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points, qualification: "classificado"|"possivel"|"eliminado"|"indefinido"), `knockoutMatchSchema` (id, phase: dezesseis-avos|oitavas|quartas|semifinal|terceiro|final, homeTeam/awayTeam {name resolvido ou placeholder label, flagUrl?, defined:bool}, homeScore?, awayScore?, status: aguardando|definido|encerrado), response schemas `GroupsResponse {groups: [{groupId, standings[]}]}` e `BracketResponse {roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final}`. Types derivados em `src/types`.
- Main modules/files likely involved: `src/schemas/worldcup.ts` (+`__tests__`), `src/types/worldcup.ts`, reuso de `src/schemas/shared.ts` (`stageSchema`).
- Dependencies: none
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (contratos/DTOs; schemas ganham testes padrão no /test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Alinhar `phase` ao `stageSchema` existente (slugs), não inventar enum paralelo. `is_frontend: false`.

### TASK-02 – Domínio: cálculo de classificação dos grupos
- Type: domain
- Goal: Função pura `computeGroupStandings(matches)` → standings por grupo com critério de desempate FIFA e status de classificação.
- Scope: Computar J/V/E/D/GP/GC/SG/PTS por seleção a partir dos jogos de grupo finalizados (só `finished`); ordenação: pontos → SG → GP → confronto direto (mini-tabela entre empatados) → fallback alfabético determinístico (fair play/sorteio não computáveis — documentar); **regra de qualification (travada):** grupo **incompleto** (algum jogo não-finished) → todas as posições `"indefinido"`; grupo **completo** → 1º/2º `"classificado"`, 3º `"possivel"` (melhores terceiros), 4º `"eliminado"`. 12 grupos A–L.
- Main modules/files likely involved: `src/server/worldcup/standings.ts` (+`__tests__`), consumo de `MatchWithId` (`stage === "grupos"`, `groupId`).
- Dependencies: TASK-01
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (cálculo + desempate multi-critério + head-to-head — regression-sensitive)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: Head-to-head é o ponto difícil: aplica-se ao subconjunto empatado, recursivo após separação parcial. Testes exaustivos: grupo zerado, parcial (→ tudo "indefinido"), completo (→ badges definitivos), empate triplo, empate total. Server-only mas lógica pura (sem I/O) p/ testabilidade.

### TASK-03 – Domínio: derivação do chaveamento
- Type: domain
- Goal: Função pura `deriveBracket(matches)` → confrontos eliminatórios agrupados por fase com estado e rótulos de placeholder.
- Scope: Filtrar `stage !== "grupos"`, agrupar nas 6 fases 2026 (dezesseis-avos 73–88, oitavas, quartas, semifinal, terceiro, final); resolver nomes reais via dados já mapeados; placeholders ("2A", "W74", "L101") → rótulo pt-BR ("2º Grupo A", "Vencedor Jogo 74", "Perdedor Jogo 101"); estado do confronto: aguardando (algum placeholder) | definido (times reais, não finalizado) | encerrado (placar final); ordenar por número do jogo.
- Main modules/files likely involved: `src/server/worldcup/bracket.ts` (+`__tests__`), `src/server/copaData/mapper.ts`/`teamRegistry.ts` (leitura — verificar o que o mapper já entrega de placeholder).
- Dependencies: TASK-01
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (mapeamento condicional de estados + parsing de placeholders)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Verificar primeiro como `mapOpenFootballMatch` representa placeholders hoje (pode já resolver parte). Empates com prorrogação/pênaltis: placar exibido = `ft` (+ indicação et/p se disponível — decidir no spec).

> **Changelog:** v1.1 — TASK-04 ganhou cache Firestore read-through (decisão do usuário no checkpoint da TASK-02; verificado que openfootball 2026 não publica classificação pronta). TASK-02/03 inalteradas (cômputo continua necessário).

### TASK-04 – Rotas API /api/worldcup/groups e /api/worldcup/bracket (cache Firestore read-through)
- Type: api + persistence
- Goal: Expor os dois cálculos de domínio como Route Handlers com cache Firestore read-through (decisão do usuário — não reprocessar + resiliência).
- Scope: Coleção server-only `worldcup_cache` (docs `groups` e `bracket`: `{ payload, computedAt, hasLiveGroupMatch }`), acesso só via Admin SDK; `firestore.rules`: `allow read, write: if false`. Fluxo da rota: (1) snapshot fresco (TTL 24h; 60s se `hasLiveGroupMatch`) → retorna payload; (2) stale/ausente → `fetchAllMatches()` + computa (TASK-02/03) + grava snapshot **best-effort** (falha de write não derruba o read) → retorna; (3) openfootball indisponível + snapshot existe → retorna snapshot stale (resiliência); (4) sem snapshot e sem fonte → `copaDataErrorResponse`. Rotas `dynamic = "force-dynamic"`; `Cache-Control: s-maxage` computado (24h/60s). Payload inclui `hasLiveGroupMatch` p/ client (TASK-05). Sem auth no handler (posture existente). Spark-safe: write só em cache miss.
- Main modules/files likely involved: `src/app/api/worldcup/{groups,bracket}/route.ts` (+`__tests__`), `src/server/worldcup/cache.ts` (helper Firestore read/write snapshot, +`__tests__`), `firestore.rules`, `src/server/cache/tiers.ts`.
- Dependencies: TASK-02, TASK-03
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (orquestração; testes de rota cobrem fluxos fresh/stale/fallback no /test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Espelhar padrão de `src/app/api/standings/route.ts` p/ shape de rota e `src/server/firebaseAdmin.ts` p/ Admin. `/api/standings` permanece intocado. Done criteria inclui medição cold-start ≤2s. SP 2→3 e criticality medium→high pela camada de persistência (alteração de checkpoint: cache Firestore).
- Main modules/files likely involved: `src/app/api/worldcup/groups/route.ts`, `src/app/api/worldcup/bracket/route.ts` (+`__tests__`), `src/server/cache/tiers.ts`.
- Dependencies: TASK-02, TASK-03
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (orquestração fina; testes de rota no /test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Espelhar padrão de `src/app/api/standings/route.ts` e `matches/route.ts`. `/api/standings` permanece intocado. Done criteria inclui medição de tempo de cômputo cold-start (`computeGroupStandings` sobre 104 matches) p/ critério ≤2s do PRD.

### TASK-05 – Service + hooks React Query
- Type: application
- Goal: Camada de data access client p/ groups e bracket com cache espelhado.
- Scope: `src/services/worldcup.ts` (fetch + parse Zod via `_apiClient`/`parseWithId`-style, erros tipados pt-BR `WorldcupServiceError`); hooks `useGroups()` (key `["groups"]`), `useGroupStandings(groupId)` — **decisão travada:** implementado como `useQuery` na key `["groups"]` + `select` (slice por grupo); `["group", groupId]` do PRD **não** vira cache entry separada (React Query `select` não muda a key; sem endpoint por grupo) — desvio documentado; `useBracket()` (key `["bracket"]`); `staleTime` de `STALE_TIME` (tiers 24h); quando payload tem `hasLiveGroupMatch: true` → `refetchInterval` 60s.
- Main modules/files likely involved: `src/services/worldcup.ts` (+`__tests__`), `src/features/worldcup/hooks/{worldcupKeys,useGroups,useBracket}.ts` (+`__tests__`).
- Dependencies: TASK-01, TASK-04
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (wiring de data access; padrão consolidado no projeto)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Keys exatamente como o PRD (`["groups"]`, `["group", groupId]`, `["bracket"]`).

### TASK-06 – Abas da área Jogos (Partidas | Grupos | Eliminatórias)
- Type: application (frontend)
- Goal: Navegação por abas na área Jogos com rotas URL e layout compartilhado.
- Scope: Layout compartilhado `src/app/(app)/matches/layout.tsx` com segmented control (3 abas, estado ativo por pathname); rotas novas `/matches/grupos` e `/matches/eliminatorias` (páginas placeholder até TASK-07/08); `/matches` segue sendo a lista (aba Partidas); título "sr-only" mantido; deep-link funcional; a11y (tablist/tab/aria-selected ou nav semântica). **Gate de regressão (travado):** (a) confirmar e testar que precedência de segmento estático do App Router resolve `/matches/grupos` vs `/matches/[id]` sem guard no page de detalhe; (b) suíte existente de MatchList/MatchDetail/`[id]` DEVE passar após introduzir o layout — critério de done.
- Main modules/files likely involved: `src/app/(app)/matches/layout.tsx`, `src/app/(app)/matches/{grupos,eliminatorias}/page.tsx`, `src/features/worldcup/components/WorldcupTabs.tsx` (+`__tests__`).
- Dependencies: none (estrutural; telas plugam depois)
- Story points: 3
- Criticality: medium
- Technical risk: medium (regressão em tela testada — MatchList/filtros)
- Recommended TDD later: no (UI/navegação; sem regra de negócio)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true`. Cuidado: rota dinâmica `[id]` em `/matches/[id]` — `grupos`/`eliminatorias` colidem? **Sim: `/matches/[id]` captura segmentos.** Rotas estáticas têm precedência sobre dinâmicas no App Router — confirmar no spec; alternativa é validar `id` no page de detalhe. Verificar suíte existente de MatchList passa após layout novo.

### TASK-07 – Tela Grupos (classificação)
- Type: application (frontend)
- Goal: UI da aba Grupos conforme layout `prd-3-2.png`: seletor de grupo, tabela de classificação, legendas e badges.
- Scope: Seletor de grupos A–L (default A; chips/scroll horizontal mobile-first); tabela `# Seleção P J V E D GP GC SG PTS` com bandeiras; badges: Classificado (1º/2º), Possível classificado (3º), Eliminado (4º), neutro p/ "indefinido"; legenda das colunas; **cria os componentes de estado compartilhados** `src/features/worldcup/components/{WorldcupSkeleton,WorldcupEmptyState,WorldcupErrorState}.tsx` com strings exatas do PRD ("Nenhuma informação disponível.", "Erro ao carregar informações.", "Tentar novamente") — TASK-08 importa, não duplica; responsivo 360→1024+ (colunas compactas mobile).
- Main modules/files likely involved: `src/features/worldcup/components/{GroupSelector,GroupStandingsTable,GroupsView,QualificationBadge,…}.tsx` (+`__tests__`), `src/app/(app)/matches/grupos/page.tsx`.
- Dependencies: TASK-05, TASK-06
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (renderização; regra de negócio já testada na TASK-02)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true`. Tabela 11 colunas em 360px é o desafio — layout image manda (abreviações, fonte compacta, possivelmente ocultar colunas secundárias no mobile só se a imagem indicar).

### TASK-08 – Tela Eliminatórias (chaveamento)
- Type: application (frontend)
- Goal: UI da aba Eliminatórias: fases empilhadas com cards de confronto e 3 estados.
- Scope: Seções por fase (Dezesseis-avos → Oitavas → Quartas → Semifinais → 3º Lugar → Final) em lista vertical mobile-first; card de confronto: bandeiras + nomes (ou rótulo placeholder), estado aguardando ("Aguardando definição") / definido (seleções) / encerrado (placar "Brasil 2 x 1 França"); estados skeleton/empty/error **reusando os componentes compartilhados criados na TASK-07** (`WorldcupSkeleton`/`WorldcupEmptyState`/`WorldcupErrorState`).
- Main modules/files likely involved: `src/features/worldcup/components/{BracketView,PhaseSection,KnockoutMatchCard}.tsx` (+`__tests__`), `src/app/(app)/matches/eliminatorias/page.tsx`.
- Dependencies: TASK-05, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (renderização)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true`. 32 jogos no R32 — lista vertical com seções colapsáveis? Decidir no ui-spec conforme layout image.

## 4. Dependency map

```
TASK-01 (contratos)
  ├─→ TASK-02 (standings)  ─┐
  ├─→ TASK-03 (bracket)    ─┼─→ TASK-04 (rotas API) ─→ TASK-05 (service/hooks) ─┬─→ TASK-07 (tela Grupos)
  └─────────────────────────┘                                                    └─→ TASK-08 (tela Eliminatórias)
TASK-06 (abas) ── independente ───────────────────────────────────────────────────→ TASK-07, TASK-08
```

## 5. Recommended execution order

1. TASK-01 — contratos
2. TASK-02 — standings (maior risco; atacar cedo)
3. TASK-03 — bracket
4. TASK-04 — rotas API
5. TASK-05 — service + hooks
6. TASK-06 — abas Jogos
7. TASK-07 — tela Grupos
8. TASK-08 — tela Eliminatórias

## 6. Planning risks and blockers

- **TASK-02 desempate head-to-head:** complexidade real (mini-tabela recursiva entre empatados). TDD obrigatório; maior SP do plano.
- **TASK-06 colisão de rota:** `/matches/[id]` vs `/matches/grupos` — precedência estática do App Router resolve; gate de regressão travado no scope da task (suíte existente deve passar).
- **Dados openfootball 2026 incompletos:** standings zerados e bracket 100% placeholder até o torneio — toda UI precisa ficar correta nesse estado (é o estado de produção no lançamento).
- **Cache dinâmico (jogo ao vivo → 1 min):** mecanismo travado na TASK-04 (force-dynamic + `Cache-Control` computado + flag `hasLiveGroupMatch` p/ client). Não há mais fallback silencioso.
- **Tabela 11 colunas em 360px (TASK-07):** risco de UX; layout image é a autoridade.
- **Sem blockers externos:** nenhuma dependência de terceiros nova, sem secret, sem Firestore. `copaDataErrorResponse` e o layout image (`docs/prd-03-1/prd-3-2.png`) verificados existentes.

## 7. Plan-checker pass

`gsd-plan-checker` executado (gate: 8 tasks + risco high). 2 blockers + 3 importantes — todos resolvidos e travados no plano: regra indefinido/possivel (TASK-02), gate de regressão de rota (TASK-06), mecanismo de cache dinâmico (TASK-04), componentes de estado compartilhados (TASK-07→08), semântica da key `["group", groupId]` (TASK-05). Minors verificados: `copaDataErrorResponse` existe; path do layout image correto.
