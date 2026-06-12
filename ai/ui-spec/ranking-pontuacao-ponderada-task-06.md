# UI-SPEC

## 1. Screen/Component Identity
- Name: `RankingPodium` (interno em `GeneralRanking.tsx`)
- Type: Component (top-3 do ranking geral)
- Tech: Next.js 15.5 (App Router) + React 19 + Tailwind v4 + `@base-ui/react` (Avatar)
- Complexity: Standard

## 2. Visual Structure (ASCII)

Mobile (≥320px) — 3-up sem scroll horizontal, ordem visual 2-1-3:

```
RankingPodium
┌──────────────────────────────────────────────┐
│   ┌───────┐   ┌─────────┐   ┌───────┐        │
│   │  2º   │   │ 👑  1º  │   │  3º   │        │   ← badge posição (medalha) topo
│   │ ◯foto │   │ ◯ foto  │   │ ◯foto │        │   ← avatar (foto ou iniciais)
│   │ Maria │   │  João   │   │ Ana   │        │   ← nome (truncate)
│   │ 85 pts│   │ 120 pts │   │ 70pts │        │   ← pontos ponderados (primário)
│   │ 60%   │   │  80%    │   │ 50%   │        │   ← aproveitamento (secundário)
│   └───────┘   └─────────┘   └───────┘        │
│    order-2      order-1      order-3          │
└──────────────────────────────────────────────┘
```

- Card central (1º) **elevado**: maior, fundo `primary`, avatar maior, coroa.
- Cards laterais (2º/3º): fundo `card`, borda `border`, alinhados pela base
  (`items-end`) para dar o efeito de pódio.
- DOM em ordem de ranking (1,2,3); ordem visual via `order-*` (2-1-3).

## 3. Component Breakdown

| Component | Type | Props | States | Notes |
|-----------|------|-------|--------|-------|
| `RankingPodium` | container | `{ top3: RankingEntry[]; currentUid?: string }` | — | flex, gap pequeno, `items-end` |
| Card (Link) | item | `entry`, `isFirst`, `isCurrent` | default/hover/active/focus | `<Link>` p/ perfil; alvo de toque grande |
| PositionBadge | visual | `position` | — | medalha colorida + número "Nº" (a11y: cor+texto) |
| `Avatar`/`AvatarImage`/`AvatarFallback` | base-ui | `src=entry.avatarUrl`, `alt` | img / fallback iniciais | fallback nativo quando `src` vazio/quebrado |
| Nome | text | `entry.nickname` | — | `truncate`, `min-w-0` |
| Pontos | text | `entry.points` | — | primário, `tabular-nums`, "pts" |
| Aproveitamento | text | `accuracyLabel(entry)` | — | secundário, `text-muted-foreground`, "—" se ausente |
| "Você" badge | visual | `isCurrent` | — | `Badge` existente, só p/ usuário atual |

## 4. Interaction States

| Element | Default | Hover | Active | Focus | Disabled | Loading | Error |
|---------|---------|-------|--------|-------|----------|---------|-------|
| Card 1º | `bg-primary text-primary-foreground shadow-sm` | `hover:bg-primary/90` | `motion-safe:active:scale-[0.98]` | `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` | n/a | n/a | img falha → fallback iniciais |
| Card 2º/3º | `bg-card text-card-foreground border border-border` | `hover:bg-accent hover:text-accent-foreground` | `motion-safe:active:scale-[0.98]` | idem | n/a | n/a | idem |
| AvatarImage | foto | — | — | — | — | — | `onError` → `AvatarFallback` (nativo base-ui) |

- Transições: `transition-colors transition-transform duration-200 ease-out`.
- `active:scale` só sob `motion-safe` (respeita `prefers-reduced-motion`).
- Sem layout shift: escala via `transform`, não muda dimensões do fluxo.

## 5. Data Binding

| Field | Source | Transform | Update Trigger |
|-------|--------|-----------|----------------|
| foto | `entry.avatarUrl` | direto p/ `AvatarImage src` (pode ser `undefined`) | render |
| iniciais | `entry.nickname`/`name` | `initials(entry)` (helper existente) | render (fallback) |
| posição | `entry.position` | `${position}º` + medalha | render |
| pontos | `entry.points` | número + " pts" | render |
| aproveitamento | `entry.accuracy` | `accuracyLabel(entry)` → "—" se indefinido | render |
| é-usuário | `currentUid === entry.uid` | bool → badge "Você" | render |

Sem estado local, sem efeito, sem fetch. Componente puro de apresentação.

## 6. Responsive Behavior

| Breakpoint | Layout Change | Hidden/Shown |
|------------|---------------|--------------|
| base (≥320px) | 3 cards lado a lado, `flex-1 min-w-0`, gap `gap-2`, padding card `p-2.5`, avatar 1º `h-14 w-14` / laterais `h-12 w-12`, nome `text-xs` `truncate` | tudo visível, sem scroll-x |
| sm (≥640px) | gap `gap-3`, padding `p-3`/`p-4`, nome `text-sm`, pontos `text-base` | — |
| md+ (≥768px) | cresce com `max-w` do container pai (sem mudança estrutural) | — |

- Mobile-first; **nunca** força `overflow-x` (sem larguras fixas em px).
- `min-w-0` + `truncate` impedem nome longo de empurrar o layout.

## 7. Accessibility Requirements

- [ ] `aria-label` por card: `"{position}º lugar, {nickname}, {points} pontos[, você]"`.
- [ ] Medalha/coroa = decorativas → `aria-hidden`; posição também legível por **texto**
      ("2º") e não só por cor (satisfaz `color-not-only`).
- [ ] `AvatarImage alt` = nickname (ou `""` + aria-label no card, evitar redundância).
- [ ] Foco visível: `focus-visible:ring-2` em cada card (Link). Tab order = DOM (1,2,3).
- [ ] Contraste ≥ 4.5:1: `primary-foreground` sobre `primary`; texto secundário em
      `muted-foreground` validado sobre `card`/`primary`. Badge de medalha: texto
      escuro sobre fundo claro da medalha.
- [ ] Alvo de toque ≥ 44px: card inteiro é o link; garantir `min-h` adequado.

## 8. Animation Spec

| Trigger | Animation | Duration | Easing | Tech-specific |
|---------|-----------|----------|--------|---------------|
| hover card | cor de fundo | 200ms | ease-out | `transition-colors` |
| press card | scale 0.98 | 200ms | ease-out | `motion-safe:active:scale-[0.98]` (GPU transform) |
| reduced-motion | sem scale | — | — | `motion-safe:` prefixo |

Sem animação de entrada/stagger (fora de escopo; pódio é estático no load).

## 9. Edge Cases

| Case | Condition | Behavior |
|------|-----------|----------|
| Sem foto | `avatarUrl` ausente/omitido pelo orçamento (TASK-05) | `AvatarFallback` iniciais; layout intacto |
| Foto quebrada | `src` inválido | base-ui cai no fallback (`onError` nativo) |
| Nome longo | nickname grande | `truncate` + `min-w-0`; sem overflow |
| Aproveitamento ausente | `accuracy` undefined | mostra "—" |
| Menos de 3 entries | `top3.length < 3` | renderiza só os existentes (sem placeholder vazio); container não quebra |
| Empate de posição | positions repetidas | usa `entry.position` como vem (fonte = recalc); não recalcula |

## 10. Tech-Specific Implementation Notes (Next.js — house rules)
- `"use client"` mantido (já é client component).
- Reusar tokens de tema Tailwind v4 (`bg-primary`, `bg-card`, `border-border`,
  `text-muted-foreground`, `bg-accent`, `ring-ring`) — **não** hardcodar hex fora do tema.
- Medalhas: cores semânticas de posição via utilitários Tailwind neutros porque
  ouro/prata/bronze não existem no tema → usar classes diretas
  `bg-amber-400 text-amber-950` (1º), `bg-zinc-300 text-zinc-800` (2º),
  `bg-orange-300 text-orange-900` (3º). Documentado como exceção consciente (medalha
  é convenção universal de pódio; número textual garante a11y independente de cor).
- Avatar via `@base-ui/react` (`Avatar`, `AvatarImage`, `AvatarFallback`) já exportado
  em `src/components/ui/avatar.tsx` — **não** editar o componente base.
- `Badge` "Você" via `src/components/ui/badge.tsx` existente.
- Ícone `Crown` (lucide) só no 1º, `aria-hidden`.
- Sem nova dependência.

## 11. Files to Create/Modify
```
src/features/rankings/components/
├── GeneralRanking.tsx                      (MOD: redesenha RankingPodium)
└── __tests__/
    └── GeneralRanking.test.tsx             (CREATE ou MOD: render do pódio)
```
- Sem editar `components/ui/avatar.tsx` nem `badge.tsx` (consumo apenas).

## 12. Acceptance Criteria (UI)
- [ ] Foto real renderiza quando `avatarUrl` presente; iniciais como fallback.
- [ ] Posição (1º/2º/3º) visível **e** acessível em cada card; 2º e 3º distinguíveis.
- [ ] Sem scroll horizontal em ≥320px; 3 cards cabem.
- [ ] Pontos (ponderados, "pts") + aproveitamento exibidos; ordem visual 2-1-3.
- [ ] Estados hover/active/focus implementados; foco visível.
- [ ] `aria-label` por card com posição+nome+pontos; medalha `aria-hidden`.
- [ ] Contraste ≥4.5:1; alvo de toque ≥44px.
- [ ] `vitest run` verde; sem nova dependência.
