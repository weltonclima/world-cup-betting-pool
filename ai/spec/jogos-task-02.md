# SPEC

## 1. Task: TASK-02 – Hooks de dados de Jogos + compositor de view-model

## 2. Objective

Prover à UI uma camada de orquestração React Query que une matches + teams + predictions num view-model pronto para renderização, espelhando `useHomeDashboard` da feature home. A UI consome um único hook compositor (`useMatchesList` ou `useMatchDetail`) sem precisar coordenar queries individualmente.

## 3. In scope

- `src/features/matches/hooks/matchesKeys.ts` — estender com `predictions(uid: string)`.
- `src/features/matches/hooks/usePredictions.ts` — novo hook local (namespace `matchesKeys`, sem cross-feature coupling com `homeKeys`).
- `src/features/matches/hooks/useMatchesList.ts` — compositor: `useMatches` + `useTeams` + `usePredictions`; aplica `buildTeamMap`, `deriveMatchPredictionStatus`, `groupMatchesByDay`; expõe `{ groups, flatList, isLoading, isError, refetch }`.
- `src/features/matches/hooks/useMatchDetail.ts` — compositor: `useMatch(id)` + `useTeams` + `usePredictions`; expõe view-model de jogo único.
- `src/features/matches/hooks/__tests__/useMatchesList.test.ts` — suite TDD espelhando `useHomeDashboard.test.ts`.
- `src/features/matches/hooks/__tests__/useMatchDetail.test.ts` — suite TDD para detalhe.
- `src/features/matches/hooks/index.ts` — atualizar barrel para reexportar novos hooks e tipos.

## 4. Out of scope

- Nenhuma alteração em `src/features/matches/lib/*` (TASK-01, committed).
- Nenhuma alteração em `src/features/matches/index.ts` (barrel de feature — reconciliado pelo orquestrador).
- Nenhum componente, página ou rota.
- `useSystemSettings` global lock — omitido (regra per-match de TASK-01 é suficiente; plan §1 A-trava: "opcional — incluir só se trivial; senão omitir").
- Services e hooks de baixo nível (`useMatches`, `useMatch`, `useTeams`) — sem modificação.

## 5. Main technical areas

| Arquivo | Ação |
|---|---|
| `src/features/matches/hooks/matchesKeys.ts` | Estender — adicionar `predictions(uid)` |
| `src/features/matches/hooks/usePredictions.ts` | Criar |
| `src/features/matches/hooks/useMatchesList.ts` | Criar |
| `src/features/matches/hooks/useMatchDetail.ts` | Criar |
| `src/features/matches/hooks/__tests__/useMatchesList.test.ts` | Criar — TDD |
| `src/features/matches/hooks/__tests__/useMatchDetail.test.ts` | Criar — TDD |
| `src/features/matches/hooks/index.ts` | Atualizar — reexportar novos hooks + tipos |

Molde de referência: `src/features/home/hooks/useHomeDashboard.ts` e `__tests__/useHomeDashboard.test.ts`.

## 6. Business rules and behavior

### 6.1 usePredictions(uid)

- `queryKey: matchesKeys.predictions(uid ?? "")` — namespace `["matches","predictions",uid]`.
- `enabled: uid !== null` — sem uid, sem query (segurança + UX: query desabilitada reporta `isLoading: false`).
- `queryFn: () => listPredictionsByUid(uid!)` — reusa service Firestore existente.
- Sem redefinição de `staleTime` — herda do QueryClient global (30min/24h).

### 6.2 uid source

Obtido via `useAuth().firebaseUser?.uid ?? null`, idêntico ao padrão de `useHomeDashboard`. O hook `useAuth` vive em `@/hooks/useAuth`.

### 6.3 useMatchesList()

Composição:

```
matchesQuery   = useMatches()
teamsQuery     = useTeams()
predictionsQuery = usePredictions(uid)
```

Estado agregado:
- `isLoading`: `queries.some(q => q.isLoading)`.
- `isError`: `queries.some(q => q.isError)`.
- `refetch`: callback estável (useCallback) chamando `.refetch()` de cada query.

Join client-side (após dados carregados):
1. `teamMap = buildTeamMap(teams ?? [])`.
2. Para cada match → `resolveTeam(homeTeamId, teamMap)`, `resolveTeam(awayTeamId, teamMap)`.
3. Para cada match → `deriveMatchPredictionStatus(match, predictions ?? [], now)`.
4. `flatList` = array de `MatchListItem[]` (matches enriquecidos).
5. `groups = groupMatchesByDay(flatList raw matches, now)` — **ou** agrupar os `MatchListItem` diretamente numa estrutura compatível.

> **Decisão de design:** `groups` expõe `MatchListItemDaySection[]` onde cada item de matches já carrega `homeTeam`, `awayTeam` e `predictionStatus` resolvidos. Isso evita que a UI precise resolver teams novamente.

Output type:

```typescript
export interface MatchListItem {
  id: string;
  kickoffAt: string;
  stage: Stage;
  round: number;
  groupId: string | null;
  venue: { name: string; city: string } | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  predictionStatus: MatchPredictionStatus;
}

export interface MatchListItemDaySection {
  label: string;   // "Hoje" | "Amanhã" | "22 de junho de 2026"
  date: string;    // "yyyy-MM-dd" (React key estável)
  matches: MatchListItem[];
}

export interface MatchesListData {
  groups: MatchListItemDaySection[];
  flatList: MatchListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

### 6.4 useMatchDetail(id)

Composição:

```
matchQuery     = useMatch(id)
teamsQuery     = useTeams()
predictionsQuery = usePredictions(uid)
```

Output type:

```typescript
export interface MatchDetailData {
  match: MatchDetailItem | null;   // null quando ainda carregando ou 404
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export interface MatchDetailItem extends MatchListItem {
  // Herda todos os campos de MatchListItem; sem campos extras nesta TASK.
}
```

- `match === null` quando `matchQuery.data === null` (404) **ou** dados ainda carregando.
- Join de teams e derivação de predictionStatus idênticos ao `useMatchesList`.

### 6.5 `now` no compositor

Os compositores usam `new Date()` internamente — diferente dos helpers puros que exigem injeção. No compositor, `now` é capturado uma vez no render (padrão `deriveNotices` em `useHomeDashboard`). Nos testes, os mocks de `deriveMatchPredictionStatus` e `groupMatchesByDay` tornam a injeção de `now` desnecessária.

> **Nota:** Os helpers de lib já recebem `now` como parâmetro — o compositor passa `new Date()`.

## 7. Contracts and interfaces

### matchesKeys atualizado

```typescript
export const matchesKeys = {
  all:         () => ["matches"] as const,
  lists:       () => [...matchesKeys.all(), "list"] as const,
  list:        () => [...matchesKeys.lists()] as const,
  details:     () => [...matchesKeys.all(), "detail"] as const,
  detail:      (id: string) => [...matchesKeys.details(), id] as const,
  teams:       () => [...matchesKeys.all(), "teams"] as const,
  predictions: (uid: string) => [...matchesKeys.all(), "predictions", uid] as const,
} as const;
```

### Imports permitidos nos novos hooks

- `@tanstack/react-query` — `useQuery`, `useCallback`, `UseQueryResult`.
- `@/hooks/useAuth` — `useAuth`.
- `@/services` — `listPredictionsByUid`.
- `@/types` — `MatchWithId`, `TeamWithId`, `Prediction`, `Stage`, `MatchStatus`.
- `@/features/matches/lib` — funções e tipos de TASK-01.
- Hooks irmãos: `useMatches`, `useMatch`, `useTeams`, `matchesKeys`.
- `react` — `useCallback`.

## 8. Data and persistence impact

Nenhuma mudança de schema ou persistência. Apenas orquestração de queries existentes + join client-side.

## 9. Required tests

### useMatchesList.test.ts

Mockar: `@/hooks/useAuth`, `../useMatches`, `../useTeams`, `../usePredictions`, `@/firebase`.

#### Estado neutro (uid=null)
- retorna `groups=[]`, `flatList=[]`, `isLoading=false`, `isError=false` quando uid é null.

#### isLoading
- `true` quando `matchesQuery.isLoading=true`.
- `true` quando `teamsQuery.isLoading=true`.
- `true` quando `predictionsQuery.isLoading=true`.
- `false` quando todas as queries carregaram.

#### isError
- `true` quando `matchesQuery.isError=true`.
- `true` quando `teamsQuery.isError=true`.
- `true` quando `predictionsQuery.isError=true`.
- `false` quando nenhuma query falhou.

#### refetch
- Chama `.refetch()` das 3 queries quando invocado.

#### Join + derivação
- matches com teams → `flatList[0].homeTeam.name` correto.
- teams vazio → `flatList[0].homeTeam.name` = teamId raw (fallback `resolveTeam`).
- prediction presente para match → `flatList[0].predictionStatus = "enviado"`.
- sem prediction + scheduled + now < kickoff → `predictionStatus = "pendente"`.
- now >= kickoff → `predictionStatus = "bloqueado"` (independente de prediction).

#### Agrupamento
- 2 matches no mesmo dia → 1 grupo com 2 matches.
- 2 matches em dias diferentes → 2 grupos.
- array de matches vazio → `groups=[]`.

### useMatchDetail.test.ts

Mockar: mesmos de useMatchesList.

#### Estado neutro (uid=null)
- `match=null`, `isLoading=false`, `isError=false`.

#### isLoading / isError
- Espelha useMatchesList (3 queries).

#### match=null
- quando `matchQuery.data=null` (404) → `match=null`.
- quando `matchQuery.isLoading=true` → `match=null`.

#### Join
- match com team resolvido → `match.homeTeam.name` correto.
- predictionStatus derivado corretamente.

## 10. Acceptance criteria

1. `matchesKeys.predictions(uid)` existe e retorna `["matches","predictions",uid]`.
2. `usePredictions(uid)` usa `matchesKeys.predictions(uid ?? "")` e `enabled: uid !== null`.
3. `useMatchesList()` expõe `{ groups, flatList, isLoading, isError, refetch }` com tipos corretos.
4. `useMatchDetail(id)` expõe `{ match, isLoading, isError, refetch }`.
5. `MatchListItem` e `MatchDetailItem` têm `homeTeam`, `awayTeam` (ResolvedTeam) e `predictionStatus` (MatchPredictionStatus).
6. Todos os testes passam (`rtk vitest run`) — zero falhas.
7. `rtk tsc` sem erros TypeScript (strict, sem `any`).
8. `hooks/index.ts` reexporta todos os novos hooks e tipos.
9. Nenhum import de `homeKeys` nos novos arquivos (sem cross-feature coupling).
10. Nenhum import de React, Firebase direto nos hooks — apenas via `@/hooks/useAuth` e `@/services`.

## 11. UI/Screen requirement

- **Requires screen:** no
- **Platform:** n/a

## 12. Constraints

1. **TypeScript strict** — sem `any`.
2. **Sem `homeKeys`** nos arquivos de `matches/hooks/` — namespace independente.
3. **uid via `useAuth().firebaseUser?.uid ?? null`** — mesma fonte que `useHomeDashboard`.
4. **Toda query via TanStack Query** — sem `fetch`/`useEffect` manual.
5. **Não modificar** `src/features/matches/lib/*` nem `src/features/matches/index.ts`.
6. **RTK prefix** para todos os comandos shell.
7. Testes com mocks inline (padrão `useHomeDashboard.test.ts`): `vi.mock` + `vi.mocked`.
8. `refetch` estável via `useCallback` (padrão B-02 do home).

## 13. Open questions

Nenhuma — decisões travadas no plan §1:
- uid source: `useAuth().firebaseUser?.uid` ✓
- Namespace: `matchesKeys` (sem homeKeys) ✓
- Global lock: omitido (regra per-match suficiente) ✓
- `now`: `new Date()` no compositor ✓
