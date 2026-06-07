# SPEC / NOTA DE EXECUÇÃO — TASK-11: Remover sync Firestore obsoleto (código morto)

> PRD: `integracao-api-football` · Plano: `ai/plan/integracao-api-football.md` (TASK-11; A7)
> Tarefa **destrutiva** (remoção de código morto). Nada de `git commit` — mudanças deixadas no working tree.

## Contexto

A arquitetura migrou para **Route Handlers `/api` + React Query** (TASK-01..06): os dados da
Copa (matches/teams/standings) **não persistem mais no Firestore** — vêm da API-Football via
cache do Next. A camada antiga em `functions/` (Cloud Functions que buscavam da API e
gravavam `teams`/`matches` no Firestore) virou **código morto**. O client `apiFootball` e os
`mappers` já haviam sido **copiados** para `src/server/` em TASK-01/02. Esta tarefa remove as
cópias antigas em `functions/` e o pipeline de persistência associado.

## Confirmação via Grep (antes de apagar)

Investigação de imports **dentro de `functions/`** confirmou que o cluster a remover é
**fechado e autossuficiente** — nenhum código que permanece o importa:

| Módulo | Quem importava (em functions/) | Permanece? |
|---|---|---|
| `firestore/writer` (`writeTeams`/`writeMatches`) | **apenas** `functions/syncTeams.ts` | removido |
| `apiFootball/{factory,config,client,mock,types}` | `syncTeams.ts`, `scheduledSync.ts`, `mappers/*`, testes `client.*`, fixtures | todos removidos |
| `mappers/{matchMapper,teamMapper}` | `writer.ts` (só types), `syncTeams.ts`, testes mappers | todos removidos |
| `shared/schemas` | **apenas** `mappers/*` e `matchMapper.test.ts` | removidos → schemas órfão |

Funções **retidas** (`promoteFirstAdmin`, `syncRoleClaim`, `syncRoleClaimOnUserUpdate`)
importam **somente** `firebase/admin` e pacotes `firebase-admin/*` — **não tocam** em
writer/apiFootball/mappers/shared. Logo a remoção não as afeta.

Grep adicional confirmou que o **app (`src/`) não importa nada de `functions/`** (busca por
`functions/src` e `../../functions` → 0 ocorrências). Verificação cruzada não quebra o app.

## Arquivos removidos

Persistência / pipeline:
- `functions/src/functions/syncTeams.ts` (callable que gravava `teams`)
- `functions/src/functions/scheduledSync.ts` (cron stub — só buscava fixtures e logava)
- `functions/src/firestore/writer.ts` (`writeTeams`/`writeMatches`)
- `functions/src/apiFootball/{client,mock,factory,types,config}.ts` (cópias agora em `src/server`)
- `functions/src/mappers/{matchMapper,teamMapper}.ts` (cópias agora em `src/server`)
- `functions/src/shared/schemas.ts` (consumido só pelos mappers/teste removidos)

Testes órfãos (testavam só código removido):
- `functions/src/__tests__/client.http.test.ts`
- `functions/src/__tests__/client.mock.test.ts`
- `functions/src/__tests__/matchMapper.test.ts`
- `functions/src/__tests__/teamMapper.test.ts`
- `functions/src/__tests__/fixtures/apiFixtureFixtures.ts`
- `functions/src/__tests__/fixtures/apiTeamFixtures.ts`

Diretórios vazios resultantes removidos: `apiFootball/`, `mappers/`, `firestore/`, `shared/`,
`__tests__/fixtures/`.

**Mantidos** (testes de funções retidas): `promoteFirstAdmin.test.ts`, `syncRoleClaim.test.ts`,
`syncRoleClaimOnUserUpdate.test.ts`. E `firebase/admin.ts` (init do Admin SDK, usado pelas retidas).

## `functions/src/index.ts`

Removidos os exports `syncTeams` e `scheduledSync`. Mantidos **apenas**
`promoteFirstAdmin` e `syncRoleClaimOnUserUpdate`. Cabeçalho atualizado com nota A7/ranking.

## Decisão: `scheduledSync`

**Removido** (padrão recomendado pelo plano), não mantido como placeholder. Era um stub que
apenas buscava fixtures e logava (não gravava nada útil) e arrastava a dependência
`apiFootball/*` que estamos eliminando. Manter um placeholder forçaria reter `apiFootball` ou
deixar uma CF vazia sem propósito. A CF de ranking (cron diário 02:00 que recalcula pontuação
a partir dos resultados) será **reintroduzida no PRD de ranking** (A7), consumindo uma cópia
controlada do client de resultados — **sem** reintroduzir gravação de matches/teams no
Firestore. Essa decisão está documentada em comentário no `index.ts`.

## Índices Firestore removidos (`firestore.indexes.json`)

Removidos os **dois índices compostos de `matches`** que existiam apenas para as queries
Firestore antigas:
- `matches`: `status ASC, kickoffAt ASC`
- `matches`: `status ASC, kickoffAt DESC`

Confirmado que `src/services/matches.ts` agora deriva `getNextScheduledMatch` /
`getRecentFinishedMatches` **client-side** a partir de `listMatches()` (fetch `/api` + sort),
sem `where`/`orderBy` no Firestore → índices órfãos.

**Mantido**: índice de `users` (`status ASC, createdAt ASC`) — continua usado (aprovação de
usuários). Não havia índices de predictions/rankings no arquivo.

## Verificação dupla (resultado)

Ver relatório final da tarefa.

## Desvios / riscos

- Nenhum desvio do plano. `scheduledSync` removido conforme padrão (não mantido como stub).
- Risco residual: ao reintroduzir a CF de ranking, garantir que ela não dependa dos índices de
  `matches` removidos nem reintroduza gravação Firestore de matches/teams (A7).
