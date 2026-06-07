---
task: home-dashboard-task-10
reviewed: 2026-06-07T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - src/features/home/components/HomeDashboard.tsx
  - src/app/(app)/home/page.tsx
  - src/features/home/components/__tests__/HomeDashboard.test.tsx
  - src/features/home/components/index.ts
cross_references_read:
  - ai/spec/home-dashboard-task-10.md
  - ai/screen/home-dashboard-task-06.md
  - ai/prd/home-dashboard.md
  - src/features/home/hooks/useHomeDashboard.ts
  - src/features/home/lib/homeDashboardHelpers.ts
  - src/components/layout/AppShell.tsx
  - src/features/home/components/CorrectScoresCard.tsx
  - src/features/home/components/AccuracyCard.tsx
  - src/features/home/components/PerformanceCard.tsx
  - src/features/home/components/NextMatchCard.tsx
  - src/features/home/components/HomeHeader.tsx
findings:
  blocker: 0
  warning: 1
  info: 1
  total: 2
status: approved_with_adjustments
verdict: approved with adjustments
---

# Review Report — Home Dashboard · TASK-10

**Reviewed:** 2026-06-07
**Depth:** deep (cross-file, call-chain, type boundary, a11y, test quality)
**Files Reviewed:** 4 (+ 10 cross-reference files)
**Verdict:** `approved with adjustments`

---

## Summary

TASK-10 implements the Home Dashboard page composition correctly. The `HomeDashboard` client component composes all 8 cards + header in the order specified by the screen contract. State machine (loading → skeletons, error → page-level retry, success → real cards) is correctly wired to `useHomeDashboard`. The `"use client"` boundary is correctly placed: `HomeDashboard.tsx` carries the directive; `page.tsx` is an intentional Server Component with no directive. The barrel export is correctly updated.

TypeScript compilation is clean (`npx tsc --noEmit` — zero errors). All 223 tests in the `src/features/home` scope pass, including the 28 new tests in `HomeDashboard.test.tsx`. IDE diagnostics on all 4 files return zero errors.

One WARNING is filed for a UX regression in loading state granularity relative to the screen contract. One INFO item is filed for a pre-existing empty-state text mismatch in `NextMatchCard` that surfaces through TASK-10's test assertions.

---

## Checklist Results

| Check | Result |
|---|---|
| All 8 cards + HomeHeader composed in correct visual order | PASS |
| `isLoading` → skeletons per card | PASS (single aggregated flag per spec §4.3 amendment) |
| `isError && !isLoading` → page-level error + refetch | PASS |
| `aria-live="polite"` + `role="alert"` on error container | PASS |
| `"use client"` on HomeDashboard only; page.tsx Server Component | PASS |
| Responsive grid (`grid-cols-3 gap-3` for metrics) | PASS |
| Skeleton dimensions match real cards (no layout shift) | PASS |
| No API-Football direct call | PASS |
| No `any` or inline styles | PASS |
| A11y: skeletons `role="status" aria-busy="true"` | PASS |
| A11y: header skeleton `aria-hidden="true"` | PASS |
| A11y: error icon `aria-hidden="true"` | PASS |
| A11y: retry button `min-h-[44px]` | PASS |
| Test T1–T6 coverage (loading/error/success/empty/retry) | PASS (28 tests, 0 failures) |
| `npx vitest run src/features/home` | PASS (223/223) |
| `npx tsc --noEmit` | PASS (0 errors) |

---

## Warnings

### WR-01: Aggregated `isLoading` prevents partial-data rendering — UX regression vs screen contract §5.1

**File:** `src/features/home/components/HomeDashboard.tsx:132–167` (all card branches)
**Classification:** WARNING
**Issue:** The screen contract (§5.1 — "Orquestração dos skeletons") explicitly specifies per-card independent loading: each card shows its skeleton while its respective query is loading, and cards with already-cached data render immediately. The TASK-10 spec §4.3 amends this to a single aggregated `isLoading` flag because `useHomeDashboard` does not expose per-query loading state.

The consequence is that if any single query is still loading (e.g., `settings` is slow), ALL 8 cards show skeletons simultaneously — including cards whose data (e.g., `ranking`, `statistics`) resolved seconds earlier. This creates a "everything flashes in at once" experience rather than the progressive revelation specified in the screen contract, and extends the perceived loading time.

The root cause is in `useHomeDashboard` (TASK-05), not TASK-10, but the TASK-10 spec chose to accept this limitation rather than fix it upstream.

**Fix (deferred to future task):** `useHomeDashboard` should expose per-query loading flags (e.g., `isRankingLoading`, `isStatsLoading`, `isMatchesLoading`, `isSystemLoading`) so TASK-10 can wire each card independently. Alternatively, expose the raw query objects. TASK-10's implementation is correct per its own spec; the fix belongs in the compositor.

**Risk:** Low for MVP (< 100 users, data loads fast). Medium for production if any Firestore query is slow.

---

## Info

### IN-01: NextMatchCard empty-state text diverges from screen contract §3.4.3

**File:** `src/features/home/components/__tests__/HomeDashboard.test.tsx:269–273`
**Classification:** INFO
**Issue:** Test T23 asserts `screen.getByText("Nenhum jogo disponível")`. The screen contract §3.4.3 specifies the empty-state text as "Nenhum jogo agendado". The component (`NextMatchCard.tsx:172`) renders "Nenhum jogo disponível". The test correctly matches what the component renders, but the component diverges from the visual contract.

This is a TASK-08 implementation decision that surfaces here in TASK-10 test assertions. It is not a TASK-10 bug — the composition and test are internally consistent. The discrepancy should be tracked and resolved when updating the screen contract or the component.

**Fix:** Either update `NextMatchCard.tsx` to render "Nenhum jogo agendado" (matching screen contract) and update the test, or formally amend §3.4.3 of the screen contract. No action required in TASK-10.

---

## Detailed Findings by Category

### Scope — PASS

All four required files are implemented: `HomeDashboard.tsx` (new), `page.tsx` (replaced), `components/index.ts` (updated with barrel export), `HomeDashboard.test.tsx` (new with 28 tests). No beyond-scope changes detected.

### Architecture — PASS

- `HomeDashboard.tsx` is correctly a client component (`"use client"` at line 1); `page.tsx` is correctly a thin Server Component with no directive.
- `HomeDashboard` does not reach into Firestore directly; all data comes through `useHomeDashboard` (TanStack Query compositor).
- `useAuth()` is called once in `HomeDashboard` for `profile.name` and `firebaseUser.uid` (HomeHeader props), and once internally in `useHomeDashboard` for `uid`. This double-read of the same context is redundant but harmless (React context reads are O(1) and idempotent). A future refactor could pass `uid` to `useHomeDashboard` as a param, but this is out of scope.
- `ErrorState` is a private sub-component (not exported) — correct responsibility placement.
- `HomeHeaderSkeleton` is a private sub-component — correct.

### Business Correctness — PASS

- Error condition: `isError && !isLoading` correctly prioritises skeletons over error during initial fetch (spec §3.1 "enquanto há loading, mostramos skeletons").
- Success path: all 8 cards receive correct data props from `useHomeDashboard` destructure; no prop inversion detected.
- Type boundary: `PerformanceSummary.totalCorrect: number` is widened by `CorrectScoresCard`'s prop type `number | null` — assignment is safe (number is assignable to `number | null`). No type error, no runtime risk.
- `profile?.name ?? null` and `firebaseUser?.uid ?? null` — correct null guards for HomeHeader; HomeHeader's own component handles `null` name with "Olá 👋" fallback (verified at line 32 of HomeHeader.tsx).

### Contracts & Persistence — PASS

No writes, no mutations. Read-only composition layer. No contract breaks.

### Test Quality — PASS WITH NOTE

28 tests across 4 describe blocks cover all required scenarios:
- T1–T4b: loading state (skeletons present, header absent, error absent, HomeHeaderSkeleton testid)
- T5–T10: error state (message, button, refetch call, role="alert", no skeletons, no header)
- T11–T20: success state (header with name, subtitle, cards rendered, role-based queries)
- T21–T27: empty state (all null/empty data without crash, individual empty-state texts)

Mocks are correct: `vi.mock` declarations before imports, `vi.mocked` for typed helpers, `beforeEach` resets prevent test bleeding.

One mild fragility: T11 asserts `screen.getByText("Olá, Ana Lima 👋")` with an emoji literal. This is reliable here because the emoji is a hardcoded string in `HomeHeader.tsx:32`, not dependent on locale or external data. No risk in practice.

Tests do NOT cover: the `performance.accuracy` display in PerformanceCard (only AccuracyCard is tested). This is acceptable — card-level display is tested in TASK-07/08/09 specs; TASK-10 integration tests need only confirm composition.

### Maintainability & Risk — PASS

- All JSDoc comments in pt-BR, consistent with project conventions.
- No magic numbers; all Tailwind classes are semantic tokens.
- Component is 207 lines — within reason for a page compositor.
- The `isError && !isLoading` guard is idiomatic and easy to reason about.

### A11y Deep Check — PASS

| Element | Expected | Actual |
|---|---|---|
| Error container | `role="alert" aria-live="polite"` | Present (lines 51–54) |
| Error icon | `aria-hidden="true"` | Present (line 57) |
| Retry button | `min-h-[44px]` | Present (line 68) |
| Header skeleton | `aria-hidden="true"` | Present (line 92) |
| Header skeleton | `data-testid="home-header-skeleton"` | Present (line 89) — enables T4b |
| Card skeletons | `role="status" aria-busy="true"` | Delegated to individual card skeleton components (verified in CorrectScoresCardSkeleton) |

No a11y violations found in TASK-10's own code.

---

## Security Assessment

No security concerns: component is read-only, no user input, no external API calls, no eval/dangerouslySetInnerHTML, no hardcoded secrets. Firestore access is fully mediated by existing service layer and TanStack Query.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (adversarial — gsd-code-reviewer discipline)_
_Depth: deep_
