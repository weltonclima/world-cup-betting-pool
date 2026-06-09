# UI-SPEC — Logo no Header (pós-login)

> Complexity: **Minimal**. Stack: **Next.js 15** (App Router) + React 19 + Tailwind v4.
> ui-ux-pro-max não carregado — swap de logo em header já desenhado, sem nova decisão de estilo/palette/font. Decisões bakeadas abaixo.

## Section 1: Component Identity
- Name: `Header`
- Type: Layout (barra de topo fixa)
- Tech: Next.js 15 / React 19 / Tailwind v4 / `next/image` / `next/link`
- Complexity: Minimal

## Section 2: Visual Structure (ASCII)

```
Header (h-14, fixed top, border-b, backdrop-blur)
┌──────────────────────────────────────────────────────────┐
│  [🏆 LOGO →/home]                      [🔔 Sino] [🛡 Admin] │
└──────────────────────────────────────────────────────────┘
   ^ esquerda: Link>Image                ^ direita: ações (inalterado)
```

- Logo substitui o `<span>` textual.
- Altura logo: `h-8` (32px) dentro do header `h-14` (56px) → ~12px de folga vertical (centralizado).
- Largura: `w-auto` (aspect 560/373 ≈ 1.5 → ~48px de largura visual).

## Section 3: Component Breakdown
| Component | Type | Props | States | Notes |
|-----------|------|-------|--------|-------|
| `Link` (logo) | next/link | `href="/home"`, `aria-label` | default, hover, focus | Envolve o Image |
| `Image` (logo) | next/image | `src`, `width=560`, `height=373`, `priority`, `alt` | estático | `h-8 w-auto object-contain` |

## Section 4: Interaction States
| Element | Default | Hover | Focus | Notes |
|---------|---------|-------|-------|-------|
| Logo link | logo nítido | `opacity-90` (transição sutil) | `rounded-md ring-2 ring-primary` (focus-visible) | sem active/disabled/loading |

## Section 7: Accessibility Requirements
- [x] Link com nome acessível: `aria-label="Bolão dos Parças — página inicial"`
- [x] `alt="Bolão dos Parças"` no Image (imagem informativa = nome do produto)
- [x] `focus-visible` ring no link (navegação por teclado)
- [x] Touch target: `h-8` + padding garante ≥ área clicável confortável; logo fica em link de altura do header
- [x] Contraste: logo PNG sobre `bg-background/95` — asset já validado nas telas de auth

## Section 10: Tech-Specific Implementation Notes (Next.js)
- `next/image` com `width`/`height` intrínsecos (560×373) → evita CLS. Dimensão visual via `className`.
- `priority` — header always-visible, evita LCP penalty / lazy flash.
- `next/link` (não `<a>` cru) para navegação client-side.
- `cn()` de `@/lib/utils` para compor classes.
- Tailwind only, sem inline style.
- Componente permanece `"use client"` (já é — usa `usePathname`/`useAuth`).

## Section 11: Files to Create/Modify
```
src/components/layout/
├── Header.tsx                    (modify — span → Link>Image)
└── __tests__/Header.test.tsx     (modify — mock next/image + asserção logo)
```

## Section 12: Acceptance Criteria (UI)
- [ ] Logo renderiza no header em vez do texto.
- [ ] Logo clicável → `/home`.
- [ ] Aspect-ratio preservado (sem distorção/letterbox).
- [ ] Layout logo-esquerda / ações-direita mantido em mobile + desktop.
- [ ] `focus-visible` visível ao tabular no logo.
- [ ] Testes existentes (admin role-gated) seguem verdes.

## UX validation
- [x] Hierarquia: logo (identidade) à esquerda, ações à direita — convenção estabelecida.
- [x] Affordance: logo clicável com hover/focus.
- [x] Consistência: mesmo asset das telas de auth (`logo-login.png`), mesmo padrão `next/image` do `AuthLogo`.
- [x] Carga cognitiva: zero — substituição direta.
