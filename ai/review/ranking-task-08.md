# REVIEW — TASK-08 (Ranking Geral) — UI

**Depth:** standard + UI checklist · **Files:** GeneralRanking.tsx, pagination.ts(+test), page.tsx, GeneralRanking.test.tsx · **Status:** issues_found (2 WARNING; WR-01 corrigido; 0 BLOCKER)

## Summary
Tela 01 sólida: pódio top-3 (coroa, ordem visual 2-1-3 via CSS, DOM=ranking), lista #4+ semântica `<ol>/<li>`, destaque "Você" (bg-primary/10 + badge textual), paginação 20/página com helper puro testado, estados loading/empty/error, linhas-link ≥44px com focus-ring. Binário respeitado (Pts + Aprov, sem Acertos duplicado). Tokens sem hex/inline, Lucide, sem `any`, tsc 0, suite 1745/1745.

## Critical Issues
Nenhum.

## Warnings

### WR-01 (a11y P1, médio): pódio sem indicador de posição p/ screen reader — **CORRIGIDO**
**File:** `GeneralRanking.tsx` (RankingPodium)
**Issue:** só o 1º tinha coroa; 2º/3º não expunham a posição, e a ordem DOM (1-2-3) diverge da visual (2-1-3) por `order` CSS — usuário não-visual não distinguia o rank dos cards do pódio.
**Fix aplicado:** `aria-label="{position}º lugar: {nome}, {pts} pontos (você)"` no link de cada card do pódio. Resolve rank + contexto de foco. Tests verdes, tsc 0.

### WR-02 (a11y dark, médio): contraste do verde no dark — carry-forward (TASK-07)
**Issue:** `bg-primary` (badge "Você", card do 1º) usa verde 0.46 em light+dark; no dark mode o branco sobre esse verde e o `text-primary` podem ficar abaixo de AA. **Mesmo carry-forward já registrado na TASK-07/TASK-14** (`.dark .ranking-theme` com verde mais claro). Light mode (default) é AA.
**Fix:** na TASK-14 (pass de dark-mode), já listado.

## UI/UX Review
**Violações por prioridade:** P1: 2 (WR-01 rank a11y — corrigido; WR-02 dark contrast — carry). P2–P10: 0.
**BLOCKER:** 0 · **WARNING:** 2 (1 corrigida, 1 carry-forward).
**Top-3 fixes:** (1) WR-01 aria pódio ✓ feito; (2) WR-02 dark-green token (TASK-14); (3) considerar centrar paginação no usuário (OQ3, nice-to-have, não-bloqueante).
**Critical (P1-2):** WR-01 resolvido; WR-02 light-mode AA ok, dark pendente.
**Recommendations (P3-10):** Performance OK (paginação 20 → max 20 linhas renderizadas, sem necessidade de virtualização); Estilo OK (tokens, Crown SVG, escopo verde); Layout OK (mobile-first, pódio 3 colunas, `pb-20` no layout); Navegação OK (linha→perfil deep-link, paginação clara, bottom bar intacto).

## Verdict: approved with adjustments

WR-01 corrigido nesta passagem (aria pódio). WR-02 é o mesmo carry-forward de dark-mode já na TASK-14. Nenhum bloqueia; light mode (default) AA.
