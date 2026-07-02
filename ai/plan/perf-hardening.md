# PLAN — Performance Optimization & Security Hardening

## 1. Planning summary

11 tasks derivadas de `ai/prd/perf-hardening.md`. Ordenação por alavancagem: eliminar redundância de rede da Home (maior gargalo) → corrigir bug de justiça do ranking (pênaltis) → memoization das telas quentes → segurança barata → render progressivo → estratégia de refetch.

Cada task é independente, de escopo estreito, alinhada à arquitetura atual (React Query, feature slices, funções puras testáveis). TDD aplicado só onde há regra de negócio (B1 pênaltis, S1 escopo de pool). O resto é refactor de perf/config com testes de regressão.

**Sensibilidade:** app em produção durante a Copa. B1 (pênaltis) afeta justiça do ranking — prioridade após o gargalo de perf. Nenhuma mudança de schema, Firestore Rules ou deploy.

## 2. Recommended execution phases

- **Phase 1 – foundation (rede/dados)**: TASK-01, TASK-02 — matar fetches/parses redundantes da Home.
- **Phase 2 – regras de negócio**: TASK-03 (pênaltis), TASK-08 (escopo de pool).
- **Phase 3 – render/CPU**: TASK-04, TASK-05, TASK-06 — memoization e O(1).
- **Phase 4 – hardening barato**: TASK-07 (cache leak), TASK-09 (idempotência/status).
- **Phase 5 – UX de carregamento**: TASK-10 (render progressivo), TASK-11 (refetch strategy).

## 3. Tasks

### TASK-01 – Home consome matches de uma única query (elimina 3× download de /api/matches)
- Type: refactor-support
- Goal: `nextMatch` e `recentResults` deixam de disparar `listMatches()` independente; derivam do `flatList` já carregado por `useMatchesList` (ou de `select` sobre a mesma query key).
- Scope: remover/reimplementar `useNextMatch` e `useRecentResults` na Home; derivar via helpers puros (espelhar `deriveOpenMatches`/`deriveCurrentStage` já existentes); corrigir o comentário falso de "dedup" em `useHomeDashboard.ts:90-91`.
- Main modules/files likely involved:
  - `src/features/home/hooks/useHomeDashboard.ts`
  - `src/features/home/hooks/useNextMatch.ts`
  - `src/features/home/hooks/useRecentResults.ts`
  - `src/features/home/lib/homeDashboardHelpers.ts` (novos derivadores puros)
  - `src/services/matches.ts` (getNextScheduledMatch/getRecentFinishedMatches podem virar puros)
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
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
- Notes: maior ganho isolado de latência. Cuidado: `getNextScheduledMatch` filtra `scheduled` + kickoff futuro; `getRecentFinishedMatches` filtra `finished` slice 5 — preservar a mesma semântica ao derivar do flatList. Não quebrar as telas que consomem os services fora da Home. **DONE:** 271 testes home ✓, typecheck ✓, lint 0 err. Removidos useNextMatch/useRecentResults; deriveNextMatch/deriveRecentResults puros no flatList. GSD pass pulado (agents desabilitados).

### TASK-02 – Unificar namespaces de teams/predictions na Home (elimina 2× fetch)
- Type: refactor-support
- Goal: `teams` e `predictions` buscados uma única vez na Home, não em dois namespaces (`home` vs `matches`).
- Scope: Home passa a consumir teams/predictions via a mesma fonte que `useMatchesList` (namespace `matches`), ou canonizar uma key única. Remover os hooks duplicados de `home/hooks/useTeams` e `home/hooks/usePredictions` se ficarem órfãos.
- Main modules/files likely involved:
  - `src/features/home/hooks/useHomeDashboard.ts`
  - `src/features/home/hooks/useTeams.ts`
  - `src/features/home/hooks/usePredictions.ts`
  - `src/features/matches/hooks/{useTeams,usePredictions,matchesKeys}.ts`
- Dependencies: TASK-01 (mesma área do compositor; sequenciar evita conflito)
- Story points: 2
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
- Notes: verificar invalidação de cache em `useUpsertPrediction` (invalida `matchesKeys.predictions` + `homeKeys.predictions`); se um namespace some, ajustar as invalidações para não deixar cache órfão. B2 (TASK-07) é relacionado mas ortogonal. **DONE:** home useTeams/usePredictions viram re-export do namespace `matches` → dedup (1 fetch). 386 testes ✓ (home+matches+groupAdmin+predictions), typecheck ✓. `homeKeys.predictions` invalidation vira no-op inofensivo (matches key cobre Home).

### TASK-03 – [FECHADA — by design] pontuação de pênaltis
- Type: domain
- Goal: N/A
- Status: done
- Phases done: (decisão de produto)
- **DECISÃO (usuário):** pontuar **só pelo placar do tempo normal**, ignorando pênaltis. É exatamente o comportamento atual de `scorePrediction` (`predictionsHelpers.ts:163`). Jogo 1-1 decidido nos pênaltis: quem apostou 1-1 leva `partial` (empate=empate); quem apostou um vencedor leva 0. **Sem mudança de código.** B1 fechado como comportamento intencional.
- Notes: nenhuma ação. Mantida no plano como registro da decisão. Se no futuro quiserem premiar "acertou quem avançou", os campos `advanceSide`/`outcome` já existem no schema.

### TASK-04 – Memoizar useMatchesList (view-model estável) + deriveMatchPredictionStatus O(1)
- Type: application
- Goal: `useMatchesList` deixa de recomputar todo o view-model e retornar novas referências a cada render; `deriveMatchPredictionStatus` vira O(1) por partida.
- Scope: envolver derivação de `flatList`/`groups` em `useMemo` (deps `[matches,teams,predictions]`); passar `Set<matchId>` (ou predMap) para `deriveMatchPredictionStatus` trocando `.some` por `set.has`; estabilizar `now` (por dia). Ajustar assinatura de `deriveMatchPredictionStatus` mantendo compat de testes (overload ou adaptar testes).
- Main modules/files likely involved:
  - `src/features/matches/hooks/useMatchesList.ts`
  - `src/features/matches/lib/matchesHelpers.ts`
  - `__tests__` correspondentes
- Dependencies: nenhuma (mas TASK-01/02 tocam o compositor da Home que consome este hook — sequenciar depois reduz conflito)
- Story points: 3
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
- Phases done: spec, implement, test, review
- Notes: beneficia Home E Jogos. `groupMatchesByDay` chama `format()` por item — cair dentro do useMemo já resolve o custo repetido. Cuidado com a dep `now`: não colocar `new Date()` cru no dep array (recria sempre). **DONE:** deriveMatchPredictionStatus aceita `Prediction[] | ReadonlySet<string>` (hot path passa Set → O(1)); useMatchesList memoiza flatList/groups (deps nas `.data`). 576 testes ✓ (matches+home), typecheck ✓, teste de identidade referencial ✓.

### TASK-05 – Memoizar pipeline de filtro do MatchList
- Type: application
- Goal: digitação na busca de Jogos deixa de recalcular todo o pipeline de filtro + reparse de datas a cada tecla.
- Scope: `useMemo` para cada estágio (`afterSearch`→…→`orderedGroups`) com deps corretas; pré-computar `dateKey`/`bucket` uma vez no view-model (idealmente no hook, TASK-04) em vez de reparsear por filtro; `defaultTab` deixa de reparsear 2× por item.
- Main modules/files likely involved:
  - `src/features/matches/components/MatchList.tsx`
  - `src/features/matches/hooks/useMatchesList.ts` (expor dateKey/bucket pré-computado)
- Dependencies: TASK-04 (consome o view-model memoizado; ideal expor bucket lá)
- Story points: 3
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
- Phases done: spec, implement, test, review
- Notes: resolve a "digitação travada". Deps do useMemo são o ponto sensível — errar congela filtros. B3 (todayKey obsoleto pós-meia-noite) pode ser corrigido junto aqui (baixo custo). **DONE:** pipeline envolto em useMemo (8 deps completas); `filteredIsEmpty` substitui `filteredGroups.length`. 50 testes MatchList ✓, typecheck+lint limpos. B3 NÃO corrigido (fora de escopo, documentado).

### TASK-06 – React.memo(MatchCard) + identidade estável de props
- Type: application
- Goal: cada tecla na busca deixa de re-renderizar todos os cards da lista.
- Scope: `React.memo(MatchCard)`; mover `toMatchWithId` para o view-model memoizado (preservar identidade do objeto match); içar `STAGE_LABEL` para constante de módulo; evitar `detailHref` inline recriado.
- Main modules/files likely involved:
  - `src/features/matches/components/MatchCard.tsx`
  - `src/features/matches/components/MatchList.tsx`
  - `src/features/matches/hooks/useMatchesList.ts`
- Dependencies: TASK-04 (identidade estável vem do view-model memoizado)
- Story points: 2
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
- Phases done: spec, implement, test, review
- Notes: `React.memo` só ajuda se as props forem referencialmente estáveis — depende de TASK-04/05. Verificar que `homeTeam`/`awayTeam`/`userPrediction` são estáveis (vêm do view-model memoizado). **DONE:** MatchCard = memo(MatchCardBase); toMatchWithId removido → `match={item}` (ref estável, MatchListItem superset de MatchWithId); STAGE_LABEL constante de módulo. 198 testes ✓, typecheck confirma assignability.

### TASK-07 – Corrigir queryKey de usePredictions (cache leak entre contas — B2)
- Type: application
- Goal: `usePredictions` da feature predictions passa a incluir uid na queryKey, eliminando vazamento de palpites entre contas em navegador compartilhado.
- Scope: mudar `predictionsKeys.all()` → key com uid (espelhar `matchesKeys.predictions(uid)`); ajustar invalidações que referenciam `predictionsKeys.all()`.
- Main modules/files likely involved:
  - `src/features/predictions/hooks/usePredictions.ts`
  - `src/features/predictions/hooks/predictionsKeys.ts`
  - consumidores: `usePredictionsList`, `useGroupPredictions`, `knockout/[stage]/page.tsx`
- Dependencies: nenhuma
- Story points: 2
- Criticality: high
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
- Notes: fix barato de alto valor. Rastrear todas as invalidações de `predictionsKeys.all()` — a hierarquia de key precisa continuar permitindo invalidação por raiz.

### TASK-08 – predictions/[uid] exige mesmo pool (vazamento cross-tenant S1)
- Type: api
- Goal: leitura de palpites de outro participante restrita a membros do mesmo pool (ou admin), espelhando o isolamento tenant do resto do código.
- Scope: em `predictions/[uid]/route.ts`, após autorizar o leitor, verificar `target.groupId === session.groupId` (ou leitor é super_admin) antes de retornar; 403 caso contrário. Reusar padrão de `_moderation.ts`/`_authorize.ts`.
- Main modules/files likely involved:
  - `src/app/api/predictions/[uid]/route.ts`
  - `src/server/admin/_authorize.ts` / `_moderation.ts` (referência de padrão)
  - `__tests__` de rota
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: precisa ler `users/{targetUid}.groupId` via Admin SDK. Confirmar que a tela anti-cola (perfil de outro participante) só é acessada dentro do pool — senão a mudança quebra UX legítima. TDD: caso mesmo-pool (200), caso outro-pool (403), caso admin (200). **DONE:** checagem pool-scope após auth (self bypass, super_admin bypass, mesmo groupId, fail-closed 403/500). TDD RED→GREEN, 22 testes ✓ (7 novos), typecheck+lint limpos.

### TASK-09 – Hardening barato: redeem idempotente + re-check status/role em score/recalc (S2, S3)
- Type: api
- Goal: convite não pode ter `usedCount` inflado por resgate repetido do mesmo uid; disparos manuais de score/recalc exigem `status==="approved"` e aceitam `super_admin` canônico.
- Scope: (a) `invite/[code]/redeem` marca resgate por uid (idempotência), (b) `predictions/score` + `rankings/recalc` fallback de sessão usa `requireApprovedUser` + `isSuperAdminRole` no lugar de `role !== "admin"` cru.
- Main modules/files likely involved:
  - `src/app/api/invite/[code]/redeem/route.ts`
  - `src/app/api/predictions/score/route.ts`
  - `src/app/api/rankings/recalc/route.ts`
  - `__tests__` de rota
- Dependencies: nenhuma
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
- Notes: dois hardenings independentes agrupados por baixo custo. Idempotência do redeem pode exigir subdoc/campo `redeemedBy` — verificar shape do convite. Não alterar o caminho por secret (cron), só o fallback de sessão. **DONE:** S2 subdoc `invites/{code}/redemptions/{uid}` (idempotente, server-only por deny-by-default); S3 `roleSchema.safeParse`+`isSuperAdminRole`+`status==="approved"` em score/recalc. 82 testes ✓ (3 rotas), typecheck+lint (1 warn pré-existente).

### TASK-10 – Render progressivo na Home (loading por card, elimina all-or-nothing)
- Type: application
- Goal: cards que não dependem de ranking (teams/settings/nextMatch) renderizam assim que prontos; uma query lenta (ranking) não segura a tela inteira.
- Scope: `HomeDashboard` deixa de usar `isLoading` agregado como gate único; cada card recebe seu próprio estado loading/error. Compositor expõe estados granulares por seção em vez de `queries.some(isLoading)`.
- Main modules/files likely involved:
  - `src/features/home/hooks/useHomeDashboard.ts`
  - `src/features/home/components/HomeDashboard.tsx`
  - cards individuais (já têm skeletons)
- Dependencies: TASK-01, TASK-02 (compositor estabilizado primeiro)
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
- Phases done: spec, implement, test, review
- Notes: maior melhoria de UX percebida (FMP). Refactor do contrato de `useHomeDashboard` (isLoading agregado → granular) impacta os testes do compositor. Skeletons por card já existem. **DONE:** `heroLoading` (ranking/stats/poolStats) + `matchesLoading` (matchesList/settings) aditivos; HomeDashboard gateia por card; `isLoading` agregado mantido p/ erro. 278 testes ✓ (+7), typecheck+lint (1 warn pré-existente).

### TASK-11 – Refetch em background sem flash (stale-while-revalidate)
- Type: application
- Goal: manter o auto-refresh global (`refetchOnWindowFocus:"always"` + `refetchOnMount:"always"`), mas o usuário passa a ver os dados em cache imediatamente enquanto a revalidação roda em background — sem skeleton/flash a cada volta de aba/navegação.
- Scope: **DECISÃO (usuário): refetch em background.** NÃO remover o refetch global. Garantir que os componentes distinguam `isLoading` (sem dado, mostra skeleton) de `isFetching`/`isRefetching` (tem dado stale, mostra conteúdo + indicador discreto). Home/Jogos/Ranking renderizam o cache durante o refetch. Onde há troca de parâmetro (ex.: tab de ranking, filtro), usar `placeholderData: keepPreviousData` para não piscar. Indicador de atualização opcional (spinner sutil no header).
- Main modules/files likely involved:
  - `src/features/home/components/HomeDashboard.tsx` (gate por `isLoading`, não `isFetching`)
  - `src/features/matches/components/MatchList.tsx`
  - `src/features/rankings/components/GeneralRanking.tsx`
  - hooks de ranking/matches (`placeholderData: keepPreviousData` onde há troca de escopo)
  - opcional: indicador de refetch reutilizável
- Dependencies: TASK-01, TASK-02 (menos queries = refetch de background mais leve), TASK-10 (loading por card já separa isLoading de isFetching)
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
- Phases done: spec, implement, test, review
- Notes: converge com TASK-10 (ambos separam "sem dado" de "revalidando"). O gate `isLoading` da Home (`queries.some(isLoading)`) já é `false` quando há cache — o refetch de foco marca `isFetching`, não `isLoading`. O trabalho é garantir que nenhum componente use `isFetching` como gate de skeleton e adicionar `keepPreviousData` nas trocas de parâmetro. **DONE:** confirmado que nenhum componente de produção gateia por isFetching (só isLoading) → stale-while-revalidate em foco/mount já vigente; `placeholderData: keepPreviousData` em usePoolRankingByScope/useParticipantProfile/useProfilePredictions elimina flash na troca de scope/uid. Auto-refresh global mantido. 166 testes rankings ✓ (+1 keepPreviousData).

## 4. Dependency map

```
TASK-01 (foundation) ─┬─→ TASK-02 ─┬─→ TASK-10 (render progressivo)
                      │            └─→ TASK-11 (refetch)
                      │
TASK-04 (memo hook) ──┬─→ TASK-05 (memo filtro)
                      └─→ TASK-06 (memo card)

TASK-03 (pênaltis)  — independente (bloqueado por decisão de produto)
TASK-07 (cache leak)— independente
TASK-08 (S1 pool)   — independente
TASK-09 (S2/S3)     — independente
```

## 5. Recommended execution order

1. **TASK-01** — matar 3× download de matches (maior ganho)
2. **TASK-02** — matar 2× teams/predictions
3. **TASK-03** — bug de pênaltis (justiça do ranking) *[requer decisão de produto]*
4. **TASK-04** — memo useMatchesList + O(1)
5. **TASK-05** — memo pipeline de filtro
6. **TASK-06** — React.memo(MatchCard)
7. **TASK-07** — cache leak queryKey
8. **TASK-08** — S1 escopo de pool
9. **TASK-09** — S2/S3 hardening
10. **TASK-10** — render progressivo
11. **TASK-11** — refetch strategy *[requer decisão de produto]*

## 6. Planning risks and blockers

- **TASK-03 (pênaltis) — DECISÃO DE PRODUTO + risk alto.** Confirmar a regra: "acertar quem avançou nos pênaltis = 5 pts" (proposto) vs. "pontuar só placar de tempo normal" (comportamento atual). Também exige verificar que `outcome`/`advanceSide` chegam ao path de recalc via `getEffectiveMatches`, e recalc retroativo após deploy.
- **TASK-11 (refetch) — DECISÃO DE PRODUTO.** `auto-refresh-retorno` definiu refetch global intencionalmente. Reverter sem alinhar regride a expectativa. Definir granularidade antes.
- **TASK-01/02 — regressão.** `useNextMatch`/`useRecentResults`/`useTeams`/`usePredictions` de `home` podem ser consumidos fora da Home; mapear consumidores antes de remover. Ajustar invalidações de cache de `useUpsertPrediction`.
- **TASK-04/05/06 — deps de useMemo/memo.** Erro em dep array congela derivações/filtros. Testes de regressão de UI obrigatórios.
- **TASK-08 — UX legítima.** Restringir por pool pode quebrar a tela anti-cola se ela for acessível cross-pool por design; confirmar.
- **TDD:** TASK-03 e TASK-08 usam TDD (regra de negócio / autorização). Demais são refactor com testes de regressão.

---

plan-checker: skipped nesta versão (achados já verificados individualmente no código-fonte por auditoria dedicada; breakdown é 1:1 com findings confirmados, sem gap de goal). Rodar sob demanda se o usuário quiser verificação goal-backward independente.
