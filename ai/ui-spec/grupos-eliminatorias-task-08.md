# UI-SPEC — TASK-08 (Tela Eliminatórias)

> Fonte: `ai/spec/grupos-eliminatorias-task-08.md` · Layout: `docs/prd-03-1/prd-3-2.png` (PRD03-06..09)
> Design intelligence: ui-ux-pro-max (vertical phase stack, match-card states, color-not-only, truncation) — decisões **self-contained**; `/implement` e `/ui-review` consomem sem re-invocar a skill.

## 1. Identity
- Name: `BracketView` (+ `PhaseSection`, `KnockoutMatchCard`)
- Type: Screen (aba Eliminatórias)
- Tech: Next.js 15 App Router (React 19), Tailwind v4, lucide, TanStack Query (via `useBracket`)
- Complexity: Full (6 fases, 3 estados de card, responsivo, estados de ciclo de vida)

## 2. Visual Structure (ASCII)

```
Área Jogos (max-w-4xl, abaixo das CompetitionTabs)
┌──────────────────────────────────────────────┐
│ Dezesseis-avos                                 │  ← PhaseSection (título)
│ ┌────────────────────────────┐                 │
│ │ 🇧🇷 Brasil    2 x 1   🇫🇷 França │ encerrado    │  ← KnockoutMatchCard
│ └────────────────────────────┘                 │
│ ┌────────────────────────────┐                 │
│ │ 🇦🇷 Argentina   x   🇲🇽 México │ definido      │
│ └────────────────────────────┘                 │
│ ┌────────────────────────────┐                 │
│ │ ❓ Vencedor Jogo 74  x  ❓ 1º Grupo A │        │
│ │           Aguardando definição          │     │  ← aguardando
│ └────────────────────────────┘                 │
│ Oitavas de Final …                             │
│ … Quartas … Semifinais … 3º Lugar … Final      │
└──────────────────────────────────────────────┘
```

Mobile 360px: cards full-width empilhados, bandeiras `w-8 h-6`, nomes `truncate`, placar central destacado.

## 3. Component Breakdown
| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `BracketView` | client | — | loading/error/empty/ok | `useBracket()`; mapeia 6 buckets na ordem fixa; omite seção vazia |
| `PhaseSection` | client | `label,matches,className?` | — | título + lista vertical; `null` se vazio |
| `KnockoutMatchCard` | client | `match,className?` | aguardando/definido/encerrado | card verde; 2 lados + centro (placar ou "x") |

## 4. Interaction States
| Element | Default | Hover | Notes |
|---|---|---|---|
| KnockoutMatchCard | `rounded-xl border border-border bg-card shadow-sm p-4` | — (não navegável; somente leitura) | sem link/onClick (PRD: read-only) |
| Lado defined | bandeira + nome `text-foreground` | — | — |
| Lado placeholder (defined:false) | ícone neutro + nome `text-muted-foreground` | — | — |
| Botão "Tentar novamente" (error state) | shadcn outline `min-h-[44px]` | hover shadcn | reusa `WorldcupErrorState` |

Cards são estáticos (read-only) — sem estados hover/press/focus de interação. Foco/teclado só nos controles reais (retry no estado de erro).

## 5. Data Binding
| Field | Source | Transform | Trigger |
|---|---|---|---|
| 6 buckets | `useBracket().data` | iterar `PHASES` na ordem fixa | query settle |
| seção visível | `bucket.length > 0` | omitir vazias | — |
| estado do card | `match.status` | switch aguardando/definido/encerrado | — |
| placar | `match.homeScore`/`awayScore` | só em `encerrado` | — |
| lado | `match.homeTeam`/`awayTeam` (`KnockoutSide`) | `defined` → bandeira vs ícone neutro | — |

## 6. Responsive Behavior
| Breakpoint | Layout | Notas |
|---|---|---|
| 360–430 | cards full-width empilhados; bandeira `w-8 h-6`; nome `truncate`; placar `text-2xl` | sem scroll-x da página |
| ≥640 (sm) | mesma estrutura; espaçamento maior; nome completo | — |
| ≥768/1024 | seções centralizadas no max-w-4xl; gap maior entre fases | sem layout de árvore horizontal (vertical mobile-first, decisão PRD) |

Sem chaveamento em árvore horizontal — lista vertical por fase (decisão do PRD §Layout "Estrutura empilhada").

## 7. Accessibility
- [x] Cada fase: `<section aria-labelledby>` com `<h2>` do rótulo da fase (hierarquia h1 página → h2 fase).
- [x] Card encerrado: container com `aria-label="{home} {homeScore} x {awayScore} {away}"` (resultado completo legível); placar visual + aria.
- [x] Card aguardando: rótulo "Aguardando definição" textual visível (não só cor/ícone) → `color-not-only`.
- [x] Lado placeholder: ícone `aria-hidden`, nome textual carrega o significado.
- [x] Bandeira: `<img alt={name}>` ou fallback `<span aria-label={name}>` (espelha TeamFlag).
- [x] Contraste: `text-foreground`/`text-muted-foreground` sobre `bg-card` — AA pelo tema.
- [x] `tabular-nums` no placar.
- [x] Estados loading/error/empty herdam `role="status"` dos componentes compartilhados.
- [x] `motion-reduce` herdado do skeleton compartilhado.

## 8. Animation
| Trigger | Animation | Duration | Easing |
|---|---|---|---|
| loading | skeleton pulse (variant bracket) | — | `animate-pulse motion-reduce:animate-none` |
| (cards) | nenhuma (estáticos) | — | — |

## 9. Edge Cases
| Case | Condition | Behavior |
|---|---|---|
| Loading | `isPending` | `WorldcupSkeleton variant="bracket"` |
| Erro | `isError` | `WorldcupErrorState onRetry={refetch}` |
| Vazio total | todos 6 buckets `[]` | `WorldcupEmptyState` ("Nenhuma informação disponível.") |
| Fase vazia | bucket específico `[]` | seção omitida (não renderiza título sozinho) |
| 100% placeholder | pré-torneio (todos `aguardando`) | todos cards "Aguardando definição"; nomes = rótulos pt-BR; sem placar |
| Nome longo 360px | "Vencedor Jogo 104" / "Bósnia e Herzegovina" | `truncate` por lado |
| Placar | só `encerrado` | demais estados sem números |
| 32 jogos no R32 | lista longa | aceito — lista vertical simples (sem colapsar nesta task) |

## 10. Tech-Specific Notes (Next.js App Router — patterns/nextjs)
- `eliminatorias/page.tsx` = Server Component: `<h1 className="sr-only">Eliminatórias</h1>` + `<BracketView />`.
- `BracketView`/`PhaseSection`/`KnockoutMatchCard` = `"use client"` (BracketView consome hook; cards podem ser server mas ficam no mesmo módulo client — manter `"use client"` no arquivo do card por simplicidade, sem custo).
- Bandeira: `<img>` nativo `loading="lazy" decoding="async"` (padrão do projeto; aceita warning `@next/next/no-img-element` como em MatchCard/GroupStandingsTable).
- Ícone placeholder: lucide `HelpCircle` (`text-muted-foreground`, `aria-hidden`).
- Tokens-only: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`. Placar `font-bold text-foreground`. Separador "x" `text-muted-foreground`.
- `PHASES` const com `{ key: keyof BracketResponse, label }` na ordem oficial.

## 11. Files to Create/Modify
```
src/features/worldcup/components/
├── BracketView.tsx                      (criar — "use client")
├── PhaseSection.tsx                     (criar)
├── KnockoutMatchCard.tsx                (criar)
├── index.ts                             (ajustar barrel)
└── __tests__/
    ├── BracketView.test.tsx
    ├── PhaseSection.test.tsx
    └── KnockoutMatchCard.test.tsx
src/app/(app)/matches/eliminatorias/page.tsx   (substituir placeholder)
```

## 12. Acceptance Criteria (UI)
- [ ] 360/390/430/768/1024 sem scroll horizontal da página; cards legíveis.
- [ ] 6 fases na ordem oficial; seções vazias omitidas.
- [ ] 3 estados de card corretos; placar só em encerrado; "Aguardando definição" textual.
- [ ] Lado placeholder com ícone neutro + nome textual (color-not-only).
- [ ] `<section>`/`<h2>` por fase; card encerrado com aria-label de resultado.
- [ ] 3 estados de ciclo de vida reusam componentes da TASK-07.
- [ ] Tokens-only; bandeira com fallback de iniciais.
- [ ] Sem regressão worldcup/matches.
