# Code Review — PRD-09 TASK-02 (schema + types do pool)

**Reviewed:** 2026-06-11
**Depth:** standard (per-file + cross-reference to siblings)
**Scope:** `src/schemas/pools.ts`, `src/types/pools.ts`, `src/schemas/poolStatusTransition.ts` (+test), `src/schemas/index.ts`, `src/schemas/__tests__/pools.test.ts`
**Status:** issues_found (no blockers)

## Summary

Contract-only task: Zod `poolSchema` / `poolStatusSchema` / `poolInputSchema` + derived
types + a bonus `poolStatusTransition` helper. The implementation closely mirrors the
established sibling patterns (`notifications.ts` for the schema/input pair, `users.ts` for
`.strict()` + shared primitives, `userStatusTransition.ts` for the transition helper) and
correctly reuses `nonEmptyString` / `isoDateTime` from `@/schemas/shared` with **zero `any`**
and types derived strictly via `z.infer`.

Verification against real output:
- `vitest run` on `pools.test.ts` + `poolStatusTransition.test.ts` → **24 passed, 0 failed**.
- `tsc --noEmit` → **no errors** in any pool-related file.
- Slug regex `^[a-z0-9-]+$` empirically tested: rejects uppercase, underscore, space, empty,
  and **all newline-anchor bypass variants** (`"abc\n"`, `"\nabc"`, `"a\nb"` → false). The
  character class excludes `\n`, so the classic JS `$`-before-trailing-newline injection does
  **not** apply here. No BLOCKER on the regex.

All acceptance criteria in the spec are met. Findings below are quality/robustness only.

## Critical Issues

None.

## Warnings

### WR-01: `poolStatusTransition.ts` is out of declared scope for TASK-02

**File:** `src/schemas/poolStatusTransition.ts` (whole file), `src/schemas/index.ts:5`
**Issue:** The spec (§3 In scope, §4 Out of scope) scopes TASK-02 to `pools.ts` + types +
barrel + test, and explicitly defers status transition logic to **TASK-05** ("Sem
transição/lógica de status aqui — só o enum", §6). This file's own docblock says
"(PRD-09, TASK-05)". Shipping TASK-05 logic under a TASK-02 review means it bypasses the
review depth that the plan assigns to the status-mutation work and inflates this task's diff.
**Fix:** Acceptable to keep if intentionally pulled forward, but record it explicitly in the
TASK-02 summary and ensure TASK-05 does not re-review/re-implement it. Otherwise move the file
+ test to the TASK-05 branch. No code change required for correctness.

### WR-02: `updatedAt` field added beyond the spec'd field set without test coverage

**File:** `src/schemas/pools.ts:32`
**Issue:** `poolSchema` adds `updatedAt: isoDateTime.optional()`, which is not in the plan
field list (`{ id, name, slug, description?, photoBase64?, status, adminId, createdAt }`, plan
line 42) nor the spec contract (§7). The addition is reasonable and mirrors `users.ts`, but
**no test exercises it** — `pools.test.ts` never sets `updatedAt`, so neither the "accepts a
valid ISO `updatedAt`" path nor the "rejects non-ISO `updatedAt`" path is proven. Under
`.strict()`, an undeclared-but-intended field is exactly the kind of thing a regression can
silently drop.
**Fix:** Add two assertions to `pools.test.ts`:
```ts
it("aceita updatedAt ISO opcional", () => {
  expect(poolSchema.safeParse({ ...valid, updatedAt: "2026-06-05T13:00:00Z" }).success).toBe(true);
});
it("rejeita updatedAt não-ISO", () => {
  expect(poolSchema.safeParse({ ...valid, updatedAt: "ontem" }).success).toBe(false);
});
```

### WR-03: Transition refine uses a redundant `as` cast that masks a real type gap

**File:** `src/schemas/poolStatusTransition.ts:29` (and the mirrored `userStatusTransition.ts:32`)
**Issue:** `(ALLOWED_POOL_STATUS_TRANSITIONS[from] as readonly PoolStatus[]).includes(to)` —
the cast is needed only because the `as const satisfies` literal narrows each value to a
specific tuple (e.g. `["blocked"]`), so `.includes(to)` would otherwise reject `to` whose type
is the full union. The cast is benign here, but it is a `readonly PoolStatus[]` assertion that
would silently swallow a future typo if an allowed-list value drifted from the `PoolStatus`
union. It is not an `any`, so it does not violate the "zero any" constraint, but it is the kind
of cast that should be justified.
**Fix:** Either keep (mirrors the existing `userStatusTransition` convention — consistency wins)
or replace the cast with a typed helper, e.g.
`const allowed: readonly PoolStatus[] = ALLOWED_POOL_STATUS_TRANSITIONS[from];` then
`allowed.includes(to)`, which keeps the same behavior without an inline `as` at the call site.
Low priority — consistency with the sibling file is a defensible reason to leave as-is.

## Info

### IN-01: Slug regex admits hyphen-only / leading / trailing-hyphen slugs

**File:** `src/schemas/pools.ts:14`
**Issue:** `^[a-z0-9-]+$` accepts `"-"`, `"---"`, `"-abc"`, `"abc-"` (confirmed empirically).
These are valid storage keys but ugly URLs. The spec (§6) explicitly delegates uniqueness and
business validity to the server (TASK-04), so this is **not** a defect for this contract task —
noted only so TASK-04 normalization/validation is aware the schema does not guard against it.
**Fix:** None required here. Consider `^[a-z0-9]+(-[a-z0-9]+)*$` at the TASK-04 boundary if
clean slugs are desired.

### IN-02: `poolInputSchema` non-strict behavior is well-tested; document the asymmetry

**File:** `src/schemas/pools.ts:38`, `pools.test.ts:132-147`
**Issue:** The doc-schema is `.strict()` but the input-schema deliberately is not (mirrors
`notificationInputSchema`). This asymmetry is correct and the test at line 132 proves
server-set keys (`id`/`status`/`createdAt`) are stripped rather than rejected. Comment at
line 37 documents it. No action — flagged so reviewers don't mistake the missing `.strict()`
on the input for an oversight.

### IN-03: Duplicated field definitions between `poolSchema` and `poolInputSchema`

**File:** `src/schemas/pools.ts:25-26` vs `41-42`
**Issue:** `name`, `slug`, `description`, `photoBase64`, `adminId` are declared identically in
both schemas. This duplication matches the `notifications.ts` house pattern, so it is
consistent, but a future change to `description.max()` must be made in two places. Minor.
**Fix:** Optional — could derive the input via `poolSchema.pick({...})`, but that diverges from
the established sibling pattern; leaving duplicated is the consistent choice.

---

## Gate

**PASS (no blockers).**

- All spec acceptance criteria met; 24/24 tests green; tsc clean; zero `any`; types via `z.infer`.
- Slug regex verified safe against anchor/newline bypass.
- 0 BLOCKER · 3 WARNING · 3 INFO.
- Recommended before closing TASK-02: add `updatedAt` test coverage (WR-02) and explicitly
  reconcile the scope of `poolStatusTransition.ts` with TASK-05 (WR-01). Neither blocks merge.

_Reviewed: 2026-06-11 — gsd-code-reviewer (standard depth)_
