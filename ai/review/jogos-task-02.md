# Review Report — TASK-02 (Jogos / PRD-03)

**Task:** TASK-02 – Hooks de dados de Jogos + compositor de view-model
**Commit:** d6d7717
**Spec:** `ai/spec/jogos-task-02.md`
**Plan:** `ai/plan/jogos.md` (TASK-02)
**Reviewer:** Claude (gsd-code-reviewer discipline, adversarial)
**Date:** 2026-06-07

---

## Verdict: approved with adjustments

- **BLOCKER:** 0
- **WARNING:** 2

---

## Scope of review

Files reviewed (7):

- `src/features/matches/hooks/matchesKeys.ts`
- `src/features/matches/hooks/usePredictions.ts`
- `src/features/matches/hooks/useMatchesList.ts`
- `src/features/matches/hooks/useMatchDetail.ts`
- `src/features/matches/hooks/index.ts`
- `src/features/matches/hooks/__tests__/useMatchesList.test.ts`
- `src/features/matches/hooks/__tests__/useMatchDetail.test.ts`

---

## Evidence gathered

- **IDE diagnostics** (`mcp__ide__getDiagnostics`) on all 7 files → **0 diagnostics** (TypeScript strict clean).
- **Tests** — `vitest run src/features/matches/hooks/__tests__` → PASS 37 / FAIL 0.
  Re-verified via JSON reporter (RTK false-green guard from MEMORY): `total 37, passed 37, failed 0, suites 14`. No load-failure masking.
- **`homeKeys` coupling** — grep of `matches/hooks/` finds no import; only explanatory comments referencing the deliberate decoupling. Constraint 2 / AC-9 satisfied.
- **`any`** — none in any reviewed file. Test `fakeQuery` uses `as unknown as UseQueryResult<T>` (acceptable test-only assertion, not `any`).
- **uid source** — `useAuth().firebaseUser?.uid ?? null` in both compositors, identical to `useHomeDashboard`. Constraint 3 / AC satisfied.
- **Direct React/Firebase imports** — only `react` (`useCallback`, allowed by contract §7) and `@/hooks/useAuth` + `@/services`; no direct `@/firebase`. AC-10 satisfied.

---

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `matchesKeys.predictions(uid)` → `["matches","predictions",uid]` | PASS |
| 2 | `usePredictions(uid)` uses `predictions(uid ?? "")` + `enabled: uid !== null` | PASS |
| 3 | `useMatchesList()` exposes `{ groups, flatList, isLoading, isError, refetch }` | PASS |
| 4 | `useMatchDetail(id)` exposes `{ match, isLoading, isError, refetch }` | PASS |
| 5 | `MatchListItem`/`MatchDetailItem` carry `homeTeam`/`awayTeam`/`predictionStatus` | PASS |
| 6 | All tests pass (zero failures) | PASS (37/37, JSON-verified) |
| 7 | `tsc` clean, strict, no `any` | PASS (0 diagnostics) |
| 8 | `hooks/index.ts` reexports new hooks + types | PASS |
| 9 | No `homeKeys` import | PASS |
| 10 | No direct React/Firebase; only `useAuth` + services | PASS |

All 10 acceptance criteria met. Faithful parity with the `useHomeDashboard` molde (uid guard, aggregated `isLoading`/`isError`, stable `useCallback` refetch with explicit `.refetch` deps, neutral state on `uid === null`).

---

## Findings

### WR-01 (WARNING) — `MatchListItem` widens spec types; acceptable but undocumented divergence

**File:** `src/features/matches/hooks/useMatchesList.ts:29-30`
**Issue:** Spec §6.3 declares `round: number` and `groupId: string | null`, but the implementation uses `round: number | null | undefined` and `groupId: string | null | undefined`. This is in fact the **correct** choice — `matchSchema` (`src/schemas/matches.ts:29-31`) declares both as `.nullable().optional()`, so narrowing per the spec would have been lossy/incorrect. The divergence is a silent spec-vs-source reconciliation. No code defect, but the wider type leaks `undefined` into the view-model the UI (TASK-03/04/06) must handle.
**Fix:** None required for correctness. Recommend a one-line code comment noting the type follows `MatchWithId` (source-of-truth) rather than the simplified spec shape, so downstream UI authors expect `round`/`groupId` to be possibly `undefined`.

### WR-02 (WARNING) — Redundant `flatListById` Map adds avoidable indirection in `useMatchesList`

**File:** `src/features/matches/hooks/useMatchesList.ts:133-145`
**Issue:** `groups` is built by calling `groupMatchesByDay(matches, now)` on the **raw** matches, then re-mapping each section's matches back to the enriched `MatchListItem` via a `flatListById` lookup Map. This re-derives grouping over a different array than `flatList` and relies on `id` round-tripping. It works (tests cover same-day/different-day/empty), but it is more fragile than necessary: any match present in `flatList` but dropped by `groupMatchesByDay` (or vice versa) would silently diverge, and the `flatMap`+`get` guard masks such a drift as a silently-omitted match rather than an error. Spec §6.3 explicitly allowed the simpler alternative ("agrupar os MatchListItem diretamente numa estrutura compatível").
**Fix:** Prefer grouping the already-enriched `flatList` directly (or have `groupMatchesByDay` operate on items keyed by `kickoffAt`), eliminating the second array and the lookup Map. Low priority — current behavior is correct and tested.

---

## Test quality assessment

Strong. Suites mirror `useHomeDashboard.test.ts`: mocks for `@/hooks/useAuth`, sibling hooks, and `@/firebase`; per-query `isLoading`/`isError` matrix; `refetch` fan-out; neutral `uid=null` state; join + fallback (`resolveTeam` raw-id fallback); `predictionStatus` across `enviado`/`pendente`/`bloqueado` (incl. past-kickoff blocking); day-grouping (same-day → 1 group, diff-day → 2 groups, empty → `[]`); detail `match=null` for both 404 and loading. Tests exercise the **real** TASK-01 lib functions (not mocked) with future/past kickoffs, so `now` injection is genuinely unnecessary as the spec claims, and the derivation logic is covered end-to-end rather than stubbed.

Minor note (not a finding): the `match=null` while-loading case for `useMatchDetail` is correct, but `useMatchesList` has no symmetric assertion that a still-loading `matches` query yields `flatList=[]` while `isLoading=true`; behavior is correct via the `?? []` guard and is implicitly covered.

---

## Security

No new attack surface. `usePredictions` is gated by `enabled: uid !== null` and reuses the existing `listPredictionsByUid` service; no direct Firestore/Firebase access, no input parsing, no persistence change. `uid!` non-null assertion in `queryFn` is safe — guarded by `enabled`. Nothing to flag.

---

_Reviewed: 2026-06-07 — gsd-code-reviewer adversarial discipline. Non-UI task (Requires screen: no) — UI checklist skipped per spec §11._
