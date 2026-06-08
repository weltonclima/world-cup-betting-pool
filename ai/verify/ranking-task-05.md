# VERIFICATION

## 1. Task: TASK-05 – Hooks React Query de ranking

## 2. Must-have truths
- T-01: 5 hooks + rankingKeys criados e exportados; useGeneralRanking reexportado sem duplicar key — **VERIFIED**
- T-02: Hooks sem staleTime/gcTime próprios (herdam global) — **VERIFIED**
- T-03: enabled guard p/ groupId/uid; useMyRanking deriva uid de useAuth — **VERIFIED**
- T-04: Query-keys distintas (user vs profile) evitam colisão de cache — **VERIFIED**
- T-05: Consulta via TanStack Query (sem fetch/useEffect manual) — **VERIFIED**
- T-06: sem any, tsc strict, suite verde; index exporta hooks+lib — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `hooks/{useRanking,useGroupRanking,useMyRanking,useParticipantProfile,usePoolStats,rankingKeys}.ts`; `hooks/index.ts` reexporta os 5 + rankingKeys + `useGeneralRanking from "@/features/home/hooks/useGeneralRanking"` (mesma key da Home `homeKeys.generalRanking()` — sem duplicação).
- **T-02:** Cada `useQuery` só passa `queryKey`+`queryFn` (+`enabled` onde aplicável). Nenhum `staleTime`/`gcTime` → herda QueryClient global.
- **T-03:** `useGroupRanking`/`useParticipantProfile`: `enabled: Boolean(groupId|uid)`, `queryFn` usa `!` sob guard. `useMyRanking`: `const uid = useAuth().firebaseUser?.uid; enabled: Boolean(uid)`.
- **T-04:** `rankingKeys.user(uid)` = `["ranking","user",uid]` (UserRankingResult, useMyRanking); `rankingKeys.profile(uid)` = `["ranking","profile",uid]` (Statistics, useParticipantProfile). Keys separadas — colisão (mesmo uid, shapes distintos) eliminada.
- **T-05:** Todos via `useQuery`; nenhum `useEffect`/`fetch` manual. `"use client"` em cada hook.
- **T-06:** scan `any` → nenhum; `tsc --noEmit` exit=0; vitest full 1732/1732; `rankings/index.ts` = `export * from "./hooks"` + `"./lib"`.

## 4. Test correlation
Sem testes unitários dedicados (TDD: no — wiring; decisão do spec §9). Cobertura real virá via componentes nas TASK-08..13 (render com QueryClientProvider). Não-regressão garantida pela suite full 1732/1732 (inclui Home que usa useGeneralRanking reexportado). Sem testes superficiais adicionados (evita "passa por motivo errado").

## 5. Out-of-scope drift
none. Apenas `src/features/rankings/hooks/*` + barrel da feature. Reexport de useGeneralRanking é reuso explícito (spec §6), não duplicação.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota positiva: colisão de query-key (user vs profile) detectada e corrigida na implementação antes do commit.

## 7. Verdict: goal-achieved
