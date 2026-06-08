# REVIEW — TASK-09 (Ranking por Fase + Por Grupo) — UI

**Depth:** standard + UI checklist · **Files:** PhaseRanking.tsx, PhaseRanking.test.tsx, fase/page.tsx, components/index.ts · **Status:** issues_found (3 WARNING; 0 BLOCKER)

## Summary
Tela 03 sólida e fiel ao contrato. Sub-abas via `Tabs` (base-ui — `role=tablist/tab/tabpanel`, setas, `aria-selected` nativos), "Por Fase" default. Aba Por Fase = 5 cards-resumo pessoais (constante `STAGE_CARDS`, ícones Lucide por fase, `aria-hidden`), localizando a entry do usuário logado por `uid`; sem dados → `—` em todas as métricas mantendo o card visível (decisão D1/binário). Métricas Posição/Acertos/Aproveitamento com rótulos textuais + `tabular-nums` — binário respeitado (sem duplicar Pontos/Acertos, OQ1). Aba Por Grupo = `GroupSelector` (chips A–L, `min-h-11`, `aria-pressed`, cor+peso) + lista `<ol>` com destaque "Você" (`bg-primary/10` + badge textual) e linha-link ≥44px ao perfil. Estados loading/empty/error ligados às queries (degradação por card na fase; estados full na lista do grupo). Tokens semânticos sem hex/inline, Lucide named, sem `any`, `"use client"`, tsc 0, suite 3/3 (cross-checada no JSON/raw — sem false-green).

## Critical Issues
Nenhum.

## Warnings

### WR-01 (a11y P1, baixo): card "sem dados" sem rótulo agregado
**File:** `PhaseRanking.tsx` (`StageRankingCard`)
**Issue:** fase sem doc/entry renderiza `—` nas três colunas; cada métrica tem rótulo textual visível ("Posição"/"Acertos"/"Aproveitamento"), porém não há `aria-label`/`aria-description` no card comunicando "sem dados nesta fase" — o screen (§8) sugere considerar isso. Impacto baixo: rótulos + valor `—` ("travessão") já são legíveis por SR.
**Sugestão (não-bloqueante):** `aria-label` no `<li>` quando `!entry` (ex.: `"{label}: sem dados"`).

### WR-02 (semântica P1, baixo): GroupSelector como toggle-buttons, não radiogroup
**File:** `PhaseRanking.tsx` (`GroupSelector`)
**Issue:** seletor de grupo é mutuamente exclusivo (1 grupo ativo), mas usa `role="group"` + `aria-pressed` (toggle) em vez de `role="radiogroup"`/`radio` + `aria-checked` ou `aria-current`. O screen (§5/§8) aceita ambos (`aria-pressed`/`aria-current` listados), então não viola o contrato; `radiogroup` comunicaria melhor "escolha única" a SR.
**Fix:** opcional — `aria-current` ou migrar p/ radiogroup.

### WR-03 (manutenção P3, baixo): duplicação de RankingRow/initials/accuracyLabel com TASK-08
**File:** `PhaseRanking.tsx` vs `GeneralRanking.tsx`
**Issue:** `RankingRow`, `initials`, `accuracyLabel` reimplementados (TASK-08 não exportou os seus). Previsto no spec (§3: "subcomponente local se não exportado"), mas gera débito: duas fontes de verdade p/ a linha de ranking. Considerar extrair p/ `components/RankingRow.tsx` compartilhado numa task de refator.
**Fix:** carry-forward / refator, não-bloqueante.

## UI/UX Review
**Violações por prioridade:** P1: 2 (WR-01 card sem-dados a11y; WR-02 radiogroup vs toggle — ambos baixos, dentro do contrato). P3: 1 (WR-03 duplicação). P2/P4–P10: 0.
**BLOCKER:** 0 · **WARNING:** 3 (todas baixas; nenhuma bloqueia).
**Top-3 fixes:** (1) WR-01 `aria-label` no card sem dados; (2) WR-02 `aria-current`/radiogroup no seletor; (3) WR-03 extrair `RankingRow` compartilhado (refator).
**Critical (P1-2):** light-mode AA ok (tokens validados em TASK-07/08); destaque "Você" = cor + badge textual (cor não é único indicador); chips = cor + peso + `aria-pressed`; abas = cor + indicador `data-selected` + `aria-selected`. Carry-forward WR-02 de dark-green (TASK-14) aplica também aqui (`bg-primary` em chip/badge no dark).
**Recommendations (P3-10):** Layout OK (mobile-first, cards `space-y` via `gap-3`, chips `overflow-x-auto`, herda `pb-20` do shell). Navegação OK (linha→perfil deep-link, seletor = filtro não-rota, abas locais sem mudar rota — correto p/ `/rankings/fase`). Motion OK (`transition-colors`, skeleton `motion-reduce:animate-none`). Performance OK (lista de grupo curta, sem paginação — correto; `keepMounted` em ambos painéis monta as 7 queries simultâneas, aceitável para <100 usuários e cache 30min).

## Verdict: approved with adjustments

Implementação fiel ao spec/screen, contrato de hooks/tipos correto, tsc limpo e suite verde (real). 3 warnings de baixa severidade (2 a11y dentro do contrato + 1 débito de duplicação) — nenhum bloqueia o merge. Light mode AA; dark-green carry-forward da TASK-14.
