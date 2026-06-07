# Review Report — TASK-09: Card Avisos (NoticesCard)

**Task:** Home Dashboard TASK-09 — Card Avisos  
**Commit reviewed:** `407b751` (current HEAD state — W-05 fix already applied)  
**Reviewed:** 2026-06-07  
**Depth:** deep (cross-file: spec §3.8, screen contract §3.8, helper types, barrel)  
**Reviewer:** Staff Engineer (adversarial stance)

**Files reviewed:**
- `src/features/home/components/NoticesCard.tsx`
- `src/features/home/components/__tests__/NoticesCard.test.tsx`
- `src/features/home/components/index.ts` (barrel)
- `src/features/home/lib/homeDashboardHelpers.ts` (SystemNotice contract)
- `ai/screen/home-dashboard-task-06.md` §3.8 (visual contract)
- `ai/prd/home-dashboard.md` R6 (data contract)

---

## CI Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx vitest run src/features/home/components` | PASS — 147 tests, 0 failures |
| `mcp__ide__getDiagnostics` (NoticesCard.tsx) | 0 diagnostics |
| `mcp__ide__getDiagnostics` (NoticesCard.test.tsx) | 0 diagnostics |

---

## Summary

NoticesCard is a small, focused presentational component. Props-only contract is correct (`notices: SystemNotice[]`), no Firestore access, no derivation logic inside the card. Accessibility contract (W-05: `<section aria-label="Avisos do sistema">`) is applied correctly. Skeleton ships with proper `role="status" aria-busy="true"`. TypeScript is clean and no `any` or inline styles are present.

The review identified **one WARNING** (icon mapping diverges from the screen contract for the `warning` severity) and **one WARNING** (icon-class concatenation style). No BLOCKERs.

---

## Findings

### WR-01: Icon mapping for `warning` severity uses `AlertTriangle` instead of spec-mandated `Lock`

**Classification:** WARNING

**File:** `src/features/home/components/NoticesCard.tsx:21-29`

**Issue:**  
The screen contract (§3.8, "Mapeamento de flags → avisos") specifies two distinct icons:

| Flag | Condition | Icon |
|---|---|---|
| `predictionsLocked: true` | always | `Lock` `text-destructive` |
| `registrationOpen: false` | admin only | `UserX` `text-muted-foreground` |

The implementation instead maps by `severity` level — not by `id`/semantic intent:

```ts
const SEVERITY_MAP = {
  warning: { Icon: AlertTriangle, className: "text-destructive" },
  info:    { Icon: Info,          className: "text-muted-foreground" },
} as const;
```

This means both `predictions-locked` and `kickoff-soon` (both `severity: "warning"`) render `AlertTriangle`, and `registration-closed` (`severity: "info"`) renders `Info`. The spec intended `Lock` for locked predictions and `UserX` for registration closed — semantically richer icons that convey the source of the notice.

**Justification for WARNING (not BLOCKER):** The spec contract is the screen design document (§3.8 mapeamento table) but the `SystemNotice` type in `homeDashboardHelpers.ts` does not carry per-notice icon metadata — only `severity`. Implementing per-icon mapping by `id` would require either (a) extending `SystemNotice` to carry an icon key, or (b) a lookup table keyed on `notice.id`. The current generalized-by-severity approach is a **deliberate simplification** that trades icon fidelity for implementation simplicity and forward-compat (new severity types auto-get an icon). However, the deviation from the explicit screen contract must be acknowledged and the product owner must sign off.

Additionally, `deriveNotices` adds a third notice type (`kickoff-soon`) that did not appear in the §3.8 table at all — this notice also gets `AlertTriangle`, which is arguably correct (`warning` semantics), but it introduces an icon never specified by the screen contract. If the screen contract is treated as a hard contract, this is a gap.

**Fix options (choose one):**
- **Option A (minimal):** Accept generalization — document the deviation in code with a comment referencing §3.8. No code change needed. Requires explicit product sign-off.
- **Option B (faithful to spec):** Extend `SystemNotice` to carry an `icon` discriminator or switch the `SEVERITY_MAP` lookup to use `notice.id`:
  ```ts
  const ID_ICON_MAP: Record<string, { Icon: LucideIcon; className: string }> = {
    "predictions-locked": { Icon: Lock,          className: "text-destructive" },
    "kickoff-soon":       { Icon: AlertTriangle, className: "text-destructive" },
    "registration-closed":{ Icon: UserX,         className: "text-muted-foreground" },
  } as const;
  // fallback to SEVERITY_MAP[notice.severity] for unknown ids
  ```

---

### WR-02: Icon className concatenation uses template literal instead of `cn()`

**Classification:** WARNING

**File:** `src/features/home/components/NoticesCard.tsx:42`

**Issue:**  
```tsx
className={`${className} shrink-0 mt-0.5`}
```

The project uses Tailwind + Shadcn. The idiomatic pattern in this codebase (and in all other card components in the feature) is to use `cn()` from `@/lib/utils` for class merging, not template-literal concatenation. Template literals are fragile when `className` from the map could overlap with static classes, and they prevent Tailwind Merge from deduplicating conflicting utilities.

In this case the dynamic `className` values (`text-destructive` / `text-muted-foreground`) do not overlap with `shrink-0 mt-0.5`, so there is no functional bug — hence WARNING not BLOCKER. But this is an inconsistent pattern relative to the rest of the codebase.

**Fix:**
```tsx
import { cn } from "@/lib/utils";
// …
className={cn(className, "shrink-0 mt-0.5")}
```

---

## Test Coverage Assessment

| Test | Scenario covered | Quality |
|---|---|---|
| T1 | Multi-notice render | Adequate |
| T2 | Empty state | Adequate |
| T3 | `section` region with `aria-label` | Good — verifies ARIA contract directly |
| T4 | `h2` heading text | Adequate |
| T5 | All 3 notices rendered | Adequate |
| T6 | Empty state excludes notice text | Adequate |
| T7 | Single notice isolation | Adequate |
| T8 | Skeleton `role="status"` + `aria-label` | Good |

**Gap — icon rendering not tested:** No test verifies that `warning` severity renders `AlertTriangle` and `info` severity renders `Info`. This means WR-01 (icon mapping deviation from spec) would not be caught by the test suite if the icon map is changed. Consider adding:
```ts
it("T9: aviso de warning exibe ícone AlertTriangle", () => {
  const { container } = render(<NoticesCard notices={[WARNING_NOTICE]} />);
  // Check for SVG with the AlertTriangle path or data-testid if icons support it
});
```
This gap is noted as a **WARNING** because the tests cover behavioral correctness (text/ARIA) but not visual contract (icon selection).

---

## Contract Audit: Presentational Purity

| Constraint | Status |
|---|---|
| No Firestore access in component | PASS |
| No derivation logic (all from props) | PASS |
| No `any` | PASS |
| No inline styles (`style={{}}`) | PASS |
| No hardcoded data (uses `SystemNotice[]` from helper) | PASS |
| `section aria-label="Avisos do sistema"` (W-05 fix) | PASS |
| Skeleton `role="status" aria-busy="true"` | PASS |
| All animations with `motion-reduce:animate-none` | PASS |
| All icons with `aria-hidden="true"` | PASS |
| Empty state: `"Nenhum aviso no momento"` | PASS |
| Barrel re-exports `NoticesCard` + `NoticesCardSkeleton` | PASS |

---

## UI/UX Review

### Priority 1 — Accessibility
- `<section aria-label="Avisos do sistema">` maps to ARIA `region` — correct landmark. PASS.
- `<h2>` heading inside section — correct heading hierarchy (within card context). PASS.
- All decorative icons carry `aria-hidden="true"`. PASS.
- Skeleton carries `role="status" aria-busy="true" aria-label="Carregando Avisos"`. PASS.
- **Contrast:** `text-destructive` (AlertTriangle) over `bg-card` = ~4.6:1 (AA). `text-muted-foreground` (Info) over `bg-card` = ~5.7:1 (AA). PASS.

### Priority 4 — Style Consistency
- Uses semantic color tokens (`text-destructive`, `text-muted-foreground`, `text-foreground`, `text-primary`, `bg-card`, `border-border`) exclusively. No raw hex or literal color classes. PASS.
- Single icon family (Lucide). PASS.
- Card shell: `rounded-lg border border-border bg-card p-4 shadow-sm` — consistent with card shell spec §3 "Card Shell". PASS.

### Priority 7 — Animation
- Skeleton: `animate-pulse motion-reduce:animate-none`. PASS.

**No UI BLOCKER findings.**

---

## Verdict

**approved with adjustments**

Two WARNINGs must be addressed before or alongside the next task:

1. **WR-01** — Icon mapping by severity vs. per-id (spec §3.8 lists `Lock`/`UserX`). Either document the deviation with explicit sign-off (Option A) or implement per-id map (Option B). This does not block TASK-10 but must be resolved before final UAT.
2. **WR-02** — Replace template-literal class concatenation with `cn()` for consistency with codebase patterns.

No BLOCKERs. TypeScript clean, tests pass, ARIA contract satisfied, no `any`, no inline styles, presentational contract respected.
