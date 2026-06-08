# SPEC

## 1. Task: TASK-04 – Serviços de leitura de ranking (Client SDK)

## 2. Objective

Camada de serviço (funções puras de Firestore, Client SDK) que lê os documentos gravados pela TASK-03 e os entrega validados por Zod às telas. Segue o padrão de `getGeneralRanking` (erros crus, `.parse` por doc, sem React/cache).

## 3. In scope

Estender `src/services/rankings.ts`:
1. `getRankingByScope(scope)` — `rankings/{scope}` por doc id.
2. `getGeneralRanking()` — **refatorar** p/ delegar a `getRankingByScope("geral")` (doc-based; remove o `where`+`limit` atual).
3. `getGroupRanking(groupId)` — `rankings/grupo-{groupId}`.
4. `getUserRanking(uid)` — linha do usuário no ranking geral + total de participantes.
5. `getParticipantProfile(uid)` — `statistics/{uid}`.
6. `getPoolStats()` — `pool_stats/current`.
7. Atualizar `src/services/index.ts` (barrel) e `src/services/__tests__/rankings.test.ts`.

## 4. Out of scope

- Hooks React Query (TASK-05), UI (TASK-07+), gravação (TASK-03).
- Tradução de erros (propaga cru, padrão do projeto).

## 5. Main technical areas

`src/services/rankings.ts`, `src/services/index.ts`, `src/services/__tests__/rankings.test.ts`. Usa `firestore` (`@/firebase`), `doc`/`getDoc` (`firebase/firestore`), schemas/tipos TASK-01 (`rankingSchema`, `groupRankingSchema`, `statisticsSchema`, `poolStatsSchema`; tipos `Ranking`, `GroupRanking`, `RankingEntry`, `Statistics`, `PoolStats`; `RankingScope` de `@/types`/shared).

## 6. Business rules and behavior

- Leitura por **doc id direto** (`getDoc`), mais barato que query — alinhado aos paths da TASK-03: `rankings/{scope}`, `rankings/grupo-{groupId}`, `statistics/{uid}`, `pool_stats/current`.
- Doc inexistente → retorna `null` (não lança).
- Doc existente → `schema.parse(snap.data())` (lança ZodError se fora do schema — mesmo contrato do `getGeneralRanking` atual).
- Erros do Firebase propagam crus (com `code`).
- `getUserRanking(uid)`: lê o ranking geral; encontra `entry.uid === uid`; retorna `{ entry, total }` onde `total = entries.length`. Usuário ausente do ranking → `null`.
- `getGeneralRanking()` mantém a mesma assinatura/retorno (`Promise<Ranking | null>`) — só muda a implementação interna (doc em vez de where). Consumidores (`useGeneralRanking`, RankingCard da Home) inalterados.

## 7. Contracts and interfaces

```ts
import type { RankingScope } from "@/types"; // ou @/schemas/shared (z.infer do rankingScopeSchema)

export function getRankingByScope(scope: RankingScope): Promise<Ranking | null>;
export function getGeneralRanking(): Promise<Ranking | null>; // = getRankingByScope("geral")
export function getGroupRanking(groupId: string): Promise<GroupRanking | null>;

export interface UserRankingResult { entry: RankingEntry; total: number; }
export function getUserRanking(uid: string): Promise<UserRankingResult | null>;

export function getParticipantProfile(uid: string): Promise<Statistics | null>;
export function getPoolStats(): Promise<PoolStats | null>;
```

Doc paths:
- `getRankingByScope(scope)` → `doc(firestore, "rankings", scope)`
- `getGroupRanking(groupId)` → `doc(firestore, "rankings", \`grupo-${groupId}\`)`
- `getParticipantProfile(uid)` → `doc(firestore, "statistics", uid)`
- `getPoolStats()` → `doc(firestore, "pool_stats", "current")`

> Nota: `RankingScope` precisa ser tipo exportado. Se ainda não existir em `@/types`, derivar `export type RankingScope = z.infer<typeof rankingScopeSchema>` no barrel de tipos shared (mudança mínima, sem novo schema).

## 8. Data and persistence impact

Somente leitura. Nenhuma escrita. Sem migração. Lê coleções `rankings`, `statistics`, `pool_stats` (criadas/gravadas pela TASK-03).

## 9. Required tests

`src/services/__tests__/rankings.test.ts` (estender; **atualizar** os testes de `getGeneralRanking` p/ o novo caminho doc-based). Mockar `firebase/firestore` (`doc`, `getDoc`) e `@/firebase`. Casos por função:
- doc existente → objeto validado retornado (campos corretos);
- doc inexistente (`snap.exists()===false`) → `null`;
- doc malformado → rejeita (ZodError);
- erro do `getDoc` → propaga cru;
- `getRankingByScope`: chama `doc(_, "rankings", scope)` com o scope passado;
- `getGroupRanking`: doc id `grupo-{groupId}`;
- `getUserRanking`: retorna `{ entry, total }` quando uid presente; `null` quando ausente; `total === entries.length`;
- `getParticipantProfile`/`getPoolStats`: path e parse corretos.

Verificar via JSON do vitest (memory rtk-vitest-false-green).

## 10. Acceptance criteria

- [ ] 6 funções implementadas e exportadas no barrel `services/index.ts`.
- [ ] Leitura por doc id direto nos paths da TASK-03.
- [ ] `getGeneralRanking` refatorada (doc-based) mantendo assinatura/retorno; `useGeneralRanking` e RankingCard seguem verdes.
- [ ] Doc inexistente → `null`; malformado → rejeita; erro Firebase → cru.
- [ ] `getUserRanking` retorna `{ entry, total }` ou `null`.
- [ ] `RankingScope` exportado como tipo.
- [ ] tsc strict, sem `any`; suite verde (incl. testes de serviço atualizados).

## 11. UI/Screen requirement

- Requires screen: **no**
- Platform: n/a · Screens: none · Product type / style / UX domains: n/a

(Camada de serviço — sem saída visual.)

## 12. Constraints

- Sem `any`; TypeScript strict.
- Seguir EXATAMENTE o padrão de `getGeneralRanking` (erros crus, `.parse`, sem tradução, sem React).
- `getDoc` por id (não `where`) nas novas funções.
- Não duplicar lógica: `getGeneralRanking` delega a `getRankingByScope`.
- Reusar schemas/tipos TASK-01; não redefinir.

## 13. Open questions

- **OQ1:** `getUserRanking` baseia-se só no ranking **geral** (Tela 02 "Sua Posição Atual" é geral). Posição por fase/grupo é obtida pelas telas via `getRankingByScope`/`getGroupRanking` + filtro client. Sem ambiguidade — confirmado pelo layout da Tela 02.
