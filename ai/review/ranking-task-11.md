# REVIEW — TASK-11 (Evolução no Ranking) — UI

**Depth:** standard + UI checklist · **Files:** Evolution.tsx, Evolution.test.tsx, evolucao/page.tsx, components/index.ts (barrel) · **Status:** issues_found (1 WARNING; 0 BLOCKER)

## Summary
Tela 04 sólida e fiel ao contrato. Header verde (`bg-primary text-primary-foreground`) com `EvolutionLineChart` aninhado em superfície clara (`bg-card`), lista de rodadas em `<ol>` recente→antiga com `#N` (`tabular-nums`) + indicador (ícone Lucide + delta + `aria-label`), badge "Atual" na mais recente, "—" na rodada 1, legenda ícone+texto. Estados loading/empty("Sem histórico ainda")/error(+retry) ligados ao hook. Reusa derivações puras (`geralHistory`/`toEvolutionPoints`), `evolutionIndicator`, chart e estados sem recriar. `.ranking-theme` herdado do layout; `<h1>` (layout) → `<h2>` (Evolution) sequenciais. tsc 0, suite Evolution 3/3, sem `any`/hex/inline, Lucide named.

## Critical Issues
Nenhum.

## Warnings

### WR-01 (a11y/fidelidade, baixo): badge "Atual" não usa Shadcn `Badge`
**File:** `Evolution.tsx:115-119`
**Issue:** o /screen §5 sugere `Badge variant="secondary"`; a implementação usa `<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">`. Visualmente equivalente (badge cinza-claro arredondado, como o mock) e o texto "Atual" é lido por SR. Divergência cosmética/consistência de design-system, não funcional.
**Sugestão (não-bloqueante):** trocar por `Badge` para uniformidade com TASK-08/10.

## Logic correctness (adversarial)
- **Reversão recente-first:** indicadores calculados em ordem ascendente (`geral.map`, `evolutionIndicator(geral[i-1]?.position, ...)`), depois `[...rowsAsc].reverse()` — delta de cada rodada é vs. a anterior cronológica, correto mesmo após inverter. ✓
- **Rodada 1:** `geral[-1]?.position === undefined` → `evolutionIndicator(undefined, pos)` → `same/0` → render "—". ✓ (não há falso "caiu/subiu").
- **Detecção de rodada atual:** `isCurrent = i === geral.length-1` no array ascendente filtrado a geral — a mais recente por `at`. ✓
- **Pluralização do delta:** `pluralPosicoes` → "1 posição" / "N posições"; usado só nos `aria-label` ("subiu/caiu"). `same` não usa delta. ✓
- **Escopo/ordenação:** `geralHistory` filtra `scope==="geral"` e ordena por `at` antes de qualquer derivação; o índice de fallback de `round` opera sobre o array já filtrado/ordenado — consistente entre gráfico e lista. ✓
- **G2 (chart no header verde):** resolvido por aninhar o `EvolutionLineChart` em `bg-card` (`Evolution.tsx:63`) dentro da `section` verde. É a opção (a) do /screen G2. **AA-sound:** o stroke `--chart-1` (verde) renderiza sobre superfície clara, não sobre o verde do header, então o problema de contraste verde-sobre-verde do mock não existe. Diverge do mock (linha branca sobre verde) mas é fiel à intenção (ler a tendência) e evita override de cor do chart por escopo. Aceitável — não-bloqueante.

## UI/UX Review
- **Cor não é único indicador (P1):** todo indicador = ícone (ArrowUp/ArrowDown/Minus) + valor/"—" + `aria-label` ("subiu N posições"/"caiu N posições"/"manteve a posição"). Ícones `aria-hidden`; o número `aria-hidden` (coberto pelo `aria-label` do span pai — evita dupla locução). Legenda também ícone+texto. ✓
- **Alternativa textual do gráfico:** a lista de rodadas carrega o significado completo; chart é complementar (SVG Recharts). ✓
- **Contraste:** header `text-primary-foreground` sobre `bg-primary` (verde 0.46) AA (validado auth/palpites); `text-destructive` sobre `bg-card` AA; chart sobre `bg-card` claro. Light mode (default) AA.
- **tabular-nums:** em `#N` e no delta. ✓
- **Foco/retry:** retry herdado de `RankingErrorState` (`Button min-h-11`, `aria-label`, focus-ring do Button). Linhas não interativas (correto p/ tela informativa). ✓
- **Headings sequenciais:** `<h1>` layout → `<h2>` Evolution. ✓
- **Reduced-motion:** skeleton de TASK-07 trata `motion-reduce`; sem animação de entrada própria. ✓
- **Mobile-first / Bottom bar:** `pb-20` no layout; conteúdo `flex flex-col gap-6`. ✓

**Violações por prioridade:** P1: 0. P2–P10: 1 (WR-01 fidelidade de componente, baixo).
**BLOCKER:** 0 · **WARNING:** 1 (não-bloqueante).
**Top fixes:** (1) WR-01 usar Shadcn `Badge` (cosmético). (2) opcional: considerar variante de stroke clara no header se quiser fidelidade exata ao mock (G2) — atual é AA e aceitável.

## Verdict: approved with adjustments

Nenhum bloqueio. WR-01 é cosmético/consistência. G2 resolvido de forma AA-sound (chart em `bg-card` aninhado). tsc 0, Evolution 3/3, sem `any`/hex/inline, Lucide, `.ranking-theme`.
