# REVIEW — TASK-07 (Ranking PRD-05) — UI

**Depth:** standard + UI checklist · **Files:** globals.css, rankings/** (layout+6 rotas), components/** · **Status:** issues_found (2 WARNING; WR-02 corrigido nesta passagem; 0 BLOCKER)

## Summary
Shell navegável correta: tema verde por escopo (`.ranking-theme`, mesmo verde AA de auth/palpites), `RankingSubNav` com `aria-current` + destaque por cor/peso/borda, estados (skeleton/empty/error) com roles e reduced-motion, retry funcional, 6 rotas reais (deep-link/back previsível), tokens semânticos sem hex/inline, Lucide, sem `any`, tsc 0, suite 1736/1736. Bottom Tab Bar intacto.

## Critical Issues
Nenhum.

## Warnings

### WR-01 (a11y dark mode, médio): contraste do verde `--primary` (0.46) no dark
**File:** `globals.css` `.ranking-theme`
**Issue:** `.ranking-theme` define `--primary: oklch(0.46 0.16 150)` p/ light **e** dark. No dark mode (`--background` 0.145), o tab ativo `text-primary` (verde 0.46) em fundo escuro pode ficar <4.5:1 p/ texto 14px (`text-sm`). **Padrão latente idêntico em `.palpites-theme`** (que também não tem override dark). Light mode (default) é AA.
**Fix (carry-forward p/ pass de dark-mode):** adicionar `.dark .ranking-theme { --primary: <verde mais claro ~oklch(0.72 0.18 150)>; --primary-foreground: <escuro> }` e replicar em `.palpites-theme`. Decisão de cor cross-cutting — melhor batched, não isolado nesta task.

### WR-02 (a11y foco, baixo): focus-ring explícito na sub-nav — **CORRIGIDO**
**File:** `RankingSubNav.tsx`
**Issue:** links da sub-nav dependiam do outline default do browser; MASTER §10.5 exige `ring-2 ring-ring`.
**Fix aplicado:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` nos links. tsc 0.

## UI/UX Review
**Violações por prioridade:** P1: 1 (WR-01 dark contrast) · P1: 1 (WR-02 foco — corrigido) · P2–P10: 0.
**BLOCKER:** 0 · **WARNING:** 2 (1 corrigida, 1 carry-forward).
**Top-3 fixes:** (1) WR-01 dark-mode green token; (2) WR-02 focus-ring ✓ feito; (3) validar agrupamento da sub-nav (G1) ao montar Telas 02/05.
**Critical (P1-2):** WR-02 (foco) resolvido; WR-01 (dark contrast) — light mode AA ok, dark pendente.
**Recommendations (P3-10):** Performance OK (skeleton, sem imagens); Estilo OK (tokens, Lucide); Layout OK (mobile-first, scroll-x nav, pb-20); Navegação OK (deep-links, ativo destacado, bottom bar intacto).

## Verdict: approved with adjustments

WR-02 corrigido. WR-01 (contraste verde no dark) é carry-forward para um pass de dark-mode conjunto com `.palpites-theme` (padrão pré-existente; light mode default é AA). Não bloqueia. Registrado na TASK-14.
