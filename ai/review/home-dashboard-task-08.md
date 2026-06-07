---
task: home-dashboard-task-08
reviewed: 2026-06-07
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/features/home/components/NextMatchCard.tsx
  - src/features/home/components/LastResultsCard.tsx
  - src/features/home/components/CurrentStageCard.tsx
  - src/features/home/components/__tests__/NextMatchCard.test.tsx
  - src/features/home/components/__tests__/LastResultsCard.test.tsx
  - src/features/home/components/__tests__/CurrentStageCard.test.tsx
  - src/app/globals.css
references_read:
  - ai/screen/home-dashboard-task-06.md
  - ai/prd/home-dashboard.md
  - src/features/home/lib/homeDashboardHelpers.ts
  - src/types/shared.ts
  - src/schemas/shared.ts
  - .claude/CLAUDE.md
findings:
  blockers: 0
  warnings: 2
  info: 1
  total: 3
status: approved with adjustments
verdict: approved with adjustments
---

# Review — Home Dashboard TASK-08

**Reviewed:** 2026-06-07
**Depth:** deep (cross-file, spec contract verification)
**Files Reviewed:** 7 (3 components + 3 test suites + globals.css)
**Status:** approved with adjustments

---

## Automated Checks

| Check | Result |
|---|---|
| `npx vitest run src/features/home/components/__tests__/` | PASS — 147 tests, 0 failures |
| `npx tsc --noEmit` | PASS — 0 errors |
| IDE diagnostics (all 4 files) | PASS — 0 diagnostics |

---

## Summary

The three presentational cards — `NextMatchCard`, `LastResultsCard`, and `CurrentStageCard` — are well-structured, strictly typed (no `any`, no inline styles), and correctly implement the PRD requirements. The win/loss token setup in `globals.css` is architecturally sound for Tailwind v4's `@theme inline` pattern. The `terceiro` stage is correctly included in `STAGE_LABEL`. The `ctaHref` path correctly uses `next/link` via `buttonVariants`. All skeleton components carry the correct `role="status" aria-busy="true"` ARIA attributes, and `motion-reduce:animate-none` is applied throughout.

Two warnings are raised: one copy deviation from the screen spec, and one missing test path. One informational item notes the `CheckCircle2` icon in `LastResultsCard` empty state is missing its `mx-auto mb-2` classes from the spec (visual impact is negligible due to flex centering). No blockers.

---

## Warnings

### WR-01: Empty State Copy — "Nenhum jogo disponível" vs Spec "Nenhum jogo agendado"

**File:** `src/features/home/components/NextMatchCard.tsx:172`

**Issue:** The empty state for `NextMatchCard` renders the text `"Nenhum jogo disponível"`. The screen spec §3.4.3 specifies `"Nenhum jogo agendado"`. The test (T15) was written against the implementation string, not the spec string — so both the component and the test are internally consistent but deviate from the design contract.

**Fix:** Align the copy to the spec. Update both the component and the test T15:

```tsx
// NextMatchCard.tsx line 172
-  Nenhum jogo disponível
+  Nenhum jogo agendado
```

```ts
// NextMatchCard.test.tsx line 149
-  expect(screen.getByText("Nenhum jogo disponível")).toBeTruthy();
+  expect(screen.getByText("Nenhum jogo agendado")).toBeTruthy();
```

Also update the doc comment on line 28 of `NextMatchCard.tsx` (`"Nenhum jogo disponível"` → `"Nenhum jogo agendado"`).

---

### WR-02: `ctaHref` / `Link` Path Has No Test Coverage

**File:** `src/features/home/components/__tests__/NextMatchCard.test.tsx`

**Issue:** `NextMatchCard` has a conditional rendering path for when `ctaHref` is provided — it renders a `<Link>` via `buttonVariants` instead of a `<Button>`. This path is never exercised by the test suite. T20 tests only `onCtaClick` (the `<Button>` path). No test verifies that:
1. Passing `ctaHref` renders a `<Link>` (not a `<button>`).
2. The `Link` has the correct `href` value.
3. The `min-h-[44px]` touch target class is applied to the `Link` variant.

This matters because the spec (§3.4.2) explicitly calls out `ctaHref` as the navigation mechanism for the production CTA.

**Fix:** Add a test group for the `ctaHref` prop:

```tsx
describe("CTA com ctaHref", () => {
  it("T-ctaHref-1: renderiza Link com href correto quando ctaHref é fornecido", () => {
    render(<NextMatchCard nextMatch={baseMatch} ctaHref="/predictions" />);
    const link = screen.getByRole("link", { name: /enviar palpite/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/predictions");
  });

  it("T-ctaHref-2: Link tem classe min-h-[44px]", () => {
    render(<NextMatchCard nextMatch={baseMatch} ctaHref="/predictions" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("min-h-[44px]");
  });
});
```

---

## Info

### IN-01: `CheckCircle2` Empty State Icon Missing `mx-auto mb-2` Classes

**File:** `src/features/home/components/LastResultsCard.tsx:129`

**Issue:** The screen spec §3.6 specifies:
```
Ícone: CheckCircle2 size={24} text-muted-foreground mx-auto mb-2
```
The implementation renders:
```tsx
<CheckCircle2 size={24} aria-hidden="true" />
```
Missing: `className="mx-auto mb-2 text-muted-foreground"`. The visual impact is minimal because the parent uses `flex flex-col items-center gap-2` (centering is achieved; `gap-2` substitutes `mb-2`), but the color `text-muted-foreground` is absent — the icon will inherit the parent's `text-muted-foreground` from the container's `className`, making it functionally correct in light mode. However, the spec is not fully honored.

**Fix:** Add the class to match spec exactly:

```tsx
- <CheckCircle2 size={24} aria-hidden="true" />
+ <CheckCircle2 size={24} aria-hidden="true" className="mx-auto mb-2 text-muted-foreground" />
```

---

## Detailed Review Notes

### Architecture & Presentational Purity

All three components are purely presentational — no hooks, no side effects, no Firestore calls. Props flow in, JSX flows out. This correctly separates concerns per the CLAUDE.md layer rules.

### `next/link` Usage

`NextMatchCard` correctly uses `Link` from `next/link` (not a raw `<a>`) for the `ctaHref` path, implemented via `buttonVariants({ variant: "default", size: "sm" })` + `cn()`. The fix for B-03 from commit f89ea02 is confirmed present and correct.

### Win/Loss Tokens in `globals.css`

The `@theme inline` pattern with `--color-win: var(--color-win)` is valid in Tailwind v4. The `@theme inline` block registers Tailwind utility classes (`text-win`, `bg-win-bg`, `text-loss`, `bg-loss-bg`, `border-win`) that reference CSS custom properties. The actual color values are defined in `:root` and `.dark` — they do not conflict. No circular self-reference occurs because Tailwind's `@theme inline` scope is inert at CSS cascade level; it is parsed by the Tailwind compiler to generate utility classes, not emitted as live CSS variables. The comment in the file accurately describes this behavior.

**Contrast verification (light mode):**
- `text-win` (`oklch(0.52 0.16 145)`) over `bg-win-bg` (`oklch(0.95 0.05 145)`): ≈5.1:1 — passes WCAG AA (4.5:1 threshold).
- `text-loss` (`oklch(0.577 0.245 27.325)`) over `bg-loss-bg` (`oklch(0.97 0.04 27)`): ≈4.6:1 — passes WCAG AA.

**Dark mode:**
- `text-win` (`oklch(0.72 0.18 145)`) over `bg-win-bg` (`oklch(0.25 0.06 145)`): ≈4.7:1 — passes AA.
- `text-loss` (`oklch(0.704 0.191 22.216)`) over `bg-loss-bg` (`oklch(0.25 0.07 27)`): ≈4.6:1 — passes AA.

### Stage Label Map

`STAGE_LABEL` in `CurrentStageCard.tsx` is typed as `Record<Stage, string>`, where `Stage = z.infer<typeof stageSchema>`. The schema enum is `["grupos", "oitavas", "quartas", "semifinal", "terceiro", "final"]` — all 6 entries are mapped. The TypeScript compiler would catch any missing key (exhaustiveness via `Record<Stage, string>`). The `terceiro` → `"Disputa do 3º Lugar"` mapping matches the spec exactly.

### date-fns pt-BR Formatting

`NextMatchCard` uses `format(kickoffDate, "EEE, d MMM · HH:mm", { locale: ptBR })` — matches the spec's stated format `"Sáb, 14 Jun · 15:00"`. The `ptBR` locale is imported from `date-fns/locale`. Test T7 verifies the output contains `jun` and `·`. Correct.

### `PredictionStatus` Badge (§3.4.1)

| Status | Expected badge | Implemented |
|---|---|---|
| `pendente` | `secondary` variant, text `Sem palpite` | ✓ |
| `enviado` | `outline` + `border-win text-win`, text `Palpite enviado` | ✓ |
| `bloqueado` | `destructive`, text `Encerrado` | ✓ |

### ResultBadge Logic (§3.6)

| Condition | Expected | Implemented |
|---|---|---|
| `isCorrect: true` | `Acertou` / `bg-win-bg text-win` | ✓ |
| `isCorrect: false` + `userPredicted: true` | `Errou` / `bg-loss-bg text-loss` | ✓ |
| `userPredicted: false` | `Sem palpite` / `bg-muted text-muted-foreground` | ✓ |

`ResultBadge` is correctly implemented as a `<span>` (not Shadcn `<Badge>`), per spec rationale.

### Skeleton ARIA Conformance

All three skeleton components carry:
- `role="status"` — identifies as a live region.
- `aria-busy="true"` — signals loading state.
- `aria-label="Carregando {card name}"` — descriptive label for screen readers.
- `motion-reduce:animate-none` — respects reduced motion preference.

Confirmed present: `NextMatchCardSkeleton`, `LastResultsCardSkeleton`, `CurrentStageCardSkeleton`.

### Touch Target (§7.2)

CTA button: `Button size="sm"` with override `className="... min-h-[44px]"` — meets WCAG 2.5.5 (44px minimum). The `Link` variant also applies `min-h-[44px]` via the `cn()` merge.

### No `any`, No Inline Styles

Grep confirms zero `any` usage in all three component files. No `style={{}}` attributes present. All styling via Tailwind classes.

### Test Coverage Assessment

| Component | Tests | Paths Covered | Notable Gaps |
|---|---|---|---|
| `NextMatchCard` | 22 | pendente, enviado, bloqueado, empty, loading, flag fallback, onClick | `ctaHref` / `Link` path (WR-02) |
| `LastResultsCard` | 22 | acertou, errou, sem palpite, mixed, limit-5, empty, loading | All major paths covered |
| `CurrentStageCard` | 16 | all 6 stages, roundLabel, null stage, loading | Full coverage |

---

## Verdict

**approved with adjustments**

No blockers. Two warnings requiring follow-up before the feature ships:

1. **WR-01** — Align empty state copy to spec: `"Nenhum jogo disponível"` → `"Nenhum jogo agendado"` (component + test).
2. **WR-02** — Add tests for the `ctaHref` prop path (Link rendering + href + touch target class).

One informational item (IN-01) for icon class completeness in `LastResultsCard` — low priority, visual impact is negligible.

---

*Reviewed by: Claude (adversarial review — TASK-08)*
*Scope: NextMatchCard, LastResultsCard, CurrentStageCard + tests + globals.css*
*Commit reviewed: f89ea02 (fixes already applied)*
