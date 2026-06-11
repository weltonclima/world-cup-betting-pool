---
task: PRD-09 / TASK-04
title: Service + Route Handlers de pool (create / search / detail)
reviewed: 2026-06-11
depth: standard
reviewer: gsd-code-reviewer (adversarial)
files_reviewed: 13
files_reviewed_list:
  - src/app/api/groups/route.ts
  - src/app/api/groups/search/route.ts
  - src/app/api/groups/[id]/route.ts
  - src/services/pools.ts
  - src/features/groups/hooks/groupsKeys.ts
  - src/features/groups/hooks/useSearchGroups.ts
  - src/features/groups/hooks/useGroupDetail.ts
  - src/features/groups/hooks/useCreateGroup.ts
  - src/features/groups/hooks/index.ts
  - src/app/api/groups/__tests__/route.test.ts
  - src/app/api/groups/search/__tests__/route.test.ts
  - src/app/api/groups/[id]/__tests__/route.test.ts
  - src/services/__tests__/pools.test.ts
findings:
  blocker: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
gate: PASS_WITH_WARNINGS
---

# PRD-09 / TASK-04 — Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard (per-file + cross-file trace against `predictions.ts` / `_apiClient.ts` reference patterns)
**Files Reviewed:** 13
**Status:** issues_found (no blockers)

## Summary

The implementation is solid on the high-risk axes. The R7 slug race is killed correctly via doc-id=slug + atomic `.create()` (not check-then-write TOCTOU) — verified at `route.ts:80` with `isAlreadyExists` mapping gRPC code `6`/`ALREADY_EXISTS` → 409. Pools are born `status: "pending"` (never active). All writes go through the Admin SDK; the client service never touches the Firebase Client SDK (correct deviation from `predictions.ts`, justified by the owner needing to read its own `pending` pool which Rules block). `adminId` is forced from the session and the body's `adminId` is overwritten before parse. Search returns active-only; detail hides `pending`/`blocked` from non-owners with a 404 (no existence leak). Zero `any` across production code; client-side Zod revalidation is present on all three reads. Test coverage hits every contract case in the spec §9, including the 409 race case.

No blockers. Findings below are correctness-adjacent robustness gaps and consistency issues — none block ship, but WR-01 and WR-02 should be fixed.

## Warnings

### WR-01: `createPool` does not revalidate input client-side before POST (spec asks for "Zod revalidation client-side")

**File:** `src/services/pools.ts:58-69`
**Issue:** The review focus calls for client-side Zod revalidation. `createPool` revalidates the *response* (`poolSchema.parse(body.pool)`, good) but sends `input` to the wire without validating it against `poolInputSchema` first. A malformed `slug` (uppercase/`_`) or oversized `photoBase64` is only caught server-side (422), forcing a round-trip and surfacing as a generic typed error rather than a precise field-level message. The server is the security boundary and is correctly defended, so this is not a security gap — but it diverges from the stated client-side revalidation intent and degrades UX/feedback fidelity.
**Fix:** Validate before fetch and surface a field-aware error:
```ts
import { poolInputSchema } from "@/schemas";
// inside createPool, before fetch():
const check = poolInputSchema.safeParse({ ...input, adminId: "client-placeholder" });
if (!check.success) {
  throw new PoolServiceError(422, HTTP_ERROR_MESSAGES[422]);
}
```
(Server still owns `adminId`; the placeholder only satisfies the schema's `adminId` requirement for the local shape check.) Alternatively, derive a `poolInputSchema.omit({ adminId: true })` for client use.

### WR-02: Error-body detail is discarded — `422` issues and server messages never reach the caller

**File:** `src/services/pools.ts:38-43, 66, 84, 103`
**Issue:** `toServiceError(status)` maps on HTTP status alone and ignores the response body. The POST route returns `{ error, issues }` on 422 (`route.ts:51-54, 72-75`), but the service throws a generic "Os dados do grupo são inválidos." with no field-level `issues`. The project already extracted `extractErrorDetail`/`buildHttpError` into `_apiClient.ts` specifically to stop this duplication (see its WR-02 note), and the spec §5 lists `_apiClient` reuse as expected. This is an inconsistency with the established house pattern and loses actionable validation detail.
**Fix:** Reuse the shared helper to enrich the typed error, e.g. read `extractErrorDetail(response)` and attach it (or the `issues`) to `PoolServiceError`, falling back to the pt-BR map when absent. At minimum, plumb `issues` through so the create form (TASK-08) can highlight the offending field.

### WR-03: Service maps `400` (invalid JSON) but the 3 read paths can also produce non-mapped statuses with no fallback test

**File:** `src/services/pools.ts:26-34` and `route.ts:40-45`
**Issue:** The POST route can return `400` ("Corpo da requisição inválido (JSON esperado)."), and the service does map `400` → message. Good. However, the spec §7 contract for POST lists only `401|403|409|422|500` — the `400` path is undocumented in the contract, and there is **no test** asserting a `400` is produced or mapped. More broadly, `FALLBACK_HTTP_MESSAGE` is never exercised by any test, so a regression that drops a status from `HTTP_ERROR_MESSAGES` would pass silently. This is a coverage gap on the error-mapping surface that the spec §9 explicitly scopes ("mapeiam status de erro → PoolServiceError com mensagem pt-BR correta").
**Fix:** Either align the §7 contract to include `400`, or have the route fold the JSON-parse failure into `422`. Add a service test asserting an unmapped status (e.g. `502`) yields `FALLBACK_HTTP_MESSAGE`, and one asserting the `400`/JSON path.

### WR-04: Search reads the entire active collection on every call — `MAX_RESULTS` caps the response, not the Firestore read

**File:** `src/app/api/groups/search/route.ts:28, 41-43`
**Issue:** `where("status","==","active").get()` has no `.limit()`. `MAX_RESULTS = 50` is applied in-memory *after* fetching every active pool, so the cap bounds the JSON payload but not the read fan-out. Filtering-before-cap is correct for result accuracy (the comment is right), but the unbounded read means the "defensive cap" provides no protection against an unbounded active set. v1 review excludes pure performance, but this is flagged because the cap's stated *intent* ("teto defensivo") is not actually achieved — a correctness-of-design gap, not just speed. With `q` present, an exact-slug lookup could also be a direct `doc(q).get()` short-circuit.
**Fix:** For the no-`q` / `name`-contains path, the in-memory filter is unavoidable in MVP (A6), but bound the query read: `.limit(MAX_RESULTS)` when no `q`, and for the exact-slug case attempt `collection("pools").doc(q).get()` and confirm `status === "active"` before falling back to the scan. Document the unbounded-name-search limitation in §6/§14 if deferring.

## Info

### IN-01: Detail route re-reads `users/{uid}` that the auth guard already fetched

**File:** `src/app/api/groups/[id]/route.ts:47` vs `requireApprovedUser.ts:57`
**Issue:** `requireApprovedUser()` already loads `users/{uid}` to check `status === "approved"` but returns only `{ uid, email, nickname }` — not `role`. The detail route then issues a second `users/{uid}.get()` solely to read `role` for the super_admin check. Two reads of the same doc per non-active detail request. Harmless and correct, but avoidable.
**Fix:** Extend `ApprovedUser` to surface `role` from the guard's existing snapshot, then drop the second read. Cross-cutting (touches a shared helper) — acceptable to defer to avoid scope creep, but note it.

### IN-02: `?? 0` on `countSnap.data().count` is dead defense

**File:** `src/app/api/groups/[id]/route.ts:62`
**Issue:** Firestore aggregation `count()` always returns a numeric `count`; the `?? 0` branch is unreachable. Not a bug, just dead defensive code that implies a nullable contract that doesn't exist.
**Fix:** Drop `?? 0`, or keep with a comment that it's purely belt-and-suspenders. Low priority.

### IN-03: `useCreateGroup` doc comment slightly overstates invalidation breadth

**File:** `src/features/groups/hooks/useCreateGroup.ts:25-26`
**Issue:** `invalidateQueries({ queryKey: groupsKeys.all })` invalidates both `search` and `detail` subtrees (all keys prefixed `["groups"]`). The comment frames it only in terms of search consistency. Behaviorally fine (broad invalidation is safe), but the comment under-describes that detail queries are also invalidated. The spec §7 / §2 mentioned invalidating `groupsKeys.search`; invalidating `all` is a superset and acceptable.
**Fix:** None required; optionally tighten the comment or narrow to `groupsKeys.search`-prefixed invalidation if detail refetch churn matters later.

## Verified (no defect found on the high-risk axes)

- **R7 slug race:** atomic `doc(slug).create()` — no check-then-write; `isAlreadyExists` covers code `6`, `"already-exists"`, `"ALREADY_EXISTS"`; test `route.test.ts:114` exercises it. **PASS.**
- **Born pending:** `status: "pending" as const` hardcoded; `poolSchema.safeParse` of the final object guards the contract; 201 test asserts `status === "pending"`. **PASS.**
- **adminId from session:** body `adminId` overwritten via `{ ...base, adminId: uid }` before parse, and the final write uses `uid` again; test `route.test.ts:106` asserts `uid-evil` is ignored. **PASS.**
- **Admin SDK only for writes; no Client SDK in service:** `pools.ts` uses `fetch` exclusively for both read and write. **PASS.**
- **Search active-only:** `where("status","==","active")`; corrupted docs dropped with `console.error`, not thrown; tests cover active-only, q-filter case-insensitive, and corrupted-doc resilience. **PASS.**
- **Detail visibility / no existence leak:** non-active → owner or `isSuperAdminRole` else 404; legacy `admin` accepted; tests cover stranger-404, owner-200, super_admin-200. **PASS.**
- **Typed pt-BR errors:** `PoolServiceError` mirrors `PredictionServiceError`; full 400/401/403/404/409/422/500 map + fallback. **PASS** (see WR-02/WR-03 for the lost-detail gap).
- **Zero `any`:** none in production files; tests use scoped `as unknown as` casts only. **PASS.**
- **Path safety:** `id`/`slug` constrained by `poolSlugSchema` regex; no `..` traversal; `encodeURIComponent` on the detail/search URL params. **PASS.**

## Final Gate

**PASS_WITH_WARNINGS** — No blockers. R7 race-safety, pending-on-birth, Admin-SDK-only writes, session-bound `adminId`, active-only search, and non-owner detail hiding are all correctly implemented and tested. Recommend addressing WR-01 (client-side input revalidation per spec) and WR-02 (reuse `_apiClient` error-detail helper so 422 `issues` survive) before the TASK-08 UI consumes this service, as both directly affect form error UX. WR-03/WR-04 and the Info items can follow.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
