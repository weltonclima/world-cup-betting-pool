---
task: PRD-09 / TASK-01
title: Evolução do enum de role (dupla-compat) + groupId opcional no usuário
reviewed: 2026-06-11
depth: deep
reviewer: gsd-code-reviewer (adversarial)
files_reviewed:
  - src/schemas/shared.ts
  - src/schemas/users.ts
  - src/types/shared.ts
  - src/types/users.ts
  - src/schemas/__tests__/shared.test.ts
  - src/schemas/__tests__/users.test.ts
  - src/schemas/index.ts
findings:
  blocker: 0
  warning: 2
  info: 3
  total: 5
gate: PASS
---

# Code Review — PRD-09 TASK-01

**Status:** PASS (no blockers)
**Depth:** deep (contract + cross-file consumer trace)

## Summary

TASK-01 is a contract-only change: `roleSchema` expanded to 5 values
(`participant | group_admin | super_admin` canonical + `user | admin` legacy),
`groupId?` added to `userSchema`, and three pure role helpers introduced. The
implementation is **correct and faithful to the spec**. The critical acceptance
check (R4 — legacy `{ role:"admin"/"user", no groupId }` must still parse) is
implemented and explicitly tested (`users.test.ts:68-71, 87-96`).

Verification gates all green:
- `npx vitest run shared.test.ts users.test.ts` → 27 passed, 0 failed
- `npx tsc --noEmit` → clean
- `npx eslint <task files>` → no issues
- Grep of `=== "admin"` confirms **no authorization surface touched** (still raw
  in `Header.tsx`, `AdminGuard.tsx`, `verifySession.ts`, `recalc/route.ts`,
  `ProfileHub.tsx` — correctly deferred to TASK-06).

No `any`, no string-comparison leakage outside schemas, types derived via
`z.infer` (no hand-rolled types). Helper totality (no throw) holds and is proven
by the partition test (`shared.test.ts:120-136`). This meets all acceptance
criteria for a contract-only task.

## Blockers

None.

## Warnings

### WR-01: Helpers are typed-total but not value-total — silent `false` on unexpected runtime input

**File:** `src/schemas/shared.ts:23-33`
**Issue:** The helpers accept `RoleValue` (the 5-value union) and the spec
guarantees totality *for a valid `Role`*. That is honored at the type level. But
these helpers are designed to become the "single source of truth for role
checks" consumed in TASK-06 across **claim-derived** and **JWT-derived** values
(`verifySession.ts`, middleware, functions) — surfaces where the input is
`unknown`/`string` at runtime, not a parsed `Role`. If a caller passes a string
that bypassed schema validation (e.g. a stale custom claim `"root"`, or
`undefined`), every helper returns `false`. For `isParticipantRole`/
`isGroupAdminRole` that fails closed (safe). For `isSuperAdminRole` it also fails
closed (good — no privilege escalation). The risk is the inverse: a *legitimately
privileged* but unexpectedly-shaped value silently downgrades to "no role",
which in TASK-06 could cause **lockout** (R1) rather than escalation.

This is not a defect in TASK-01's contract (the signature is correctly `Role`),
but the helper API is being created here *specifically* to be the guardrail for
TASK-06, and it provides no runtime-narrowing or "unknown role" signal. The
classification is partition-by-omission, which is brittle for a security helper.

**Fix (recommend for TASK-06 wiring, note here):** Either (a) keep helpers
strictly typed and force callers to `roleSchema.parse`/`safeParse` before calling
(make that a documented precondition + lint rule), or (b) add an explicit
narrowing variant for untrusted input, e.g.:

```ts
// optional companion for claim/JWT-derived (untrusted) values
export function classifyRole(raw: unknown): RoleValue | null {
  return roleSchema.safeParse(raw).success ? (raw as RoleValue) : null;
}
```

Document the chosen precondition in the helper JSDoc so TASK-06 cannot misuse it.

### WR-02: Type-level test for `User["role"]` / `Role` is order/shape-coupled and omits `super_admin` in one assertion path

**File:** `src/schemas/__tests__/shared.test.ts:171-173`, `users.test.ts:99-101`
**Issue:** `expectTypeOf<Role>().toEqualTypeOf<"participant" | "group_admin" |
"super_admin" | "user" | "admin">()` is correct and currently passing, but it
hard-codes the full union inline in two separate files. If TASK-12 removes legacy
values, **both** literal lists must be hand-edited in lockstep or the tests go
green against a stale expectation. More importantly, the value-level role test
(`shared.test.ts:26-37`) and the type-level test are the only guards that the
enum stays in sync with the helpers' partition — there is no single test that
asserts "every member of `roleSchema.options` is classified by exactly one
helper" driven *from the schema itself*. The partition test (`:120-136`)
hard-codes the 5 strings rather than iterating `roleSchema.options`, so adding a
6th role to the enum without a helper update would **not** fail any test.

**Fix:** Drive the partition test from the schema so it stays honest as the enum
evolves:

```ts
it("todo valor do roleSchema cai em exatamente um helper", () => {
  for (const r of roleSchema.options) {
    const hits = [isSuperAdminRole(r), isGroupAdminRole(r), isParticipantRole(r)]
      .filter(Boolean).length;
    expect(hits, `role ${r} não classificado por exatamente um helper`).toBe(1);
  }
});
```

## Info

### IN-01: `groupId` validity not asserted against a `nonEmptyString` *boundary* beyond empty

**File:** `src/schemas/__tests__/users.test.ts:87-96`
**Issue:** Tests cover `groupId` absent (ok), present non-empty (ok), and `""`
(reject). Spec §6 says `groupId` is `nonEmptyString`. Coverage is adequate for
the contract, but there's no assertion that a non-string (e.g. `groupId: 123` or
`null`) is rejected — relevant because Firestore docs can carry unexpected types.
Low value (Zod handles it), but worth a one-liner for a persistence-facing field.
**Fix:** add `expect(userSchema.safeParse({ ...valid, groupId: 123 as unknown as string }).success).toBe(false);`

### IN-02: `index.ts` barrel comment is stale ("9 coleções ... (TASK-07)")

**File:** `src/schemas/index.ts:1`
**Issue:** Comment says "9 coleções Firestore + shared (TASK-07)" but the barrel
now re-exports ~18 modules including `pools`/`poolStatusTransition` (PRD-09). The
new helpers (`isSuperAdminRole` etc.) are correctly re-exported transitively via
`export * from "./shared"` — verified. Comment is just out of date.
**Fix:** update the count/reference, e.g. "Barrel de schemas Firestore + shared
(role helpers, primitivos)."

### IN-03: Legacy `valid` fixture uses `role: "user"` — good, but new-canonical default not the baseline

**File:** `src/schemas/__tests__/users.test.ts:6-13`
**Issue:** The shared `valid` fixture pins `role:"user"` (legacy). This is
intentional and *correct* for proving dupla-compat is the default path. Noted
only so TASK-12 reviewers remember to flip this fixture to a canonical role
(`participant` + `groupId`) when legacy acceptance is removed — otherwise the
whole suite will silently keep exercising the legacy path post-cutover.
**Fix:** no change now; add a `// TASK-12: flip to canonical when legado removido`
marker to avoid a stale baseline later.

## Cross-file / contract verification (deep pass)

- `z.infer` chain verified: `roleSchema` → `Role` (`types/shared.ts:13`) →
  `userSchema.role` → `User["role"]` (`types/users.ts:5`). No manual type drift.
- `groupId?: string | undefined` propagates correctly to `User` and is asserted
  (`users.test.ts:106`). `.strict()` preserved and tested (`users.test.ts:62-66`).
- No circular import: helpers use a local `RoleValue = z.infer<typeof roleSchema>`
  inside `shared.ts` rather than importing `Role` from `@/types/shared`
  (comment at `shared.ts:16-17`) — correct, avoids schema↔types cycle.
- Out-of-scope boundary respected: `verifySession.ts:51-52` still normalizes only
  `admin|user` and will drop `super_admin`/`participant` to `null`. This is a
  **known TASK-06 gap**, explicitly out of scope here (spec §4), so NOT a finding
  against TASK-01 — flagged only as a reminder that TASK-06 must update this or
  super_admin sessions break.

## Gate

**PASS** — Contract is correct, dupla-compat (R4) implemented and tested, all
acceptance criteria met, all gates green (vitest 27/0, tsc clean, eslint clean,
no authz surface touched). Two warnings are hardening/robustness for the helper
API and test resilience as the enum evolves toward TASK-12 — neither blocks ship
of a contract-only task.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
