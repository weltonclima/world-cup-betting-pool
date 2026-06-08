# REVIEW — TASK-10 (Meu Ranking) — UI

**Depth:** standard + UI checklist · **Files:** MyRanking.tsx, myRankingDerivations.ts(+barrel), eu/page.tsx, MyRanking.test.tsx · **Status:** issues_found (2 WARNING; 0 BLOCKER)

## Summary
Tela 02 sólida. Header verde hero (`rounded-2xl bg-primary text-primary-foreground`, aria-label de posição, badge "Você" textual), grid 2×2 (Pontos/Acertos/Erros/Aproveitamento) com `text-3xl font-bold tabular-nums text-primary`, mini-gráfico "Desempenho Geral" via `EvolutionLineChart` com alternativa textual (`role="img"` + `aria-label` + `sr-only`), cards derivados Melhor Posição / Média de Pontos. Binário tratado corretamente: Pontos e Acertos exibem o mesmo `entry.points` com microcopy ("cada placar exato vale 1 ponto") — não parece bug e não cruza valores. `totalWrong ?? "—"` (não 0). Aproveitamento `entry.accuracy ?? statistics.accuracy`. Derivações puras na lib (mín posição com desempate na ocorrência mais recente, média pt-BR 1-decimal / "—", filtro scope geral ordenado por `at`). Estados loading/empty/error com retry das duas queries. Link "Ver evolução" `next/link` `min-h-11` com focus-ring. h1 "Ranking" no layout → h2 da seção (headings sequenciais). `.ranking-theme` não reaplicado. Tokens sem hex/inline, Lucide named, sem `any`, tsc exit 0, suite 4/4 (cross-check JSON — não false-green).

## Critical Issues
Nenhum.

## Warnings

### WR-01 (testes, baixo): helper puro `myRankingDerivations.ts` sem teste dedicado
**File:** `src/features/rankings/lib/myRankingDerivations.ts` (sem `__tests__/`)
**Issue:** `bestPosition`/`averagePointsPerRound`/`geralHistory`/`toEvolutionPoints` são determinísticos e a §9 os recomenda como "testes leves". A math (mín, empate na ocorrência mais recente, média 1-decimal, divisor 0 → "—", filtro scope + ordenação por `at`, `round ?? i+1`) só é exercida indiretamente pelo `MyRanking.test.tsx`. Casos de borda não cobertos isoladamente: histórico vazio (`null`/"—"), ponto único, empate na mínima (verifica se pega a mais recente), `round` ausente (fallback índice).
**Impacto:** baixo — §9 marca como não-bloqueante; a lógica está correta na leitura e o teste de componente cobre o caminho principal + a fronteira do filtro geral (snapshot `oitavas` ignorado).
**Sugestão (não-bloqueante):** adicionar `lib/__tests__/myRankingDerivations.test.ts` com os 4 casos de borda.

### WR-02 (a11y dark, médio): contraste do verde no dark — carry-forward (TASK-14)
**File:** `MyRanking.tsx` (`MyRankingHeader` hero `bg-primary` + `text-primary-foreground`; badge `bg-primary-foreground text-primary`; números `text-primary`).
**Issue:** o verde de escopo `oklch(0.46 0.16 150)` é AA em light mode (validado), mas no dark mode `text-primary` (verde) sobre `bg-card` e o branco sobre `bg-primary` podem cair abaixo de AA. **Mesmo carry-forward já registrado em TASK-07/08/14** (`.dark .ranking-theme` com verde mais claro).
**Fix:** TASK-14 (pass de dark-mode). Light mode (default) é AA.

## Notas (não-warnings)
- **Badge "Você" sobre verde:** `bg-primary-foreground text-primary` = superfície clara + verde — opção AA do /screen §5; contraste OK em light.
- **`role="img"` no wrapper do gráfico:** padrão correto — o `aria-label` dá nome acessível e o `sr-only` duplica o texto para leitores que não anunciam o label do `role="img"`; o Recharts interno fica como conteúdo decorativo. Vazio cai no "Sem histórico de posições ainda." (consistente com o "Sem histórico ainda" do chart).
- **`percentFmt` interpola `accuracy` cru** (`${value}%`): `accuracy` é `percentageSchema` (0–100 number) — sem casas forçadas; coerente com o mock "25%". Sem fração inesperada pois a fonte controla o valor.
- **Binário (G1):** os dois cards com o mesmo número são intencionais e documentados na §6.1/screen G1 — não confundir com bug de cópia de valor.

## UI/UX Review
**Violações por prioridade:** P1: 1 (WR-02 dark contrast — carry). P7 (testes/qualidade): 1 (WR-01 — não-bloqueante). P2–P6, P8–P10: 0.
**BLOCKER:** 0 · **WARNING:** 2 (ambas não-bloqueantes: 1 carry-forward, 1 sugestão de teste).
**Top-3 fixes:** (1) WR-01 teste do helper (nice-to-have); (2) WR-02 dark-green token (TASK-14); (3) nenhum outro.
**Critical (P1-2):** WR-02 light-mode AA ok, dark pendente (carry). Sem outras P1-2.
**Recommendations (P3-10):** Layout OK (mobile-first, grid 2×2 em todos os breakpoints, `pb-20` no layout pai). Tipografia OK (`tabular-nums`, `text-3xl/4xl font-bold`). A11y OK (aria-label hero, alternativa textual do gráfico, foco visível, headings h1→h2, alvo ≥44px, badge textual). Motion: `transition-colors duration-150` no link, sem animar dimensão; chart Recharts herda tratamento da TASK-06. Navegação OK (link contextual → /rankings/evolucao, sub-nav/bottom-bar intactos).

## Verdict: approved with adjustments

Nenhum BLOCKER. WR-01 é melhoria de cobertura de teste (§9 não-bloqueante). WR-02 é o mesmo carry-forward de dark-mode já endereçado na TASK-14. Light mode (default) AA; binário, derivações, estados e a11y corretos.
