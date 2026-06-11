# UI-SPEC — TASK-07 (Tela Grupos)

> Fonte: `ai/spec/grupos-eliminatorias-task-07.md` · Layout: `docs/prd-03-1/prd-3-2.png` (PRD03-04/05)
> Design intelligence: ui-ux-pro-max (data table density, touch-target, color-not-only, tabular-nums, horizontal-chip-scroll) — decisões **self-contained**; `/implement` e `/ui-review` consomem este artefato sem re-invocar a skill.

## 1. Identity
- Name: `GroupsView` (+ `GroupSelector`, `GroupStandingsTable`, `QualificationBadge`, `StandingsLegend`, estados compartilhados)
- Type: Screen (aba Grupos)
- Tech: Next.js 15 App Router (React 19), Tailwind v4, shadcn `Button`/`Badge`, lucide, TanStack Query (via `useGroups`)
- Complexity: Full (estado + tabela densa + responsivo + estados de erro/vazio/loading)

## 2. Visual Structure (ASCII)

```
Área Jogos (dentro do max-w-4xl do AppShell, abaixo das CompetitionTabs)
┌──────────────────────────────────────────────┐
│ [Grupo A][Grupo B][Grupo C]… →  (chips scroll) │  ← GroupSelector
├──────────────────────────────────────────────┤
│  #  Seleção        J V E D GP GC  SG  PTS      │  ← header tabela
│ ▎1  🇧🇷 Brasil      3 3 0 0  7  1  +6   9      │  ← ▎ barra verde = Classificado
│ ▎2  🇫🇷 França      3 2 0 1  5  3  +2   6      │
│ ▍3  🇯🇵 Japão       3 1 0 2  3  5  -2   3      │  ← ▍ barra âmbar/secondary = Possível
│ ▏4  🇨🇦 Canadá      3 0 0 3  1  7  -6   0      │  ← ▏ barra cinza = Eliminado
├──────────────────────────────────────────────┤
│ J Jogos · V Vitórias · E Empates · D Derrotas  │  ← StandingsLegend
│ GP Gols Pró · GC Gols Contra · SG Saldo · PTS  │
│ ▎Classificado ▍Possível classificado ▏Elimin.  │
└──────────────────────────────────────────────┘
```

Mobile 360px (tabela cabe; fonte compacta, sem badge textual por linha):
```
┌────────────────────────────────────┐
│[Grupo A][Grupo B][Grupo C]…  →      │
│ # Sel.        J V E D GP GC SG PTS  │
│▎1 🇧🇷 Brasil   3 3 0 0  7  1 +6  9   │
└────────────────────────────────────┘
   barra de cor à esquerda do nº = situação
```

## 3. Component Breakdown
| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `GroupsView` | client | — | loading/error/empty/ok | `useGroups()` + `useState("A")`; decide estado (spec §6.2) |
| `GroupSelector` | client | `groups,value,onChange,className?` | chip ativo/inativo, focus | `<button>`, scroll-x, `aria-pressed` |
| `GroupStandingsTable` | client | `table,className?` | — (presentacional) | `<table>` semântica; 10 col dado; barra de cor por linha |
| `QualificationBadge` | client | `qualification,className?` | — | rótulo+variante; `null` p/ indefinido |
| `StandingsLegend` | client | `className?` | — | abreviações + cores |
| `WorldcupSkeleton` | client | `variant?,className?` | — | `variant="table"` aqui |
| `WorldcupEmptyState` | client | `message?,className?` | — | "Nenhuma informação disponível." |
| `WorldcupErrorState` | client | `onRetry,message?,className?` | — | "Erro ao carregar informações." + "Tentar novamente" |

## 4. Interaction States
| Element | Default | Hover | Active/Selected | Focus | Pressed |
|---|---|---|---|---|---|
| Chip grupo inativo | `bg-muted text-muted-foreground` | `hover:bg-muted/70 hover:text-foreground` | — | `focus-visible:ring-2 ring-ring ring-offset-2` | `active:scale-[0.98] motion-reduce:transform-none` |
| Chip grupo ativo | `bg-primary text-primary-foreground font-medium shadow-sm`, `aria-pressed` | mantém | idem | ring idem | sem scale |
| Linha tabela | barra de cor à esquerda (`border-l-4` token); `hover:bg-muted/40` | realce sutil | — | — | — |
| Botão "Tentar novamente" | `variant="outline" size="sm"`, `min-h-[44px]` | shadcn outline hover | — | ring shadcn | — |

Transições: `transition-colors duration-150`. Sem indicador deslizante custom no seletor (chips simples).

## 5. Data Binding
| Field | Source | Transform | Update Trigger |
|---|---|---|---|
| `groups` (ids) | `useGroups().data.groups` | `.map(g => g.groupId)` | query settle / refetch |
| `selected` | `useState` | default `"A"` | clique no chip |
| tabela exibida | `data.groups.find(g => g.groupId === selected)` | slice | troca de grupo / refetch |
| `hasLiveGroupMatch` | `useGroups` interno | dispara refetch 60s (TASK-05) | — |
| estado | `isPending`/`isError`/`groups.length` | precedência §6.2 | query lifecycle |

## 6. Responsive Behavior
| Breakpoint | Layout | Notas |
|---|---|---|
| 360–430 (mobile) | tabela 10 colunas, `text-xs`, padding compacto `px-1.5`; nome `truncate`; barra cor `border-l-4`; chips scroll-x | sem scroll-x da página; tabela cabe em 360 (números 1 dígito na maioria; `tabular-nums`). Se estourar, permitir scroll-x **só na tabela** via wrapper `overflow-x-auto`, nunca na página |
| ≥640 (sm) | `text-sm`, padding `px-2`; nome completo | folga |
| ≥768 (tablet) / ≥1024 (desktop) | tabela centralizada no max-w-4xl; espaçamento maior | — |

Wrapper da tabela: `<div className="w-full overflow-x-auto">` (defensivo; barra de cor e `#`/`Seleção` podem ser sticky-left se houver scroll — opcional, não obrigatório).

## 7. Accessibility
- [x] `<table>` semântica: `<thead>` com `<th scope="col">`; `<tbody>` linhas `<tr>`; nome do grupo via `<caption className="sr-only">Classificação do Grupo X</caption>`.
- [x] Abreviações de coluna: `<th>` com `<abbr title="Vitórias">V</abbr>` (ou `aria-label`) p/ leitores de tela.
- [x] Qualificação por linha: barra de cor **+** `aria-label`/texto sr-only na célula `#` (ex.: `<span className="sr-only">Classificado</span>`) — `color-not-only` satisfeito; legenda textual reforça.
- [x] Seletor: cada chip é `<button>` navegável por Tab, `aria-pressed={active}`, touch target ≥44px (`h-11` mobile, `sm:h-9`).
- [x] Foco visível: `focus-visible:ring-2 ring-ring ring-offset-2`.
- [x] Contraste: `primary`/`primary-foreground`, `muted-foreground` sobre fundo — AA garantido pelo tema; números `text-foreground`.
- [x] `motion-reduce:transform-none` no scale dos chips; skeleton `motion-reduce:animate-none`.
- [x] Estados loading/error/empty com `role="status"`.
- [x] `tabular-nums` nas colunas numéricas (evita layout shift e alinha).

## 8. Animation
| Trigger | Animation | Duration | Easing |
|---|---|---|---|
| chip hover/press | bg/text fade + scale 0.98 (press) | 150ms | ease-out; `motion-reduce` desliga scale |
| troca de grupo | troca de conteúdo da tabela (sem animação custom) | — | — |
| loading | skeleton pulse | — | `animate-pulse motion-reduce:animate-none` |

## 9. Edge Cases
| Case | Condition | Behavior |
|---|---|---|
| Loading | `isPending` | `WorldcupSkeleton variant="table"` (header + ~4 linhas pulsando) |
| Erro | `isError` | `WorldcupErrorState onRetry={refetch}` |
| Vazio | `groups.length === 0` | `WorldcupEmptyState` ("Nenhuma informação disponível.") |
| Slice ausente | grupo selecionado não existe | `WorldcupEmptyState` (defensivo) |
| Standings zerados | dados 2026 pré-torneio (J=0, tudo `indefinido`) | tabela renderiza zeros; barras neutras; sem badge "Classificado" |
| `flagUrl` ausente | seleção sem bandeira | fallback iniciais (espelha `TeamFlag` do MatchCard) |
| Nome longo 360px | "Bósnia e Herzegovina" | `truncate` na célula Seleção |
| `SG` zero | saldo 0 | exibir `0` (sem `+`); positivos `+N`; negativos `-N` |

## 10. Tech-Specific Notes (Next.js App Router — patterns/nextjs)
- `grupos/page.tsx` = Server Component (sem `"use client"`): `<h1 className="sr-only">Grupos</h1>` + `<GroupsView />`. `AuthGuard`/`AppShell`/`CompetitionTabs` já vêm dos layouts pai.
- `GroupsView` e todos os componentes interativos/que consomem hook = `"use client"`.
- Bandeira: `<img>` nativo com `loading="lazy" decoding="async"` (espelha `TeamFlag`; não usar `next/image` — padrão do projeto p/ flags externas). Tamanho compacto na tabela: `w-7 h-5 rounded-sm object-contain`.
- Tokens shadcn: `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`, `bg-card`. Barra de qualificação: `border-l-4` com `border-primary` (classificado) / `border-secondary` ou `border-amber-500`? → **usar tokens**: classificado `border-primary`; possível `border-muted-foreground/60` não distingue → usar `border-secondary` se o tema tiver cor distinta; senão `bg-primary/15`, `bg-amber-500/15`… **Decisão travada (tokens-only):** classificado = `border-l-4 border-primary`; possível = `border-l-4 border-primary/40`; eliminado = `border-l-4 border-muted-foreground/30`; indefinido = `border-l-4 border-transparent`. Distinção reforçada por sr-only + legenda (não depende só de cor). Sem hex novo.

## 11. Files to Create/Modify
```
src/features/worldcup/components/
├── GroupsView.tsx                       (criar — "use client")
├── GroupSelector.tsx                    (criar)
├── GroupStandingsTable.tsx              (criar)
├── QualificationBadge.tsx               (criar)
├── StandingsLegend.tsx                  (criar)
├── WorldcupSkeleton.tsx                 (criar — compartilhado)
├── WorldcupEmptyState.tsx               (criar — compartilhado)
├── WorldcupErrorState.tsx               (criar — compartilhado)
├── index.ts                             (ajustar barrel)
└── __tests__/
    ├── GroupsView.test.tsx
    ├── GroupSelector.test.tsx
    ├── GroupStandingsTable.test.tsx
    ├── QualificationBadge.test.tsx
    ├── StandingsLegend.test.tsx
    ├── WorldcupEmptyState.test.tsx
    └── WorldcupErrorState.test.tsx
src/app/(app)/matches/grupos/page.tsx    (substituir placeholder)
```

## 12. Acceptance Criteria (UI)
- [ ] 360/390/430/768/1024 sem scroll horizontal **da página**; tabela legível (scroll interno só se inevitável).
- [ ] Seletor troca o grupo exibido; default Grupo A; ativo com `aria-pressed`.
- [ ] 11 rótulos do PRD representados (coluna `P` redundante omitida, documentado); `SG` com sinal; `PTS` em destaque.
- [ ] Qualificação por barra de cor + sr-only + legenda (`color-not-only`).
- [ ] 3 estados com strings exatas do PRD; retry funcional.
- [ ] Touch target ≥44px nos chips; foco visível; tabela com `<th scope>` e `<abbr>`.
- [ ] Tokens-only (sem hex); `motion-reduce` respeitado.
- [ ] Sem regressão matches.
