# Review Report — TASK-01: Alinhar schemas à API-Football (PRD-02)

> Reviewer: Staff Engineer (adversarial)
> Date: 2026-06-07
> Commits: e2111ff + e5bf184 + dc08d06 on `feat/prd-01-auth`
> Scope: `src/schemas/shared.ts`, `src/schemas/matches.ts`, `src/schemas/__tests__/{shared,matches,systemSettings}.test.ts`

---

## Verdict

**APPROVED**

No BLOCKERs found. No WARNINGs found. All acceptance criteria satisfied. Implementation is clean, idiomatic, and well-tested.

---

## Verification Results

### Tests (real output, not rtk-wrapped)

```
Test Files  11 passed (11)
     Tests  116 passed (116)
  Duration  2.70s
```

All 116 tests pass including the 30 tests in `matches.test.ts` (13 legacy + 12 new venue/round/terceiro cases + 5 pre-existing refinement tests).

### TypeScript

```
npx tsc --noEmit → (no output, exit 0)
```

Zero type errors. All `z.infer<>` derivations compile correctly.

### IDE Diagnostics

All five changed files report zero diagnostics from the language server.

---

## Spec Compliance Checklist

| Acceptance Criterion | Result |
|---|---|
| AC1: `stageSchema` contains exactly `["grupos","oitavas","quartas","semifinal","terceiro","final"]` | PASS |
| AC2: `rankingScopeSchema` unchanged (`["geral","grupos","oitavas","quartas","semifinal","final"]`) | PASS |
| AC3: `matchSchema` accepts `venue` present/null/absent; `round` int≥1/null/absent | PASS |
| AC4: `matchSchema` rejects `venue` with empty `name`; `venue` with extra field; `round: 0`; `round: 1.5` | PASS |
| AC4b: `matchSchema` rejects `venue` with empty `city` (implementation adds test beyond spec) | PASS (bonus) |
| AC5: `matchSchema` accepts `stage: "terceiro"` for a finished match | PASS |
| AC6: Refinement intact — all legacy `scheduled`/`finished`/`live`/`postponed`/`canceled` tests pass | PASS |
| AC7: `.strict()` on root `matchSchema` rejects extra field | PASS |
| AC8: `Stage` type includes `"terceiro"` via `z.infer` without manual file touch | PASS |
| AC9: `Match["round"]` inferred as `number \| null \| undefined`; `Match["venue"]` as `{ name: string; city: string } \| null \| undefined` | PASS |
| AC10: Full schema suite green | PASS (116/116) |
| AC11: No new tsc errors | PASS |

---

## Implementation Review by Category

### Correctness

**`stageSchema` (shared.ts:10-17):** `"terceiro"` placed between `"semifinal"` and `"final"` — chronologically correct per tournament structure. Comment is precise (`// disputa do 3º lugar (API: "3rd Place Final")`). No issues.

**`venueSchema` (matches.ts:13-18):** Declared as module-private `const` (not exported). Correct — consumers derive `venue` via `Match` type, not `venueSchema` directly. `.strict()` applied. `name` and `city` use `nonEmptyString` (min(1)) — correct, prevents empty strings from passing. No issues.

**`venue` field nullability (matches.ts:31):** Declared as `venueSchema.nullable().optional()` — covers all three API states: present-and-valued, `null` (TBD), and absent. Matches spec §2.1 exactly.

**`round` field (matches.ts:29):** `z.int().min(1).nullable().optional()` — uses `z.int()` (Zod v4 idiom, confirmed: project uses zod@4.4.3). Rejects 0, rejects 1.5, accepts null, accepts undefined. Matches spec §2.2 exactly.

**Field ordering (matches.ts:24-35):** `round` after `stage`, `venue` after `groupId` — logical grouping as specified. No functional impact on Zod, but improves readability.

**Refinement untouched (matches.ts:37-59):** The `.refine()` block is bit-for-bit identical to the pre-task implementation. The new fields (`venue`, `round`) are not referenced in the refinement — correct and intentional per spec §2.6.

**`rankingScopeSchema` (shared.ts:20-27):** Unchanged. Contains `["geral","grupos","oitavas","quartas","semifinal","final"]` — no `"terceiro"`. Comment added clarifying the exclusion (`exclui "terceiro", que não tem ranking próprio`). Correct per spec §2.4.

**`systemSettings.ts` cascade:** `currentStage: stageSchema.optional()` automatically includes `"terceiro"` as a valid value. The `systemSettings.test.ts` type assertion was updated to reflect this (`"terceiro" | ...`). Correct.

**`statistics.ts` cascade:** `correctByStage: z.partialRecord(stageSchema, z.int().min(0))` now accepts `"terceiro"` as a key. No file was modified — purely automatic. All 11 statistics tests pass including `rejeita chave inválida em correctByStage`. Correct.

### Zod Idioms (Zod v4.4.3)

- `z.int()` — correct Zod v4 idiom (replaces `z.number().int()` from v3). Confirmed by test: `round: 1.5` is rejected.
- `z.iso.datetime()` — v4 idiom for ISO 8601 validation. Already in use; not changed.
- `.nullable().optional()` — correct chaining for `T | null | undefined`. Order matters in Zod v4: `.nullable()` first, then `.optional()` — implementation matches this.
- `.strict()` — correct placement after `.object({...})` on both `venueSchema` and `matchSchema`.
- `z.partialRecord()` — Zod v4 idiom; used in `statistics.ts`, unmodified, correctly resolves with the expanded `stageSchema`.

### TypeScript Strict Mode

No `any` types introduced. All types are fully derived from `z.infer<>`. No manual type declarations for the new fields. Satisfies project rule #1.

### Test Coverage

**`shared.test.ts`:**
- Enum test updated to enumerate all 6 stages. Negative case `"terceiro_lugar"` retained (distinct invalid value). Correct.
- Type inference test updated: `Stage` asserted against `"grupos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"`. Correct.
- `rankingScopeSchema` test asserts `"repescagem"` is rejected — no `"terceiro"` in scope (implicitly confirmed by no assertion for it). Correct.

**`matches.test.ts`:**
- 12 new test cases added: 3 for `venue` (accept), 3 for `venue` (reject), 3 for `round` (accept), 2 for `round` (reject), 1 for `stage: "terceiro"`.
- Implementation went beyond spec: added `rejeita venue com city vazio` (not in spec §3.4 Ajuste 4 but defensively correct). This is a positive delta.
- `inferência de tipo` test now asserts `Match["round"]`, `Match["venue"]`, and updated `Match["stage"]`. Correct.
- All 13 legacy tests remain unchanged and pass. No regression.

**`systemSettings.test.ts`:**
- Type assertion for `SystemSettings["currentStage"]` updated to include `"terceiro"`. Correct cascade handling.

### Architecture and Responsibility

- `venueSchema` is correctly scoped as a module-private helper (unexported). Downstream consumers use `Match["venue"]` type — no coupling to schema internals.
- `matchSchema` remains the single exported entity from `matches.ts`. No architectural change.
- Types in `src/types/` remain purely derived (`z.infer<>`) — no manual duplication. Satisfies project convention.

### Out-of-Scope Changes

The commits include two unrelated file renames (route directories: `esqueci-senha → forgot-password`, `redefinir-senha → reset-password`, `cadastro → signup`). These are in `src/app/(auth)/` and are not part of TASK-01 schema scope. They do not affect the schema layer and cause no test failures. They are noise in the commit but not a defect in this task's deliverable.

---

## Findings

None classified as BLOCKER or WARNING.

### Observations (informational only, no action required)

1. **`venueSchema` not exported** — intentional and correct. If future tasks need to validate venue objects in isolation (e.g., a dedicated venue service), they will need to either export it or redeclare. Low probability given the data model; acceptable as-is for MVP.

2. **`round: 0` vs `round: null` semantics** — the spec correctly distinguishes `round: null` (single-matchday phase like Final) from `round: 0` (invalid). The test `rejeita round 0 (< 1)` confirms this boundary. No action needed.

3. **Bonus test `rejeita venue com city vazio`** — implementation adds one test beyond the spec's explicit list. This is strictly additive and correct behavior (both `name` and `city` use `nonEmptyString`). Reflects good adversarial instinct from the implementor.

4. **`statistics.correctByStage` now accepts `"terceiro"` as a key** — this is a spec-acknowledged side effect ("acceptable" per §2.5). The statistics schema and tests were not modified, and no existing test breaks. The `rejeita chave inválida em correctByStage` test uses a value outside the full enum to verify rejection — still valid after the addition.

---

## Summary

The implementation satisfies all 11 acceptance criteria. Schema changes are minimal, focused, and non-breaking. Zod idioms are correct for v4. Types derive automatically without manual file touches. Test coverage is thorough — 12 new cases plus retention of all 13 legacy cases. No regressions across the full 116-test schema suite. TypeScript strict mode is satisfied. The `.strict()` constraint is correctly maintained on both `venueSchema` and `matchSchema`. `rankingScopeSchema` is provably unchanged.

**Verdict: APPROVED — no changes required.**
