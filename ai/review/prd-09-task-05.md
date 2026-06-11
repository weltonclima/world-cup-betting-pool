# Code Review — PRD-09 TASK-05 (admin endpoints: status transition + admin swap + seed)

**Reviewed:** 2026-06-11
**Depth:** standard (cross-file for auth/contract)
**Stance:** adversarial / FORCE
**Files reviewed:**
- `src/app/api/admin/groups/[id]/status/route.ts` (+ `__tests__`)
- `src/app/api/admin/groups/[id]/admin/route.ts` (+ `__tests__`)
- `src/app/api/admin/groups/_authorize.ts`
- `src/schemas/poolStatusTransition.ts` (+ `__tests__`)
- `scripts/seed-pools.ts`
- supporting: `src/schemas/pools.ts`, `src/schemas/shared.ts`, `src/app/api/_lib/secret.ts`, `src/server/auth/requireApprovedUser.ts`, `package.json`, `tsconfig.json`

**Status:** issues_found — 1 BLOCKER, 4 WARNING, 3 INFO

---

## Summary

Authorization is solid: both routes call `authorizeGroupAdmin` first thing, the helper enforces the secret-OR-super_admin contract using `isSuperAdminRole` (dual-compat `admin`||`super_admin`), and non-super_admin approved users correctly get 403. Status-transition validity is enforced atomically inside a Firestore transaction (good TOCTOU defense), invalid transitions return 409 with no write, and the transition matrix matches the spec exactly. Error messages are typed pt-BR and there is no `any`. Test coverage for the two routes and the transition schema is thorough.

The blocking problem is in the seed deliverable: `seed:pools` invokes `tsx`, which is not a project dependency, and the script imports via the `@/schemas` path alias that `tsx` does not resolve — so `npm run seed:pools` cannot run as shipped. Several correctness gaps in the admin-swap route (privilege demotion of a super_admin, and rejection of `admin`/`super_admin` legacy `status` shapes) are classified as warnings.

---

## BLOCKER

### CR-01: `seed:pools` script cannot run — `tsx` not installed and `@/` alias unresolved

**File:** `package.json:18`, `scripts/seed-pools.ts:24`
**Issue:** Two independent failures make the primary R5-unblocking deliverable non-functional:

1. `package.json:18` defines `"seed:pools": "tsx scripts/seed-pools.ts"`, but `tsx` appears in **neither** `dependencies` nor `devDependencies` (verified full list). `npm run seed:pools` fails immediately with `tsx: command not found` (unless a maintainer happens to have it globally — non-reproducible).
2. Even with `tsx` present, `scripts/seed-pools.ts:24` does `import { poolSchema } from "@/schemas"`. `tsx` (esbuild-based) does **not** resolve TypeScript `compilerOptions.paths` aliases by default. The import throws `Cannot find module '@/schemas'` at runtime.

The acceptance criterion "Seed idempotente deixa 'Bolão dos Parças' active; re-run não duplica" (spec §10) is unverifiable because the script never reaches Firestore.

**Fix:**
```jsonc
// package.json devDependencies — pin tsx and a path resolver
"tsx": "^4.19.0"
```
Then either run with the resolver enabled, or drop the alias in the script:
```ts
// scripts/seed-pools.ts — use a relative import so tsx resolves it
import { poolSchema } from "../src/schemas";
```
(Alternatively run `tsx --tsconfig tsconfig.json` AND add `tsconfig-paths`/`tsx`'s `--resolve` setup; the relative import is the lower-risk fix.) Add a smoke check to CI or document a manual emulator run so this regression is caught.

---

## WARNING

### WR-01: Admin swap silently demotes a super_admin to group_admin

**File:** `src/app/api/admin/groups/[id]/admin/route.ts:98-100`
**Issue:** The new admin is promoted whenever `newUser.data.role !== "group_admin"`. If the target user is a `super_admin` (or legacy `admin`), the swap **overwrites their role with `group_admin`**, a privilege *downgrade* of a global admin. Spec §6 only contemplates promoting a participant; it never authorizes stripping super_admin. There is no guard against selecting a super_admin as a pool admin. This silently removes global privileges and (once TASK-06 syncs claims) can lock a super_admin out of admin surfaces.
**Fix:** Skip promotion (and treat as 409 or no-op) when the target already holds an equal-or-higher role:
```ts
const targetRole = roleSchema.safeParse(newUser.data.role);
const alreadyPrivileged =
  targetRole.success &&
  (isSuperAdminRole(targetRole.data) || isGroupAdminRole(targetRole.data));
if (!alreadyPrivileged) {
  tx.update(newRef, { role: "group_admin", updatedAt });
}
```
At minimum, reject promoting a `super_admin`/`admin` with a typed 409.

### WR-02: `status` equality check rejects legacy/non-canonical approved users incorrectly

**File:** `src/app/api/admin/groups/[id]/admin/route.ts:79`
**Issue:** Approval is gated by raw `newUser.data.status !== "approved"`. `newUserSchema` types `status` as a free `z.string().optional()`, so any user whose status is stored in a non-canonical shape (or absent during migration) is rejected with 409 "Usuário inválido". This mirrors the project's own anti-pattern call-out: status should go through `userStatusSchema` (the canonical enum), not a raw string compare — consistent with how role uses `isSuperAdminRole` instead of `role === "admin"`. Low blast radius today, but it's the same class of bug the spec explicitly warns against for role.
**Fix:** Parse with the canonical schema and compare against the enum value:
```ts
import { userStatusSchema } from "@/schemas";
const status = userStatusSchema.safeParse(newUser.data.status);
if (!status.success || status.data !== "approved") {
  throw new SwapError(409, "Usuário inválido para admin do grupo.");
}
```

### WR-03: Old-admin demotion reads `role` as a raw string, bypassing dual-compat

**File:** `src/app/api/admin/groups/[id]/admin/route.ts:93`
**Issue:** `demoteOld = oldSnap.exists && oldSnap.data()?.["role"] === "group_admin"`. This is a raw string compare on an `any`-typed `data()` (the doc data is untyped, so `?.["role"]` is effectively `any` flowing into a `===`). The spec §11 mandates using the role helpers, not raw comparisons. Functionally OK for `group_admin` (no legacy alias), but it's inconsistent with `_authorize.ts` (which correctly uses `roleSchema.safeParse` + `isSuperAdminRole`) and re-introduces the untyped-read pattern the rest of the task carefully avoids.
**Fix:** Parse the old-admin role through `roleSchema`/`isGroupAdminRole`:
```ts
const oldRole = roleSchema.safeParse(oldSnap.data()?.role);
demoteOld = oldSnap.exists && oldRole.success && isGroupAdminRole(oldRole.data);
```

### WR-04: `authorizeGroupAdmin` does a second `users/{uid}` read already loaded by `requireApprovedUser`

**File:** `src/app/api/admin/groups/_authorize.ts:30-35`
**Issue:** `requireApprovedUser()` already fetches `users/{uid}` to check `status === "approved"`, then `authorizeGroupAdmin` fetches the **same doc again** to read `role`. Two round-trips for one document on every session-authorized admin request. Not a correctness bug, but `requireApprovedUser`'s `ApprovedUser` shape could expose `role` (or the doc) so the role check reuses the first read. Worth folding in since both routes pay this cost on every call. (Performance is out of v1 scope, but this is also a maintainability/consistency smell — the role-source-of-truth read is split across two helpers.)
**Fix:** Extend `ApprovedUser` with `role` (parsed once in `requireApprovedUser`) and have `authorizeGroupAdmin` consume it, or have `requireApprovedUser` return the raw snapshot for callers that need more fields.

---

## INFO

### IN-01: Seed is not idempotent on managed fields, only on existence

**File:** `scripts/seed-pools.ts:51-54`
**Issue:** Spec §6 says "Se já existe, não sobrescreve (log 'já existe')." The script honors this, but a partially-seeded/corrupt doc (e.g., created with `status: "pending"` by an earlier run, or a hand-edited doc) is left untouched and the seed reports success while the pool is **not** `active` — silently defeating R5. Consider validating the existing doc with `poolSchema` and warning (not overwriting) when `status !== "active"`, so the operator knows the seed's goal wasn't met.

### IN-02: `runtime`/`dynamic` exports present but `import "server-only"` ordering relies on bundler

**File:** `src/app/api/admin/groups/[id]/status/route.ts:1-11`, `.../admin/route.ts:1-11`
**Issue:** Both handlers correctly declare `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, and `import "server-only"` per spec §7. No defect — noted as positive confirmation. (Listed as INFO so the verification trail is explicit.)

### IN-03: Self-swap (`novo == antigo`) still rewrites `pools.adminId` and `updatedAt`

**File:** `src/app/api/admin/groups/[id]/admin/route.ts:96`
**Issue:** Spec §6 calls the same-uid swap a "no-op idempotente". The implementation still issues `tx.update(poolRef, { adminId, updatedAt })` and (if role differs) the role update, bumping `updatedAt` on a true no-op. Behaviorally harmless and the test only asserts no demotion, but a strict reading of "no-op" would skip the write when `adminId` is unchanged and the role is already `group_admin`. Low priority.

---

## Verification checklist (against spec §10 / §11)

| Acceptance criterion | Status |
|---|---|
| Both routes exist, protected by secret OR super_admin via `isSuperAdminRole` | PASS |
| Status transitions follow `ALLOWED_POOL_STATUS_TRANSITIONS`; invalid → 409 no-write | PASS (atomic in tx) |
| Non-super_admin / unauth → 403 / 401 | PASS (tested) |
| Admin swap atomic, re-promotes new admin to `group_admin` | PASS — but see WR-01 (over-promotion/demotion edge) |
| No partial state on failure | PASS (single `runTransaction`) |
| Typed pt-BR errors, no `any` | PASS for routes; WR-03 reintroduces an untyped read |
| Seed idempotent, leaves pool `active`; re-run no dup | **FAIL — CR-01 (script cannot execute)** |
| `tsc --noEmit` clean / new vitest green | Routes/schema: plausibly green (tests well-formed). Seed not covered by tests, so the runtime break is invisible to CI. |

---

## Final gate: **CHANGES REQUESTED**

Ship-blocking: **CR-01** (seed script is dead on arrival — missing `tsx` dependency + unresolved `@/` alias). The two route handlers and the transition schema are production-quality and could merge independently, but the seed is an explicit TASK-05 deliverable and a stated R5 unblocker, so the task is not complete. Strongly recommend also addressing **WR-01** (super_admin privilege demotion) before merge — it is a latent authorization defect, not just a quality nit.

_Reviewed by: Claude (gsd-code-reviewer), adversarial pass_
