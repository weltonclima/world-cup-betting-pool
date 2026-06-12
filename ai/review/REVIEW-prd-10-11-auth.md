---
phase: prd-10-11-auth
reviewed: 2026-06-11T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/schemas/shared.ts
  - src/server/auth/verifySession.ts
  - src/server/auth/requireApprovedUser.ts
  - src/components/layout/AdminGuard.tsx
  - src/components/layout/GroupAdminGuard.tsx
  - middleware.ts
  - src/app/api/group/_authorize.ts
  - src/app/api/group/dashboard/route.ts
  - src/app/api/group/settings/route.ts
  - src/app/api/group/invites/route.ts
  - src/app/api/group/invites/[id]/route.ts
  - src/app/api/group/users/_moderation.ts
  - src/app/api/group/users/_list.ts
  - src/app/api/group/users/promote/route.ts
  - src/app/api/group/users/approve/route.ts
  - src/app/api/admin/groups/_authorize.ts
  - src/app/api/admin/groups/route.ts
  - src/app/api/admin/groups/[id]/route.ts
  - src/app/api/admin/groups/[id]/status/route.ts
  - src/app/api/admin/groups/[id]/admin/route.ts
  - src/app/api/admin/groups/[id]/members/route.ts
  - src/app/api/admin/matches/route.ts
  - src/app/api/admin/admins/route.ts
  - src/app/api/admin/dashboard/route.ts
  - src/services/group.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# PRD-10 / PRD-11 Auth & Authorization Review

**Reviewed:** 2026-06-11
**Depth:** deep (cross-file: edge gate -> route auth -> Firestore writes)
**Status:** issues_found (no Critical / no exploitable escalation or IDOR found)

## Summary

The auth surface is well-built and fail-closed. Both PRD-11 regression risks are clear:

- **No lockout regression.** `normalizeRole` (verifySession.ts:56) maps `admin` AND `super_admin` -> `"admin"` bucket, and the edge gate (middleware.ts:47) allows `role === "admin"`. `AdminGuard` (AdminGuard.tsx:33) uses `isSuperAdminRole`, which returns true for legacy `admin`. Legacy `admin` users keep access to every `/admin/*` route. Verified.
- **No privilege escalation.** `participant`/`group_admin` normalize to `"user"`/`null` (verifySession.ts:57-59) -> edge redirects to `/home`; `AdminGuard` and `authorizeGroupAdmin` (admin `_authorize.ts:37`) both require `isSuperAdminRole`, which is false for `group_admin`/`participant`. group_admin cannot reach super-admin routes.

**Tenant isolation is sound.** Every `/api/group/*` route derives `groupId` exclusively from the session doc via `authorizeGroupAdminOfPool` (group `_authorize.ts:70`); none trust client-supplied groupId. Ownership is re-checked on every mutation: moderation (`_moderation.ts:81`), promote (`promote/route.ts:92`), invite revoke (`invites/[id]/route.ts:30`), settings/dashboard/list all scope by session groupId. super_admin is protected from group_admin moderation/promotion (`_moderation.ts:124`, `promote/route.ts:98`).

**Super-admin routes** under `admin/groups/[id]/**`, `admin/matches`, `admin/dashboard`, `admin/admins` all gate via `authorizeGroupAdmin` (super_admin OR constant-time secret). No group_admin/participant path.

Findings below are robustness/quality, not exploitable holes.

## Warnings

### WR-01: Soft-removed user (`groupId: ""`) collides with empty-string isolation key

**File:** `src/app/api/group/users/_moderation.ts:78-83`, cross-ref `_authorize.ts:70-73`
**Issue:** `handleRemove` soft-deletes by setting `groupId: ""` (line 204). `loadTarget` compares `targetGroupId !== groupId` where `targetGroupId` is `""` for removed users. This is safe today only because `authorizeGroupAdminOfPool` rejects a session whose own `groupId` is `""` (line 71). The isolation guarantee therefore depends on an invariant enforced in a different file. If a future pool/admin ever legitimately carried `groupId === ""`, every soft-removed user globally would match it and become moderable cross-tenant. The empty-string sentinel and the empty-string "no pool" rejection are the same value doing two opposite jobs.
**Fix:** Use a non-comparable sentinel for removal (e.g. `groupId: FieldValue.delete()` so the field is absent, mirroring settings.ts:101), and in `loadTarget` reject when `targetGroupId` is falsy before the equality check:
```ts
if (!targetGroupId || targetGroupId !== groupId) {
  throw new ModerationError(403, "Usuário não pertence ao seu grupo.");
}
```

### WR-02: `admin/groups/[id]/admin` swap accepts target with no `groupId` (cross-pool admin assignment)

**File:** `src/app/api/admin/groups/[id]/admin/route.ts:91-95`
**Issue:** The super-admin swap promotes a user to `group_admin` of pool `id`, but only rejects when `newUser.data.groupId !== undefined && !== id`. A user whose `groupId` is **absent** is accepted and promoted — they become admin of a pool they are not a member of, and their `groupId` is never set to `id` (only `role` is written, line 118). Result: a `group_admin` with `groupId === undefined`. That user's subsequent `/api/group/*` calls then hit `authorizeGroupAdminOfPool`, which 403s on missing `groupId` (`_authorize.ts:71`) — so they hold the role but cannot act, an inconsistent/half-provisioned admin state. This is a super-admin-only operation (not attacker-reachable), hence Warning not Critical, but it produces a broken tenant binding. Note `promote/route.ts:92` does NOT have this gap (it requires `groupId === groupId` strictly).
**Fix:** When promoting, also bind the user to the pool in the same transaction, and tighten the membership check:
```ts
if (newUser.data.groupId !== id) {
  throw new SwapError(409, "Usuário pertence a outro grupo.");
}
// ...
tx.update(newRef, { role: "group_admin", groupId: id, updatedAt });
```

## Info

### IN-01: Modulo bias in invite code generation

**File:** `src/app/api/group/invites/route.ts:31-38`
**Issue:** `bytes[i]! % CODE_ALPHABET.length` (alphabet length 31) over a 256-value byte introduces slight non-uniformity (values 0-9 are marginally more likely). Not security-relevant here — codes come from `crypto.randomBytes`, are 6 chars (~30 bits), single-active-per-pool, and uniqueness is enforced atomically by doc-id `.create()`. Cosmetic.
**Fix:** Rejection-sample bytes >= `256 - (256 % 31)` if perfect uniformity is desired; otherwise leave as-is.

### IN-02: `maxParticipants` setting is stored but never enforced

**File:** `src/app/api/group/settings/route.ts:84-86`
**Issue:** `maxParticipants` is persisted but no reviewed route (approve/promote/invite) checks it against current approved count. Approvals can exceed the configured cap. Likely deferred with invite redemption; flagging so it isn't assumed enforced.
**Fix:** Enforce the cap at approval/redemption time when that flow lands (out of current scope).

### IN-03: Group-admin pages not covered by edge middleware (defense-in-depth note)

**File:** `middleware.ts:57`
**Issue:** `matcher: ["/admin/:path*"]` gates super-admin pages (incl. new `/admin/dashboard-global`, `/admin/administradores`, etc.) but NOT the `/grupo/*` group-admin UI pages. Those rely on `GroupAdminGuard` (client) + server-side `/api/group/*` enforcement. This matches the documented model and is NOT a hole — the authoritative checks are server-side. Noted only so the asymmetry is intentional and recorded.
**Fix:** None required. Optionally extend the matcher to `/grupo/:path*` for a faster client-side redirect, but the security boundary is already the Route Handlers.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
