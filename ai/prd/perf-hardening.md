# PRD — Performance Optimization & Security Hardening

## 1. Feature summary

Correção de bugs de performance, otimização de renderização e hardening de segurança no Bolão dos Parças. O app sofre de lentidão perceptível nas telas Home e Jogos causada por complexidade algorítmica desnecessária, falta de memoization e estratégia de refetch excessivamente agressiva introduzida pela feature `feat/auto-refresh-on-return`. Adicionalmente, há pontos de hardening de segurança para reforçar antes de tráfego de Copa do Mundo.

---

## 2. Consolidated scope

> Achados abaixo consolidados de auditoria rígida em 3 frentes paralelas (bugs de correção, segurança, performance), cada finding verificado lendo o código-fonte (arquivo:linha citado).

### 2.0 Bugs de correção (verificados)

**B1 — `scorePrediction` ignora pênaltis → 0 pts para quem acertou o classificado (ALTO)**
- Localização: `src/features/predictions/lib/predictionsHelpers.ts:163-167`, aplicado em `src/server/rankings/recalc.ts:271` a todas as fases
- `scorePrediction` deriva resultado só do sinal de `homeScore − awayScore` do tempo normal. Invariante do projeto mantém jogo de pênaltis empatado (ex.: 1-1) com shootout em campos separados (`homeShootout`/`awayShootout`), `advanceSide` guardado — **nunca consultados** por `scorePrediction`
- Cenário: oitava 1-1 decidida nos pênaltis (`advanceSide="home"`). Usuário previu 2-1 (acertou quem avançou): `predictionSign=+1`, `matchSign=0` → `wrong`, 0 pts. A regra "acertou vencedor = 5" fica **inalcançável** em jogos de pênaltis
- Impacto: todos os mata-mata por pênaltis pontuam ~0 para quase todos → injustiça no ranking de eliminatórias/geral. (Prorrogação NÃO afetada — score já inclui gols do ET)

**B2 — `usePredictions` (feature predictions) com queryKey sem uid → cache leak entre contas (MÉDIO, fix barato)**
- Localização: `src/features/predictions/hooks/usePredictions.ts:24` + `predictionsKeys.ts:15`
- `queryKey: ["predictions"]` (sem uid), mas `queryFn` chama `listPredictionsByUid(uid!)`. Irmã de matches faz certo (`["matches","predictions",uid]`)
- Cenário: navegador compartilhado, A faz logout, B faz login sem recriar QueryClient → B vê palpites de A por até 30min (staleTime). Alimenta `usePredictionsList`, `useGroupPredictions`, página de mata-mata

**B3 — `todayKey` memoizado com `[]` fica obsoleto após meia-noite (BAIXO)**
- `MatchList.tsx:137`: sessão longa cruzando meia-noite → aba "Hoje" mostra jogos de ontem até remount

**B4 — `groupProfilePredictions` emite 12 grupos incluindo vazios (BAIXO, apresentação)** — `profilePredictionsGrouping.ts:59-66`

**B5 — `derivePredictionsCount.made` pode exceder `ofTotal` (BAIXO, apresentação)** — `profileComparison.ts:52-55`

### 2.0.1 Segurança (verificados)

**S1 — `predictions/[uid]` vaza palpites cross-tenant (MÉDIO)**
- Localização: `src/app/api/predictions/[uid]/route.ts:42-96`
- Autoriza o leitor via `requireApprovedUser()` e lê palpites do `targetUid` do path, filtrando só jogos `finished`. **Sem checagem de que alvo pertence ao mesmo pool do leitor**
- Cenário: participante do pool A faz `GET /api/predictions/<uid-do-pool-B>` → recebe todos os palpites finished daquele usuário. Contradiz a própria Rule A5 ("histórico privado"); todo o resto do código isola tenant rigorosamente
- Mitigadores: só jogos finished (baixa sensibilidade pós-kickoff), requer conhecer uid. Fix: exigir `targetUid` compartilhar `groupId` (ou ser admin)

**S2 — Redeem de convite sem idempotência → DoS de integridade (BAIXO)**
- `invite/[code]/redeem/route.ts:79-108`: incrementa `usedCount` sempre que `userGroupId === invite.groupId`, sem marcar quem já resgatou. Membro do pool chama em loop até `usedCount >= maxUses` → desativa o convite ativo, bloqueia novos participantes

**S3 — `predictions/score` e `rankings/recalc`: fallback de sessão sem re-check `status` + só role legado (BAIXO)**
- `predictions/score/route.ts:151-163`, `rankings/recalc/route.ts:46-53`: checam `role !== "admin"` sem `status==="approved"` e sem aceitar `super_admin` canônico. `admin` blocked ainda dispara; super_admin canônico rejeitado (fail-closed)

**S4 (INFORMATIVO) — session cookie emitido para não-aprovado** — `auth/session/route.ts:74-88`. Compensado downstream (todo gate re-lê status). Cookie `__session` = `httpOnly` + `secure` prod + `sameSite:lax` — **adequado** (S1 do PRD original refutado)

> Postura geral de segurança SÓLIDA: `groupId`/`uid`/`role` sempre da sessão, isolamento multi-tenant em todo `group/*`, WebAuthn com challenge single-use + origin validation, lock temporal server-side, secrets em `timingSafeEqual`. **Sem vulnerabilidades críticas ou altas.**

### 2.1 Bugs de performance (críticos)

**P0 — `/api/matches` baixado e validado com Zod 3× na Home (MAIOR GARGALO)**
- Localização: `useNextMatch.ts` + `useRecentResults.ts` + `useMatches.ts` — três query keys distintas, cada `queryFn` chama `listMatches()` (`services/matches.ts:49-55,82,107`)
- O comentário em `useHomeDashboard.ts:90-91` ("React Query deduplica") é **FALSO**: dedup é por query key, e as keys diferem (`["home","next-match"]`, `["home","recent-results"]`, `["matches","list"]`)
- Impacto: 3× bytes na rede + 3× parse Zod (`z.array(z.unknown()).parse` + `.map(parseMatchWithId)`) do MAIOR payload do app, no main-thread. Provável maior contribuinte isolado de latência da Home
- Fix: derivar `nextMatch`/`recentResults` do `matchesListData.flatList` já carregado (o app já faz isso p/ `openMatches` e banner), OU usar `select` sobre a mesma key `matchesKeys.list()`

**P0b — `teams` e `predictions` baixados 2× na Home (namespaces duplicados)**
- `home/hooks/useTeams` (`["home","teams"]`) vs `matches/hooks/useTeams` (`["matches","teams"]`); idem predictions. `useHomeDashboard` chama ambos + `useMatchesList` (que chama os de matches). `listAllTeams()` roda 2×, `listPredictionsByUid` 2×
- Somado a P0: ~5 das 11 requisições da Home são redundantes

**P0c — Waterfall de auth bloqueia início de todos os fetches**
- `AuthProvider.tsx:119-168`: nenhuma query dispara antes de `authPersistenceReady` → `onAuthStateChanged` → `getDoc(users/{uid})`. Tudo client-side. teams/matches (não dependem de uid) poderiam iniciar em paralelo à auth

**P1 — O(n²) em `deriveMatchPredictionStatus`**
- Localização: `src/features/matches/lib/matchesHelpers.ts:269` + `src/features/matches/hooks/useMatchesList.ts:143`
- `useMatchesList` constrói `predMap` (Map) na linha 121, mas na linha 143 chama `deriveMatchPredictionStatus(match, predictions, now)` passando o **array completo** de predições
- Dentro de `deriveMatchPredictionStatus`, `predictions.some((p) => p.matchId === match.id)` faz scan O(n) para cada partida
- Com 64 partidas e 64 predições: **4.096 iterações** por render em vez de 64

**P2 — Pipeline de filtros não memoizado em `MatchList.tsx`**
- Localização: `src/features/matches/components/MatchList.tsx:174–214`
- `searchItemsByName`, filtros de stage/teamId/predictionStatus, temporal bucket, `regroupFilteredItems`, `orderedGroups` e criação de `new Set(...)` executam **síncronos a cada render**
- Um keystroke na busca ou qualquer mudança de estado local dispara todo o pipeline (5 filters + 2 set ops + reverse)

**P3 — `buildTeamMap` sem memoization**
- Localização: `useMatchesList.ts:120`, `useHomeDashboard.ts:168`
- Cria um `new Map(...)` novo em cada render — não é custoso por si só mas propaga instâncias instáveis para derivações downstream

**P4 — `recentResults` usa `predictions.find()` por resultado**
- Localização: `useHomeDashboard.ts:224`
- Loop `recent.flatMap(...)` com `.find()` interno: O(n×m) onde n = recent results, m = predictions totais
- `predMap` já existe em `useMatchesList` mas não está disponível no contexto de `useHomeDashboard`

**P5 — `new Date(match.kickoffAt)` instanciado em loop quente**
- Localização: `matchesHelpers.ts:267`
- Objeto `Date` criado por chamada dentro de `deriveMatchPredictionStatus`, chamado N vezes por render

### 2.2 Problema de UX/perf: renderização all-or-nothing

**P6 — `isLoading` agregado bloqueia todas as 11 queries**
- `useHomeDashboard.ts:110`: `isLoading = queries.some((q) => q.isLoading)`
- Se ranking (dependente de Firestore) demora 3s mas teams/settings carregam em 200ms, o usuário vê TODOS os cards em skeleton por 3s
- `rankingGruposQuery` e `rankingEliminatoriasQuery` estão no array mesmo quando `enabled: false`; no TanStack Query v5 disabled queries têm `isLoading: false`, mas o padrão bloqueia toda adição futura de queries lentas

### 2.3 Estratégia de refetch excessivamente agressiva

**P7 — `refetchOnWindowFocus: "always"` global + `refetchOnMount: "always"` em 5 hooks**
- `QueryProvider.tsx:21`: `refetchOnWindowFocus: "always"` — toda volta de aba dispara TODAS as queries em paralelo (11 na home)
- `useRanking`, `usePoolRanking`, `usePoolRankingByScope`, `useMatches`, `useNextMatch`: `refetchOnMount: "always"` — toda navegação de volta dispara N refetches simultâneos
- Impacto: na volta à home via BottomNav, o usuário vê skeleton/flash de conteúdo enquanto 11 requests competem por bandwidth; a API do ESPN tem revalidate de 60s no servidor mas o client invalida a cada mount ignorando staleTime

### 2.4 Hardening de segurança

**S1 — Cookie `__session` sem atributos SameSite explícitos verificados**
- A criação do cookie via `api/auth/session` precisa ser auditada para confirmar que `SameSite=Strict` ou `Lax` está explícito — App Hosting não adiciona por padrão
- Ausência de SameSite pode expor endpoints de mutação a CSRF em browsers mais antigos

**S2 — Ausência de rate limiting nos endpoints de mutação**
- `/api/predictions` (POST/PATCH), `/api/auth/session` (POST), `/api/predictions/score` (POST cron): sem rate limiting por IP ou uid
- `/api/auth/session` exposto a brute-force de tokens Firebase válidos roubados

**S3 — `COPA_DATA_USE_MOCK` pode silenciosamente servir dados mock em produção**
- Variável lida em `src/server/copaData/` sem validação se `NODE_ENV === "production"`; se presente no `apphosting.yaml` por engano, dados de mock são servidos sem erro

**S4 — Secrets de cron não verificados no startup**
- `SCORE_SECRET` e `RANKINGS_SECRET` são validados apenas no request. Ausência silenciosa faz `safeSecretEqual` retornar `false` mas o endpoint responde 401 sem alarme — o cron falha silenciosamente por meses sem alertar

---

## 3. System understanding relevant to this feature

### Camada cliente
- React Query `QueryClient` global com `staleTime: 30min`, `gcTime: 24h`
- `refetchOnWindowFocus: "always"` (adicionado em `feat/auto-refresh-on-return`)
- Home: `useHomeDashboard` → 11 queries; algumas com `refetchOnMount: "always"`
- Matches: `useMatchesList` → 3 queries (matches, teams, predictions); `useMatches` tem `refetchOnMount: "always"`

### Algoritmos críticos (chamados por render)
- `deriveMatchPredictionStatus`: O(n) por partida → O(n²) total
- `buildTeamMap`: O(n) por render, sem memoization
- Pipeline de filtros em `MatchList`: O(n×f) por render sem useMemo (f = número de filtros)

### Servidor
- `GET /api/matches`: `revalidate: 60` (Next.js ISR). ESPN fetch com overlay Firestore
- `GET /api/worldcup/bracket`: cache Firestore `worldcup_cache`, TTL dinâmico (60s se live)
- Sem middleware de rate limiting (App Hosting não injeta)

### Auth / session cookie
- Criado em `api/auth/session/route.ts` via Firebase Admin SDK `createSessionCookie`
- Cookie name: `SESSION_COOKIE_NAME` (const compartilhada)
- Verificação edge: `jose` + google certs cached

---

## 4. Technical impact analysis

| Área | Impacto |
|---|---|
| `matchesHelpers.ts` | Mudar assinatura de `deriveMatchPredictionStatus` para aceitar `predMap` ou verificar antes de chamar |
| `useMatchesList.ts` | Usar `predMap` no loop; memoizar `teamMap` com `useMemo` |
| `useHomeDashboard.ts` | Construir `predMap` local; memoizar `teamMap`; rendering progressivo por card |
| `MatchList.tsx` | Envolver pipeline de filtros em `useMemo` com deps corretas |
| `QueryProvider.tsx` | Avaliar se `refetchOnWindowFocus: "always"` é a estratégia correta ou se hooks específicos devem controlar |
| `api/auth/session/route.ts` | Auditar atributos SameSite do cookie |
| `apphosting.yaml` / env | Validar ausência de `COPA_DATA_USE_MOCK` e presença de secrets |
| Startup check | Adicionar validação de secrets obrigatórios no startup |

### Contratos não afetados
- Firestore rules: sem mudança
- API response shape: sem mudança
- Schemas Zod: sem mudança
- Deploy / infra: sem mudança (salvo possível ajuste de cookie header)

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Mudar assinatura de `deriveMatchPredictionStatus` quebra testes existentes | Médio | Manter assinatura original + overload, ou adaptar testes |
| Remover `refetchOnWindowFocus: "always"` pode regredir o comportamento de auto-refresh esperado | Alto | Manter por hook onde necessário; remover apenas o global |
| `useMemo` com deps incorretas pode congelar derivações | Médio | Teste de UI + vitest para cada derivação memoizada |
| Alterar cookie attributes pode impactar auth em browsers específicos | Baixo | Verificar compatibilidade de SameSite=Strict com WebAuthn flow |
| Renderização progressiva aumenta complexidade do `HomeDashboard` | Médio | Cada card recebe seus próprios estados de loading/error |

---

## 6. Ambiguities and gaps

- **Qual o comportamento exato esperado no auto-refresh?** O usuário quer dados frescos ao voltar (ok), mas não necessariamente ao cada micro-interação. Definir granularidade: "volta de aba = refetch" vs "navegação = refetch de ranking apenas"
- **`refetchOnWindowFocus: "always"` é global por design?** O PRD original de `auto-refresh-retorno` define como global; isso pode ser revisto
- **Rate limiting: middleware Next.js vs. Cloud Armor vs. sem nada?** App Hosting não tem Cloud Armor nativo fácil; a alternativa é middleware de contagem com Redis ou Upstash — fora do escopo se não há infra de cache
- **Startup check de secrets**: onde emitir o alerta (log de build? log de startup? Firestore log?)
- **SameSite cookie**: requer teste em Safari iOS que tem comportamento diferente com `SameSite=Strict` e redirects OAuth

---

## 7. Recommended implementation concerns

1. **Atacar P1 primeiro** — O(n²) é o maior ganho isolado; mudar `deriveMatchPredictionStatus` para receber `predMap` ou mover o lookup para antes da chamada
2. **P2 (useMemo no pipeline) tem impacto de UX imediato** — cada keystroke na busca de jogos dispara recalculo pesado; wrap simples
3. **P7 (refetch strategy) precisa de decisão de produto antes de implementar** — remover `refetchOnWindowFocus: "always"` global pode regredir expectativas do usuário; proposta: manter em hooks críticos (ranking, matches) mas desabilitar global e granularizar por hook com staleTime explícito por tier
4. **P6 (renderização progressiva) é a maior melhoria de UX percebida** — cards que não dependem de ranking (teams, settings, nextMatch) podem renderizar em <500ms enquanto ranking resolve; requer refactor do `HomeDashboard` para `isLoading` por card
5. **S1 (cookie SameSite)** — auditoria e fix de 1 linha, baixo risco, alto impacto de segurança
6. **S3/S4** — guards de ambiente/startup são pequenas adições de baixo risco
7. **Rate limiting** — avaliar escopo: se App Hosting + Firebase Auth já protege token replay, o vetor real é o endpoint `/api/predictions/score` (cron público com header secret) — já protegido por `safeSecretEqual`
