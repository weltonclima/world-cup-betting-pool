# PRD — Integração API-Football via Route Handlers (Fundação)

> Fonte de verdade: **PRD-07 v2.0** (`docs/prd-07/PRD-07-Administracao-Copa.md`) + **PRD-07.1** (`docs/prd-07-1/PRD-07.1-Arquitetura-Administrativa-v2.md`).
> Decisão de hosting: **Firebase App Hosting** (Opção A, confirmada).
> Esta feature precede e reescreve a camada de dados de Home (PRD-02) e Jogos (PRD-03).

## 1. Resumo da feature

Trocar o modelo de dados da Copa de **Cloud Functions → Firestore → Frontend** para **Frontend → Next.js Route Handlers → Cache → API-Football** (PRD-07 v2.0). Dados da Copa (`matches`, `teams`, `groups`, `standings`, `fixtures`) deixam de ser persistidos no Firestore e passam a ser servidos ao vivo por Route Handlers do Next.js, com cache em dois níveis (servidor + React Query) por faixas de frescor. Firestore mantém só dados do bolão (`users`, `predictions`, `rankings`, `notifications`, `system_logs`).

Inclui migração obrigatória de deploy: sair de **static export** para **Firebase App Hosting** (Cloud Run / SSR), pois Route Handlers e Middleware exigem runtime de servidor.

## 2. Escopo consolidado

### Dentro do escopo
- **Migração de deploy**: remover `output: "export"`; configurar Firebase App Hosting (`apphosting.yaml`); chave API-Football como secret.
- **Route Handlers** (`src/app/api/*`): proxy server-side da API-Football com cache por tier — partidas (lista + por id), seleções, grupos/standings.
- **Camada de integração no servidor**: mover `apiFootball/{client,mock,factory,types,config}` + `mappers/{matchMapper,teamMapper}` de `functions/` para `src/` (server-only), reutilizando schemas Zod de `src/schemas`.
- **Camada de dados client-side**: serviços e hooks React Query que consomem `/api/*` (substituem leituras Firestore de matches/teams).
- **Cache strategy** (PRD-07): servidor via `fetch(..., { next: { revalidate } })` + cliente via React Query `staleTime`, faixas: Grupos 24h, Seleções 24h, Jogos futuros 6h, Jogos do dia 30min, Ao vivo 1min, Encerrados 5min (6h iniciais).
- **Middleware** (`middleware.ts`): proteção server-side de `/admin/*` por `role===admin` (PRD-07.1).
- **Correções de schema drift** (necessárias p/ dado real): `stageSchema` + `"terceiro"`; mapper de `"3rd Place Final"`; mapear `venue`, `round`, `groupId` em `mapApiFixtureToFirestore`; estender `types.ts` (FixtureResponse com venue/league.group) e mock.
- **Rework da camada de dados da Home** (PRD-02): repontar `useNextMatch`/`useRecentResults`/`useTeams` para `/api/*`.
- **Descarte controlado**: remover sync de matches/teams das Functions (`syncTeams`, parte de `scheduledSync`, `writeMatches`, writer de matches/teams).

### Fora do escopo (outros PRDs / feature seguinte)
- UI das telas de Jogos (PRD-03) — só a camada de dados é ajustada aqui; telas seguem no PRD-03.
- Cálculo de ranking (CF a cada 2h) — **mantida**, mas sua fonte de resultados muda (ver §4); implementação fina fica no PRD de ranking/admin.
- Painel admin (monitoramento API, logs) — PRD-07 propriamente; aqui só o middleware de acesso.
- Renomear rotas en→pt (`/matches`→`/jogos`) — ver ambiguidade A4 (não bloqueia).

### Precedência
PRD-07 v2.0 ("Arquitetura Revisada") **sobrepõe** PRD-00 e o trecho de PRD-03 que dizia "consulta apenas Firestore". O contrato de leitura do front passa a ser `/api/*` (que internamente fala com API-Football). A regra "frontend nunca chama API-Football direto do browser" continua válida — o Route Handler é server-side.

## 3. Entendimento do sistema (partes relevantes)

| Artefato | Estado | Destino nesta feature |
|---|---|---|
| `next.config.*` `output:"export"` | static | **remover export** (SSR) |
| `firebase.json` hosting `public:"out"` | CDN estático | substituir por App Hosting (`apphosting.yaml`) |
| `functions/src/apiFootball/*` | client HTTP+mock+factory+types+config prontos | **mover p/ `src/server/apiFootball/`** (reuso nos Route Handlers) |
| `functions/src/mappers/*` | matchMapper/teamMapper prontos e testados | **mover/compartilhar** p/ `src/`; corrigir drift (terceiro, venue, round, group) |
| `functions/src/firestore/writer.ts` | writeTeams/writeMatches | **remover** writeMatches/writeTeams (não persiste mais) |
| `functions/src/functions/syncTeams.ts`, `scheduledSync.ts` | sync→Firestore | **remover** sync de matches/teams; CF de ranking permanece (a criar/manter) |
| `functions/src/shared/schemas.ts` | cópia drift dos schemas | **eliminar duplicação** — usar `src/schemas` como fonte única (decidir mecanismo no plano) |
| `src/services/matches.ts` (Firestore) | lê matches do Firestore | **reescrever**: fetch `/api/matches` |
| `src/services/teams.ts` (Firestore) | lê teams do Firestore | **reescrever**: fetch `/api/teams` |
| `src/features/home/hooks/use{NextMatch,RecentResults,Teams}.ts` | React Query→Firestore | repontar p/ `/api/*` |
| `src/components/layout/AdminGuard.tsx` | guard client | complementar com `middleware.ts` server-side |
| `src/schemas/{matches,teams,shared}.ts` | fonte dos tipos | corrigir/confirmar (terceiro já existe no front; venue/round já existem) |

Observação: o **frontend** já tem `terceiro`/`venue`/`round` no schema; quem está defasado é a cópia em `functions/`. Ao mover os mappers p/ `src/` usando `src/schemas`, o drift some.

## 4. Análise de impacto técnico

### Deploy / infra (alto impacto)
- Remover static export → app passa a ter runtime server (Cloud Run via App Hosting). Build/CI mudam. `out/` deixa de existir; artefato vira servidor Next.
- `API_FOOTBALL_KEY` → secret do App Hosting (não `NEXT_PUBLIC_`). Lida só no Route Handler.
- Cold start do Cloud Run (escala a zero): primeira request após ociosidade ~1-2s. Aceitável p/ <100 users; mitigar com cache.

### Route Handlers + cache
- `GET /api/matches` (todas), `GET /api/matches/[id]`, `GET /api/teams`, `GET /api/groups` (ou `/api/standings`).
- Cada rota: `getApiFootballClient().getX()` → mapper → valida com Zod (`src/schemas`) → JSON. `revalidate` por tier.
- **Tier dinâmico p/ partidas**: o valor de cache depende do status/data do jogo (futuro 6h / do dia 30min / ao vivo 1min / encerrado 5min). Implica segmentar requests ou aplicar revalidate por subconjunto — decisão de design no plano.
- Cliente: React Query `staleTime` espelha o tier; chaves de query por recurso.
- **Cache de servidor = Next.js nativo** (decisão travada): `fetch(apiFootballUrl, { next: { revalidate: <tier> } })` dentro do Route Handler. Sem cache em Firestore. Aceita-se o caveat de instâncias frias do Cloud Run (R2) e monitora-se a cota.

### Mappers / schema
- Corrigir `ROUND_TO_STAGE_MAP` (+`"3rd Place Final"`→`terceiro`), `STATUS_MAP` (revisar), e mapear `venue`/`round`/`groupId` (FixtureResponse precisa expor `fixture.venue` e `league.round`/grupo). Estender `types.ts` e mock.
- Schema único: `src/schemas` como verdade; mappers server importam dele. Eliminar `functions/src/shared/schemas.ts` (se ranking CF precisar, consome via pacote/cópia controlada — decidir no plano).

### Ranking CF (mantida, fonte muda)
- Ranking processa resultados oficiais a cada 2h. Como `matches` não está no Firestore, a CF de ranking passa a **buscar resultados da API-Football** (reusa o client server-side) ou chama um endpoint interno. Define-se no PRD de ranking; aqui só registramos a dependência e mantemos o client acessível à CF.

### Home (PRD-02) / Jogos (PRD-03)
- Home: hooks de matches/teams repontados a `/api/*`; helpers puros (joins, isCorrect, status) **inalterados**.
- Jogos (PRD-03): plano existente (`ai/plan/jogos.md`) — TASK-01 (services Firestore) e TASK-04 (hooks) **mudam** p/ `/api/*`; TASK-02/03 (helpers puros de status/filtro) **permanecem válidos**. Revisar o plano do PRD-03 após esta fundação.

### Segurança
- Chave API só server-side (Route Handler). Auth admin (A3/R3): session cookie httpOnly + custom claim `role` + `jose` no middleware; enforcement em API Routes (Admin SDK) + Firestore Rules. Novo Route Handler `/api/auth/session`; claim `role` escrito no fluxo de aprovação.
- Firestore Rules inalteradas p/ users/predictions/rankings.

## 5. Riscos

1. **Migração de hosting** (R1, alto): sair de static export quebra o pipeline de deploy atual; precisa configurar App Hosting + secret + testar SSR. Possíveis ajustes em `next/image`, env, rotas.
2. **Cache de servidor com escala a zero** (R2, médio, ACEITO): usando Next.js `revalidate` nativo (decisão A2). Em Cloud Run com escala a zero o data cache não é garantidamente persistente entre instâncias frias → instância nova pode revalidar antes do tier → mais chamadas à API-Football (cota). Decisão: aceitar e **monitorar cota**; reavaliar cache persistente só se a cota apertar.
3. **Middleware + Firebase Auth** (R3, médio, RESOLVIDO A3): modelo travado = session cookie httpOnly (Admin SDK no `/api/auth/session`, Node/Cloud Run) + custom claim `role` + verificação JWT com `jose` no middleware (edge; `firebase-admin` não roda lá) + enforcement em API Routes (Admin SDK) e Firestore Rules. Inclui escrever claim `role` no fluxo de aprovação (estender `promoteFirstAdmin`) e nova dep `jose`.
4. **Cota API-Football** (R4, médio): tier "ao vivo 1min" × muitos jogos simultâneos pode estourar cota do plano. Validar limites do plano contratado.
5. **Dependência da CF de ranking na nova fonte** (R5): ranking precisa de resultados; sem Firestore matches, redesenhar a fonte. Não bloqueia esta fundação, mas acopla.
6. **Mock vs real** (R6): sem `API_FOOTBALL_KEY`/IDs Copa 2026 confirmados, rotas servem mock (factory já faz fallback). Dado real depende de credenciais.
7. **Trabalho descartado** (R7): código de sync Firestore (PRD-02 TASK-03/04) vira morto — remover com cuidado p/ não quebrar Home.

## 6. Ambiguidades e lacunas

| # | Item | Lacuna | Sugestão |
|---|---|---|---|
| A1 | Endpoint de grupos/standings | PRD lista ambos; API tem `/standings` | Expor `/api/standings` e derivar grupos, ou `/api/teams` com `group` |
| A2 | Cache de servidor | ~~mecanismo~~ **RESOLVIDO** → Next.js `revalidate` nativo (sem Firestore). Monitorar cota. | — |
| A3 | Middleware auth | ~~como validar role~~ **RESOLVIDO** → session cookie httpOnly + custom claim `role` + verificação `jose` no middleware; enforcement real em API Routes (Admin SDK) + Firestore Rules | — |
| A4 | Rotas en vs pt | código `/matches`, PRD `/jogos` | Não bloqueia; alinhar depois (decisão de produto) |
| A5 | Tier dinâmico de partidas | como segmentar revalidate por status | Plano: rota única com revalidate curto vs múltiplas chaves |
| A6 | IDs Copa 2026 + chave | placeholders / ausentes | Confirmar leagueId/season; mock até lá |
| A7 | Local dos schemas compartilhados | front vs functions | Plano: pacote compartilhado vs mover mappers p/ src e CF consumir cópia |

## 7. UI/Layout impact

- **UI Impact:** no (feature de fundação/dados). Não cria nem altera telas diretamente.
- **Platforms:** n/a
- **Screens:** none (habilita Home/Jogos a carregarem dados reais)
- **Product type:** n/a
- **Recommended style direction:** n/a
- **Design complexity:** n/a

> Sem `/screen`. As telas que consomem esta camada (Home/Jogos) têm seus próprios PRDs.

## 8. Preocupações de implementação (alto nível)

- Ordem segura: (1) mover integração p/ `src/server` + corrigir mappers/schema → (2) Route Handlers + cache → (3) repontar serviços/hooks (Home) → (4) migração de hosting/secret → (5) middleware → (6) remover código morto de sync.
- Manter mappers como funções puras testáveis (já são); cobrir os casos novos (venue/round/group/terceiro) com testes.
- Route Handlers validam saída com Zod antes de responder (contrato estável p/ o front).
- React Query: `staleTime`/`gcTime` por tier em arquivo de constantes (sem hardcode espalhado).
- TS strict, sem `any`; chave API jamais exposta ao browser.
- Revisar `ai/plan/jogos.md` (TASK-01/04) e camada de dados do PRD-02 após esta fundação.
- Não quebrar Home durante a transição: trocar fonte de dados atrás dos mesmos hooks/contratos.
