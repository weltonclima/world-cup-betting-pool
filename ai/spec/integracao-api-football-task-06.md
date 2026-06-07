# SPEC — TASK-06: Hooks React Query por tier + Home na nova fonte (/api)

> PRD/Plano: `ai/plan/integracao-api-football.md` (TASK-06; ambiguidade A5)
> Depende de: TASK-05 (serviços `src/services/{matches,teams}.ts` já consumindo `/api/*`)
> Status: implementado · vitest `src/features` 333/333 verde · `tsc --noEmit` exit 0

## 1. Objetivo

1. Criar hooks React Query reutilizáveis de matches/teams (para a futura tela de Jogos),
   com `staleTime` derivado da fonte única de tiers (`src/server/cache/tiers.ts`).
2. Ajustar os hooks da Home (`useNextMatch`, `useRecentResults`, `useTeams`) para
   aplicar `staleTime` por tier (antes herdavam o default global de 30min/24h).
3. NÃO alterar `homeDashboardHelpers` nem o contrato do compositor `useHomeDashboard`
   (só fonte/staleTime, que já são transparentes pós-TASK-05).
4. Verificar a Home ponta a ponta (testes verdes).

## 2. Fonte única de cache (tiers.ts)

`src/server/cache/tiers.ts` exporta `REVALIDATE` (segundos, para `revalidate` server)
e `STALE_TIME` (ms, derivado `× 1000`, para `staleTime` do React Query). O arquivo
importa apenas `date-fns` + tipos e **não** tem `import "server-only"` — confirmado por
leitura; portanto é seguro importá-lo em hooks client. Isso mantém os números de cache
em UM lugar só (servidor e client espelhados).

Tiers relevantes: `selecoes`=24h, `jogoFuturo`=6h, `jogoDia`=30min, `jogoAoVivo`=1min,
`jogoEncerrado`=5min, `grupos`=24h.

## 3. Hooks criados (feature matches)

Arquivos novos em `src/features/matches/hooks/`:

| Arquivo | Export | Consome (TASK-05) | Query key | staleTime |
|---|---|---|---|---|
| `matchesKeys.ts` | `matchesKeys` | — | `["matches", ...]` | — |
| `useMatches.ts` | `useMatches()` | `listMatches` | `matchesKeys.list()` → `["matches","list"]` | `STALE_TIME.jogoDia` (30min) |
| `useMatch.ts` | `useMatch(id)` | `getMatchById` | `matchesKeys.detail(id)` → `["matches","detail",id]` | `STALE_TIME.jogoDia` (30min) |
| `useTeams.ts` | `useTeams()` | `listAllTeams` | `matchesKeys.teams()` → `["matches","teams"]` | `STALE_TIME.selecoes` (24h) |
| `index.ts` | barrel dos 4 | — | — | — |

- `matchesKeys` é uma factory hierárquica (`all`/`lists`/`list`/`details`/`detail`/`teams`)
  no padrão TanStack Query, permitindo invalidação granular.
- `useMatch(id)` usa `enabled: id.length > 0` para não disparar com id vazio.
- Reexportados via `src/features/matches/index.ts` (`export { matchesKeys, useMatches, useMatch, useTeams }`).

### 3.1 Decisão A5 — tier único por lista (simplificação documentada)

O tier de cache "correto" é por partida e por status (`revalidateForMatch`): live=1min,
finished quente=5min, futuro=6h. Mas `useMatches`/`useMatch` no client não têm como
aplicar tier-por-item num `staleTime` único de query. Conforme A5 do plano, aplicamos um
**tier único** = `jogoDia` (30min) como ponto médio sensato. A granularidade fina por
status permanece no `revalidate` server-side de cada Route Handler (TASK-04), que é a
camada que de fato controla a frequência de chamada à API-Football. O `staleTime` do
client é apenas o gatilho de refetch da UI.

### 3.2 `useTeams` compartilhado vs. o da Home

A feature matches ganha seu próprio `useTeams` (canônico para a tela de Jogos) em vez de
reusar o da Home, porque as features devem ser desacopladas e a Home importar de matches
criaria acoplamento cruzado. Ambos os hooks têm o MESMO `staleTime` (`selecoes`, 24h) e a
MESMA queryFn (`listAllTeams`), mas query keys distintas (`["matches","teams"]` vs
`["home","teams"]`) — caches separados de propósito, cada feature controla sua
invalidação. Documentado em ambos os arquivos.

## 4. Ajustes na Home (staleTime por tier)

Somente o campo `staleTime` foi adicionado; query keys, queryFn e assinaturas
**inalteradas**. As queryFn já apontam para `/api/*` desde a TASK-05 — o repoint de fonte
é transparente para estes hooks.

| Hook | Antes | Depois | Tier escolhido | Justificativa |
|---|---|---|---|---|
| `useNextMatch` | herdava 30min global | `STALE_TIME.jogoDia` (30min) | jogoDia | "próximo jogo" é tipicamente do dia/próximo; status/horário muda ao longo do dia. Coincide com o default, mas agora explícito e atrelado à fonte única. |
| `useRecentResults` | herdava 30min global | `STALE_TIME.jogoEncerrado` (5min) | jogoEncerrado | resultados recém-finalizados estão na janela quente (`revalidateForMatch` → `jogoEncerrado` p/ finished < 6h); placar oficial ainda pode ajustar. 5min evita exibir placar provisório por mais tempo que o servidor o cacheia. Preferido a `jogoFuturo` (6h, longo demais p/ resultado quente). |
| `useTeams` (home) | herdava 30min global | `STALE_TIME.selecoes` (24h) | selecoes | seleções são estáticas (PRD-07); revalidar a cada 30min é desperdício. |

`homeDashboardHelpers` e `useHomeDashboard`: **nenhuma alteração** (verificado — a única
mudança nos hooks foi `staleTime`, que o compositor não inspeciona).

## 5. Como a Home foi verificada (render ponta a ponta)

- `src/features/home/components/__tests__/HomeDashboard.test.tsx` (27 testes) exercita os
  3 estados da página (loading/error/sucesso) renderizando `<HomeDashboard />` real com
  `useHomeDashboard` mockado no nível do hook. Verde.
- `src/features/home/hooks/__tests__/useHomeDashboard.test.ts` exercita o compositor
  renderizando o hook real com os 7 hooks por recurso mockados (incluindo `useNextMatch`,
  `useRecentResults`, `useTeams` — os que mudei). Cobre joins, isCorrect, predictionStatus,
  isLoading/isError, refetch, estado neutro. Verde.
- Como esses testes mockam no nível de hook/compositor (não no `fetch`/serviço), o repoint
  de fonte (TASK-05) e o `staleTime` adicionado não exigiram alteração de mock algum.
- Os testes de serviço (`src/services/__tests__/matches.test.ts`/`teams.test.ts`) já foram
  reescritos na TASK-05 para mockar `global.fetch` (não Firestore) — fora do escopo desta
  task, permanecem verdes.

## 6. Casos de teste cobertos (regressão)

Suíte `src/features` completa: **333 passed / 0 failed** (133 suites). Inclui as 12 suites
da Home. Os hooks novos de matches não têm testes dedicados (plano: Recommended TDD = no;
são wrappers finos de serviços já testados na TASK-05 + `useQuery`); a futura tela de Jogos
(PRD próprio) adicionará testes de integração ao consumi-los.

## 7. Arquivos tocados

Novos:
- `src/features/matches/hooks/matchesKeys.ts`
- `src/features/matches/hooks/useMatches.ts`
- `src/features/matches/hooks/useMatch.ts`
- `src/features/matches/hooks/useTeams.ts`
- `src/features/matches/hooks/index.ts`

Editados:
- `src/features/matches/index.ts` (barrel → reexporta hooks)
- `src/features/home/hooks/useNextMatch.ts` (+ staleTime jogoDia)
- `src/features/home/hooks/useRecentResults.ts` (+ staleTime jogoEncerrado)
- `src/features/home/hooks/useTeams.ts` (+ staleTime selecoes)

Não tocados (conforme restrição): `functions/**`, `src/server/**`, `src/app/api/**`,
`src/services/**`, `next.config`, `firebase.json`, `middleware`, `schemas`,
`homeDashboardHelpers`, `useHomeDashboard`.

## 8. Verificação

- `npx vitest run src/features --reporter=json` → `numTotalTests:333 numFailedTests:0`
  (lido do JSON, não do resumo rtk).
- `npx tsc --noEmit` → exit 0.

## 9. Riscos / desvios

- **Tier único por lista (A5):** aceito e documentado; granularidade fina vive no
  `revalidate` server-side. Sem desvio do plano.
- **Dois `useTeams` (home e matches):** coexistência intencional com caches separados por
  query key. Quando a tela de Jogos existir, avaliar se a Home deve migrar para o hook de
  matches e aposentar o seu (consolidação fora do escopo desta task).
- **Import de `tiers.ts` no client:** depende de o arquivo permanecer sem `server-only`.
  Se uma task futura adicionar `import "server-only"` lá, estes hooks quebram o build do
  client — nesse caso, extrair `STALE_TIME` para um módulo isomórfico (ex.: `src/lib/`).
