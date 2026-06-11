---
task: PRD-09 TASK-03
title: Firestore — rules + índices de `pools` e ajuste de `users`
reviewed: 2026-06-11T00:00:00Z
depth: deep
reviewer: gsd-code-reviewer
files_reviewed: 3
files_reviewed_list:
  - firestore.rules
  - firestore.indexes.json
  - test/rules/firestore.rules.test.ts
findings:
  blocker: 0
  warning: 1
  info: 3
  total: 4
gate: PASS_WITH_NOTES
---

# PRD-09 TASK-03 — Code Review (Firestore rules + índices)

**Reviewed:** 2026-06-11
**Depth:** deep (cross-referenced rules ↔ tests ↔ spec/plan)
**Status:** issues_found (no blockers)

## Summary

Adversarial security review of the `pools` rules block, the role helpers
(`isSuperAdmin`/`isGroupAdmin`), the `users` create adjustment for the
`participant` role, and the four indexes. The five highest-value security
properties were traced end-to-end against the emulator tests:

1. **pools write fully denied (Admin SDK only)** — `allow write: if false`
   (firestore.rules:115). Covered by C69 (approved create), C70 (admin update
   → active), C71 (admin create), C72 (admin delete). **Verified — no write
   leak.**
2. **pools read restricted to active + approved** — `isApproved() &&
   resource.data.status == "active"` (firestore.rules:114). Pending/blocked
   denied (C65/C66), non-approved denied (C67/C67b), unauth denied (C68), and
   crucially the "rules are not a filter" deny paths for unrestricted/non-active
   queries (C74b, C74). **Verified — no pending/blocked pool leak.**
3. **No privilege escalation at signup** — create forces `status=="pending"`
   and `role in {user, participant}` (firestore.rules:51-56). Escalation to
   `approved` (C76), `group_admin` (C77), `super_admin` (C78), and
   `admin`/`approved` legacy (C10) all denied. **Verified.**
4. **Dual-compat / no lockout (R1)** — `isSuperAdmin()` accepts
   `admin || super_admin` (firestore.rules:30-31); `isAdmin()` delegates to it
   (line 36). Seeded `adminUser` has legacy `role:"admin"` and exercises every
   admin path (C8, C16, C29, C49, C63…) green. **Verified — legacy admin not
   locked out.**
5. **Owner cannot mutate role/status on update** — equality guard at
   firestore.rules:62-64 plus the `hasAll(["role","status"])` defense against
   the null-injection vector (B2). Covered by C6/C7/C25/C28 and the bare-doc
   case C24. **Verified.**

Result: the core security contract holds. No blockers. Findings below are one
correctness-robustness warning on index coverage and three info-level notes.

The two items flagged "do not flag" in the brief (ranking isolation deferred to
TASK-11; UI saying "grupo" while collection is `pools`) were observed and are
**not** reported.

## Warnings

### WR-01: Plan-mandated `pools(slug)` index not declared — slug lookup may fail at deploy/query time
**File:** `firestore.indexes.json:19-25`
**Issue:** The plan (TASK-03, line 62) and spec (§2, §12) list four indexes:
`pools(slug)`, `pools(status)`, `users(groupId,status)`, `users(role)`. The
file declares the mandatory composite `users(groupId,status)` and a
`pools(status,createdAt)` composite (which covers `pools(status)` queries that
also order by `createdAt`). However, **`pools(slug)` is not present in any
form**. TASK-04 performs slug uniqueness/detail lookup (`where slug == ...` or
doc-id=slug). If the eventual implementation issues an equality query on `slug`
**combined with another constraint or an `orderBy`**, the single-field
auto-index will not satisfy it and the query throws `FAILED_PRECONDITION` at
runtime. The spec itself (§7 note, §14) classifies the single-field declarations
as "redundante mas explícito" — but redundancy that was *promised* and then
*omitted* is a silent scope gap, not a harmless simplification.
**Fix:** Either (a) add the explicit single-field index for confidence/CI
parity, or (b) document in the SUMMARY that `pools(slug)` and `users(role)` are
intentionally left to Firestore auto-indexing and confirm TASK-04's slug query
is a pure single-field equality (no compound `orderBy`). Recommended (a):
```json
{
  "collectionGroup": "pools",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "slug", "order": "ASCENDING" }]
}
```
(Note: Firestore rejects explicit single-field indexes via `indexes[]` in some
CLI versions — if `firebase deploy` errors, use `fieldOverrides` instead. Verify
against the actual deploy, do not assume.)

## Info

### IN-01: `isGroupAdmin()` is declared but never referenced (dead helper this task)
**File:** `firestore.rules:33`
**Issue:** `isGroupAdmin()` is defined but used in zero match blocks. Per spec
§7 (line 56) and §18 it is an intentional forward-declaration for the
multi-tenant transition (group_admin gating lands in TASK-11). It is therefore
*expected* dead code, but an unused rules function still passes lint silently
and could mask a future wiring mistake (e.g., a match meant to use it never
does).
**Fix:** Acceptable as-is for the transition. Add a one-line trailing comment
`// usado a partir de TASK-11` so the next reviewer doesn't flag it as an
oversight, or defer the declaration to TASK-11 where it is first consumed.

### IN-02: No test asserts a legacy `user`/`participant` cannot be self-promoted via `update` to a privileged role
**File:** `test/rules/firestore.rules.test.ts` (coverage gap)
**Issue:** Escalation-on-**create** is well covered (C76/C77/C78/C10), and
escalation-on-**update** is covered for `role:"admin"` (C6/C28). But there is no
explicit case proving an *approved participant* (the new canonical role) cannot
`update` their own doc to `role:"group_admin"` or `"super_admin"`. The equality
guard at firestore.rules:63 makes this safe by construction (any role change is
rejected), so this is a coverage completeness note, not a live vulnerability.
**Fix:** Add a case mirroring C28 against the seeded `partUser` (C79's actor):
```ts
it("approved participant não escala para group_admin (update)", async () => {
  // partUser seed from C79: role participant / status approved
  await assertFails(partDb.doc("users/partUser").update({ role: "group_admin" }));
});
```

### IN-03: `pools` read tests seed docs lacking some `poolSchema` fields — passing today, brittle if a future rule reads them
**File:** `test/rules/firestore.rules.test.ts:815-839`
**Issue:** Seeded pool docs include `status`/`slug`/`adminId` but the rule only
reads `resource.data.status`, so tests are correct now. If TASK-11 later adds a
membership/`groupId` predicate to the `pools` read rule, these fixtures would
need expanding and the current green suite could give false confidence during
that change.
**Fix:** No action this task. Note for TASK-11: revisit `pools` fixtures when
the read rule grows beyond `status`.

---

## Gate

**PASS_WITH_NOTES.** No BLOCKER findings. The five critical security properties
(write-denied, active-only read, no signup escalation, dual-compat/no-lockout,
no owner role/status mutation) are all verified against deny-path tests, not
just happy paths. Ship is acceptable once WR-01 is resolved or explicitly
waived (confirm TASK-04's slug query shape, or add the `pools(slug)` index).
Info items are non-blocking.

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
