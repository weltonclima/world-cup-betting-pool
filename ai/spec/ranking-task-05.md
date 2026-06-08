# SPEC

## 1. Task: TASK-05 – Hooks React Query de ranking

## 2. Objective

Camada de dados (TanStack Query) que expõe os serviços da TASK-04 às telas, com query-keys centralizadas e cache herdado do QueryClient global. Sem fetch/useEffect manual (regra CLAUDE.md).

## 3. In scope

`src/features/rankings/hooks/`:
1. `rankingKeys.ts` — factory de query-keys.
2. `useRanking(scope)` → `getRankingByScope`.
3. `useGroupRanking(groupId)` → `getGroupRanking` (enabled só com groupId).
4. `useMyRanking()` → `getUserRanking(uid da sessão)` (uid via `useAuth`; enabled só com uid).
5. `useParticipantProfile(uid)` → `getParticipantProfile` (enabled só com uid).
6. `usePoolStats()` → `getPoolStats`.
7. `useGeneralRanking()` — reexport/delegação ao hook existente (não duplicar).
8. Barrels `hooks/index.ts` + `src/features/rankings/index.ts`.

## 4. Out of scope

- Serviços (TASK-04), UI (TASK-07+), gravação (TASK-03).
- Redefinição de `staleTime`/`gcTime` (herda global — A3).

## 5. Main technical areas

`src/features/rankings/hooks/*`, `src/features/rankings/index.ts`. Usa `@tanstack/react-query` (`useQuery`), serviços de `@/services`, `useAuth` (`@/hooks/useAuth`), tipos `@/types` + `RankingScope`.

## 6. Business rules and behavior

- Cada hook é fino: `useQuery({ queryKey, queryFn })`, **sem** `staleTime`/`gcTime` (herda 30min/24h do QueryClient global — decisão A3; PRD pedia 5min, mantemos 30min por simplicidade <100 users).
- **`enabled`**: `useGroupRanking`/`useParticipantProfile` desabilitados quando `groupId`/`uid` ausente (`enabled: Boolean(x)`); `queryFn` só roda com valor presente. `useMyRanking` usa `useAuth().firebaseUser?.uid` → `enabled: Boolean(uid)`.
- `useMyRanking` deriva uid da sessão (não recebe por arg). Deslogado → query desabilitada, sem chamada.
- Query-keys estáveis (`as const`), padrão `homeKeys` do projeto.
- `useGeneralRanking`: reexportar o existente de `@/features/home/hooks` (ou criar delegação em rankings/hooks que chama o mesmo serviço com a mesma key `homeKeys.generalRanking()`). **Não** criar segunda key divergente para o mesmo dado — evitar cache duplicado. Decisão: reexportar o hook da Home a partir do barrel de rankings.

## 7. Contracts and interfaces

```ts
// rankingKeys.ts
export const rankingKeys = {
  all:    ()                       => ["ranking"] as const,
  scope:  (scope: RankingScope)    => ["ranking", "scope", scope] as const,
  group:  (groupId: string)        => ["ranking", "group", groupId] as const,
  user:   (uid: string)            => ["ranking", "user", uid] as const,
  poolStats: ()                    => ["pool-stats"] as const,
} as const;

export function useRanking(scope: RankingScope): UseQueryResult<Ranking | null>;
export function useGroupRanking(groupId: string | undefined): UseQueryResult<GroupRanking | null>;
export function useMyRanking(): UseQueryResult<UserRankingResult | null>;
export function useParticipantProfile(uid: string | undefined): UseQueryResult<Statistics | null>;
export function usePoolStats(): UseQueryResult<PoolStats | null>;
// useGeneralRanking reexportado de @/features/home/hooks
```

- Tipos de `@/types` (`Ranking`, `GroupRanking`, `Statistics`, `PoolStats`, `RankingScope`) e `UserRankingResult` de `@/services`.
- `queryFn` de hooks com arg opcional: assume valor presente (guardado por `enabled`); usar `groupId!`/`uid!` dentro do `queryFn` (seguro pois `enabled` bloqueia execução sem valor).

## 8. Data and persistence impact

Nenhum (camada de cache de leitura). Sem efeitos colaterais.

## 9. Required tests

Recommended TDD: **no** (wiring). Testes leves opcionais (não obrigatórios nesta task): que `enabled` é false sem uid/groupId. A cobertura real vem via componentes nas TASK-08..13 (render com QueryClientProvider). Não criar testes superficiais que apenas verificam `useQuery` chamado.

## 10. Acceptance criteria

- [ ] 5 hooks + `rankingKeys` criados; `useGeneralRanking` reexportado (sem key duplicada).
- [ ] Hooks sem `staleTime`/`gcTime` próprios (herdam global).
- [ ] `enabled` correto p/ uid/groupId ausentes; `useMyRanking` deriva uid de `useAuth`.
- [ ] Query-keys estáveis `as const` no padrão do projeto.
- [ ] Barrels atualizados; tsc strict, sem `any`; suite verde.

## 11. UI/Screen requirement

- Requires screen: **no**
- Platform: n/a · Screens: none · Product type / style / UX domains: n/a

(Camada de dados/cache — sem saída visual.)

## 12. Constraints

- Sem `any`; TypeScript strict.
- Toda consulta via TanStack Query (CLAUDE.md) — sem fetch/useEffect manual.
- Não redefinir cache por hook (A3).
- Não duplicar `useGeneralRanking` nem sua query-key.
- `"use client"` nos arquivos de hook (consomem React/Query).

## 13. Open questions

- **OQ1:** `useMyRanking` usa `firebaseUser.uid` (id de auth) — consistente com `getUserRanking(uid)` e com os entries do ranking (uid = users.uid = auth uid). Sem ambiguidade.
