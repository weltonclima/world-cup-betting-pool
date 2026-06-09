# REVIEW — TASK-13 (Estatísticas Gerais) — UI

**Depth:** standard + UI checklist · **Files:** PoolStatsScreen.tsx, PoolStatsScreen.test.tsx, estatisticas/page.tsx · **Status:** issues_found (1 WARNING carry-forward; 0 BLOCKER)

## Summary
Tela 06 sólida e fiel ao screen-spec: header verde de destaque (`bg-primary text-primary-foreground rounded-2xl`) com `totalParticipants` pt-BR + "Participantes"; grid 2×2 (`grid-cols-1 sm:grid-cols-2`) de `StatCard`s mapeados 1:1 de `PoolStats` (Maior/Menor/Média/Total) com fallback `highestPointsName ?? "Participante"`; média via `Intl.NumberFormat("pt-BR",{min/maxFractionDigits:1})` → "56,4" (sem hardcode de vírgula); seção `h2` "Distribuição de Pontuação" + `DistributionBars` consumido as-is; seção oculta quando `distribution` vazio (cards permanecem). Estados loading/empty/error ligados ao hook, com guard duplo `null || undefined || totalParticipants===0` para empty e `refetch` no retry. `tabular-nums` no header e em todos os números. Sem `any`, sem hex/inline no arquivo novo, tokens semânticos, tsc 0, suite 3/3 (raw JSON confirmado).

## Critical Issues
Nenhum.

## Warnings

### WR-01 (a11y dark, médio): contraste do verde no dark — carry-forward (TASK-07/14)
**File:** `PoolStatsScreen.tsx` (header `bg-primary`, `text-primary` nos números dos cards)
**Issue:** `--primary` verde 0.46 + `text-primary-foreground` (branco) no header, e `text-primary` sobre `bg-card`, são AA em **light mode** (default, validado em auth/palpites). No **dark mode** o mesmo verde pode ficar abaixo de AA. **Mesmo carry-forward já registrado nas TASK-07/08/14** (`.dark .ranking-theme` com verde mais claro).
**Fix:** pass de dark-mode da TASK-14 (já listado). Não bloqueia; light mode é AA.

## UI/UX Review
**Violações por prioridade:** P1: 1 (WR-01 dark contrast — carry). P2–P10: 0.
**BLOCKER:** 0 · **WARNING:** 1 (carry-forward).
**Top-3 fixes:** (1) WR-01 dark-green token (TASK-14); (2) opcional: teste do fallback `highestPointsName` undefined → "Participante" (nice-to-have, lógica trivial); (3) opcional: exibir `updatedAt` como rodapé sutil se produto pedir (G4/OQ3 — hoje fora do contrato visual, default correto).
**Critical (P1-2):** WR-01 light-mode AA ok, dark pendente (carry).
**Recommendations (P3-10):**
- **Acessibilidade:** distribuição legível sem cor (label + count textual `tabular-nums` no `DistributionBars`); empty/error com `role="status"`/`role="alert"`; foco visível no botão de retry (TASK-07); heading `h2` sequencial sob o `h1` "Ranking" do layout. OK.
- **Lógica/formatação:** pt-BR via `Intl` (não hardcode); guard empty cobre `null`, `undefined` e zero-participantes; mapeamento direto sem cálculo no componente; distribuição renderizada na ordem recebida (sem reordenar). OK.
- **Estilo:** tokens semânticos (`bg-primary`/`bg-card`/`border-border`/`text-muted-foreground`); sem hex/inline no arquivo novo (exceção `width` isolada no `DistributionBars` pré-existente, não tocada). OK.
- **Layout:** mobile-first 1→2 colunas em `sm`; header e distribuição full-width; `pb-20` do layout compensa Bottom Tab Bar. OK.
- **Performance:** tela estática de leitura, 4 cards + ≤5 barras; sem necessidade de memo/virtualização. OK.

## Verdict: approved with adjustments

WR-01 é o mesmo carry-forward de dark-mode já endereçado na TASK-14. Nenhum bloqueia; light mode (default) é AA. Implementação fiel ao spec §10 e screen-spec.
