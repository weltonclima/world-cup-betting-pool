# VERIFICATION

## 1. Task: TASK-04 – Serviços de leitura de ranking

## 2. Must-have truths
- T-01: 6 funções implementadas e exportadas no barrel — **VERIFIED**
- T-02: Leitura por doc id nos paths corretos — **VERIFIED**
- T-03: `getGeneralRanking` delega `getRankingByScope("geral")`, assinatura mantida, Home verde — **VERIFIED**
- T-04: inexistente→null, malformado→rejeita, erro Firebase→cru — **VERIFIED**
- T-05: `getUserRanking` {entry,total} | null — **VERIFIED**
- T-06: cada doc validado por schema TASK-01 — **VERIFIED**
- T-07: sem any, tsc strict, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `services/rankings.ts` exporta getRankingByScope/getGeneralRanking/getGroupRanking/getUserRanking/getParticipantProfile/getPoolStats; `services/index.ts:14-23` reexporta as 6 + `UserRankingResult`.
- **T-02:** `doc(firestore,"rankings",scope)`, `doc(...,"rankings",`grupo-${groupId}`)`, `doc(...,"statistics",uid)`, `doc(...,"pool_stats","current")`. Testes assertam `docMock` chamado com esses paths.
- **T-03:** `getGeneralRanking()` = `return getRankingByScope("geral")` (retorno `Promise<Ranking|null>`). Suite full 1732/1732 inclui testes da Home (RankingCard/useGeneralRanking mockam o serviço, não firebase) → verdes.
- **T-04:** `if (!snapshot.exists()) return null;` + `schema.parse(...)` (lança ZodError); `getDoc` rejeitado propaga (sem try/catch). Testes: null, ZodError (scope inválido), erro cru (`rejects.toBe(err)`).
- **T-05:** `getUserRanking` lê geral, `entries.find(uid)`; retorna `{entry, total: entries.length}` ou null. Testes: u2 entry+total 2; uid ausente→null; sem ranking→null.
- **T-06:** `rankingSchema`/`groupRankingSchema`/`statisticsSchema`/`poolStatsSchema` `.parse` por função.
- **T-07:** scan `any` → nenhum; tsc exit=0; vitest full 1732/1732 (539 suites).

## 4. Test correlation
`services/__tests__/rankings.test.ts` (15 testes) — assertam path do `doc()`, objeto parseado retornado, null em inexistente, rejeição em malformado/erro, composição de `getUserRanking`. Mocks só de `firebase/firestore` e `@/firebase` (não mockam a função sob teste).

## 5. Out-of-scope drift
none. Refactor de `getGeneralRanking` (where→doc) está no escopo do spec (§3.2, decisão explícita). Sem hooks/UI.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum

## 7. Verdict: goal-achieved
