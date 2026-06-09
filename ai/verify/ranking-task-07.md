# VERIFICATION

## 1. Task: TASK-07 – Shell de Ranking + estados + roteamento

## 2. Must-have truths
- T-01: Placeholder substituído; 6 sub-rotas existem e renderizam — **VERIFIED**
- T-02: `.ranking-theme` (verde escopo) em globals.css + aplicado no layout — **VERIFIED**
- T-03: `RankingSubNav` com aria-current, sticky, ativo por cor+peso+borda — **VERIFIED**
- T-04: Skeleton/Empty/Error com reduced-motion, mensagens e retry — **VERIFIED**
- T-05: Barrels exportam shell+charts — **VERIFIED**
- T-06: Tokens semânticos, sem hex/inline/any, tsc strict — **VERIFIED**
- T-07: Suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/page.tsx` (Geral, substituiu placeholder) + `fase/`, `eu/`, `evolucao/`, `perfil/[uid]/`, `estatisticas/` page.tsx (stubs p/ TASK-08..13). Layout renderiza SubNav + h1 sobre todas.
- **T-02:** `globals.css` `.ranking-theme { --primary/--primary-foreground/--ring/--sidebar-primary: oklch(0.46 0.16 150)/...; --chart-1: oklch(0.46 0.16 150) }`. `rankings/layout.tsx` envolve em `<div className="ranking-theme ...">`. Mesmo verde AA de auth/palpites.
- **T-03:** `RankingSubNav.tsx` — `usePathname()`, itens `next/link`, ativo `aria-current="page"` + `border-primary font-semibold text-primary`, `sticky top-14 z-40`, `overflow-x-auto`, `min-h-11`. Lógica de ativo: `/rankings` exato; demais `startsWith`.
- **T-04:** `RankingSkeleton` (`animate-pulse motion-reduce:animate-none`, `role=status`, `rows=8`); `RankingEmptyState` (`Users`, "Nenhum participante encontrado", `role=status`); `RankingErrorState` (`AlertTriangle text-destructive`, "Erro ao carregar ranking", `Button` "Tentar Novamente" `onClick=onRetry`, `role=alert`, `min-h-11`).
- **T-05:** `components/index.ts` exporta os 4 + `* from "./charts"`; `features/rankings/index.ts` exporta hooks+lib+components.
- **T-06:** Classes `bg-*/text-*` semânticas; única exceção inline já é a do DistributionBars (TASK-06). Lucide named (`Users`, `AlertTriangle`). Scan `any` → nenhum. `tsc --noEmit` exit=0.
- **T-07:** `RankingStates.test.tsx` 4/4 (retry chamado, mensagens, role=status). Vitest full 1736/1736 (543 suites).

## 4. Test correlation
`RankingStates.test.tsx` (jsdom) — assertam comportamento real: clique em "Tentar novamente" chama `onRetry` (1x); mensagens default/subtítulo renderizadas; skeleton expõe `role=status` acessível. RankingSubNav não tem teste unitário dedicado (navegação; coberto visualmente nas telas) — aceitável p/ shell.

## 5. Out-of-scope drift
none. Conteúdo das telas 08–13 fica como stub (correto). Tema verde introduzido só via `.ranking-theme` (escopo), sem re-tema global — conforme decisão do usuário.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota: stubs "Em construção" nas 6 rotas são intencionais (placeholders rastreáveis p/ TASK-08..13); não são stubs que mascaram dado faltante de ESTA task — a shell/estados/nav (o deliverable da TASK-07) está completa.

## 7. Verdict: goal-achieved
