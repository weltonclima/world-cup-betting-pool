---
task: home-dashboard-task-07
reviewed: 2026-06-07T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/features/home/components/RankingCard.tsx
  - src/features/home/components/CorrectScoresCard.tsx
  - src/features/home/components/AccuracyCard.tsx
  - src/features/home/components/PerformanceCard.tsx
  - src/features/home/components/__tests__/RankingCard.test.tsx
  - src/features/home/components/__tests__/CorrectScoresCard.test.tsx
  - src/features/home/components/__tests__/AccuracyCard.test.tsx
  - src/features/home/components/__tests__/PerformanceCard.test.tsx
references_read:
  - ai/screen/home-dashboard-task-06.md
  - ai/prd/home-dashboard.md
  - src/features/home/lib/homeDashboardHelpers.ts
  - src/features/home/components/HomeDashboard.tsx
  - src/app/globals.css
findings:
  blocker: 2
  warning: 1
  info: 0
  total: 3
verdict: rejected
---

# Review Report — Home Dashboard TASK-07

**Reviewed:** 2026-06-07
**Depth:** deep (cross-file, contract validation, real CI runs)
**Files Reviewed:** 8
**Verdict:** REJECTED — 2 BLOCKERs found

---

## Summary

TASK-07 implements four metric cards (RankingCard, CorrectScoresCard, AccuracyCard, PerformanceCard) and their skeletons. The fundamentals are solid: zero TypeScript errors, zero IDE diagnostics, all 147 tests green, no `any`, no inline styles, correct use of the `text-win` semantic token (B-01 fix verified applied), correct `RankingSummary`/`PerformanceSummary` import without local redefinition, skeleton ARIA pattern (`role="status" aria-busy="true" aria-label="Carregando …"`) consistent throughout, and `RankingCard` correctly surfaces the points row (PRD §2 lists "posição, total de participantes, pontos" — present and labeled "N pontos").

Two contract deviations against the canonical visual spec (`ai/screen/home-dashboard-task-06.md`) are BLOCKERs. One additional WARNING concerns prop-type widening.

---

## BLOCKER Findings

### B-01: PerformanceCard sub-metrics deviate from visual contract — wrong fields exposed

**File:** `src/features/home/components/PerformanceCard.tsx:95-98`

**Issue:** The screen spec §3.7 mandates four sub-metrics:

| Slot | Value | Label |
|---|---|---|
| 1 | `totalCorrect` | Acertos |
| 2 | `accuracy` % | Aproveitamento |
| 3 | `longestStreak` | Maior sequência |
| 4 | derived `gamesPredicted` (D1) | Palpites |

The implementation renders:

| Slot | Value | Label |
|---|---|---|
| 3 | `gamesPredicted` (always `null` → "—") | Jogos palpitados |
| 4 | `wrong` (always `null` → "—") | Erros |

Slots 3 and 4 are swapped vs. spec and the labels are entirely different. "Maior sequência" (backed by `statistics.longestStreak`, which exists in `PerformanceSummary`'s upstream type `Statistics`) is absent. "Palpites" should be the derived `gamesPredicted` value per D1 — not "Jogos palpitados". "Erros" has no counterpart in the spec whatsoever.

Consequence: the UI visible to the user contradicts the agreed design contract and the PRD §2 item 8 ("Card Meu Desempenho — jogos palpitados, acertos, erros, aproveitamento"). Slot 3 and 4 labels are entirely wrong and `longestStreak` is silently dropped.

**Root cause:** `PerformanceSummary` (in `homeDashboardHelpers.ts`) is missing a `longestStreak` field. The helper `derivePerformanceSummary` does not extract `statistics.longestStreak`. The card propagates whatever the summary exposes; since `longestStreak` is never plumbed, the card falls back to the null fields.

**Fix — two parts:**

1. Add `longestStreak` to `PerformanceSummary` in `homeDashboardHelpers.ts`:

```ts
export interface PerformanceSummary {
  totalCorrect: number;
  accuracy: number;
  longestStreak: number;   // statistics.longestStreak (0 quando sem dados)
  /** null: sem statistics no MVP (D1). */
  gamesPredicted: null;
  /** null: sem statistics no MVP (D1). */
  wrong: null;
}

export function derivePerformanceSummary(
  statistics: Statistics | null | undefined,
): PerformanceSummary {
  return {
    totalCorrect: statistics?.totalCorrect ?? 0,
    accuracy: statistics?.accuracy ?? 0,
    longestStreak: statistics?.longestStreak ?? 0,
    gamesPredicted: null,
    wrong: null,
  };
}
```

2. Update `PerformanceCard.tsx` to match the spec sub-metrics:

```tsx
const { totalCorrect, accuracy, longestStreak, gamesPredicted } = summary;
const accuracyDisplay = `${Math.round(accuracy)}%`;
const gamesPredictedDisplay = gamesPredicted === null ? "—" : String(gamesPredicted);

// grid order: Acertos | Aproveitamento | Maior sequência | Palpites
<div className="grid grid-cols-2 gap-3 mt-3">
  <SubMetrica value={String(totalCorrect)}     label="Acertos" />
  <SubMetrica value={accuracyDisplay}           label="Aproveitamento" />
  <SubMetrica value={String(longestStreak)}     label="Maior sequência" />
  <SubMetrica value={gamesPredictedDisplay}     label="Palpites" />
</div>
```

Update `PerformanceCard.test.tsx` accordingly (replace "Jogos palpitados"/"Erros" expectations with "Maior sequência"/"Palpites" and add assertion for longestStreak value).

---

### B-02: CorrectScoresCard label deviates from visual contract

**File:** `src/features/home/components/CorrectScoresCard.tsx:69`

**Issue:** The screen spec §3.2 specifies:

> Label: `text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto` — text content: **"acertos"** (rendered uppercase by CSS `uppercase`).

The implementation renders **"Placares exatos"** as the label. This is a semantic and visual contract deviation. The user-facing label is wrong compared to the agreed design artifact.

Note: "Placares exatos" is accurate as a description, but it is not what the visual contract specifies. The label serves as the card's semantic identifier (mirrored by `aria-label="Acertos"` on the `<article>`), and a mismatch between the aria-label and the visible label is also an accessibility inconsistency.

**Fix:**

```tsx
// CorrectScoresCard.tsx line 69
<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto">
  Acertos
</span>
```

Update `CorrectScoresCard.test.tsx` — replace `"Placares exatos"` expectations with `"Acertos"`.

---

## WARNING Findings

### W-01: CorrectScoresCard prop type is wider than the consumer contract requires

**File:** `src/features/home/components/CorrectScoresCard.tsx:41`

**Issue:** `CorrectScoresCardProps.totalCorrect` is typed `number | null`. However, `PerformanceSummary.totalCorrect` is `number` (guaranteed non-null — it defaults to `0`, never `null`). The orchestrator (`HomeDashboard.tsx:160`) passes `performance.totalCorrect` which is always `number`. The `null` branch in the component is therefore unreachable in production.

This is not a bug today (TypeScript allows narrower → wider), but it is misleading: it implies the component handles a case that never occurs via its intended call site, and the test for `totalCorrect={null}` tests dead code from the perspective of the real data flow.

**Fix (optional — cleanup):** Either tighten the prop to `number` (remove the null branch and the null test) and handle the "no data" case by passing `0`, or document explicitly why `null` is preserved as an intentional future escape hatch. Changing to `number` would make the prop type match `PerformanceSummary.totalCorrect` exactly and simplify the component. Accept this finding as a future refactor if the null branch is intentionally kept for defensive programming.

---

## Checks Passed (for reference)

| Check | Result |
|---|---|
| `npx vitest run src/features/home/components` | 147 tests, 0 failures |
| `npx tsc --noEmit` | 0 errors |
| IDE diagnostics (all 4 files) | 0 diagnostics |
| `any` usage | None |
| Inline styles (`style={{}}`) | None |
| `text-win` token (CorrectScoresCard icon) | Present — B-01 fix from prior commit verified |
| `text-emerald-*` / `text-green-*` / raw hex | None |
| `--color-win` in `globals.css` `:root` + `.dark` + `@theme inline` | Present and correct |
| `RankingSummary` imported from helpers (no redefinition) | Correct |
| `PerformanceSummary` imported from helpers (no redefinition) | Correct |
| Skeletons: `role="status" aria-busy="true" aria-label="Carregando …"` | All 4 cards present |
| `aria-hidden="true"` on decorative icons | All cards correct |
| `<article aria-label="…">` semantic element | All 4 cards correct |
| Big-number typography `text-2xl font-bold text-foreground` | All metric cards correct |
| Card shell `rounded-lg border border-border bg-card p-3 shadow-sm` | Compact metric cards correct |
| RankingCard points row (`N pontos`) | Present — PRD-correct |
| `PerformanceCard` "—" for `gamesPredicted`/`wrong` (D1 MVP) | Present |
| Props-only / no hooks / no fetch in any of the 4 components | Confirmed |
| `motion-reduce:animate-none` on all skeletons | Confirmed |

---

## Action Items for `/implement`

1. **[BLOCKER B-01]** Add `longestStreak: number` to `PerformanceSummary` in `homeDashboardHelpers.ts` and `derivePerformanceSummary`. Update `PerformanceCard` sub-metrics to match spec §3.7: `[Acertos, Aproveitamento, Maior sequência, Palpites]`. Update `PerformanceCard.test.tsx`.

2. **[BLOCKER B-02]** Change `CorrectScoresCard` label text from `"Placares exatos"` to `"Acertos"`. Update `CorrectScoresCard.test.tsx` label assertions accordingly.

3. **[WARNING W-01]** (optional) Tighten `CorrectScoresCardProps.totalCorrect` from `number | null` to `number` once B-02 is resolved and the intent is confirmed. Remove the null test or document as intentional defensive widening.

---

*Reviewed: 2026-06-07*
*Reviewer: Claude (adversarial review — home-dashboard-task-07)*
*Depth: deep*
