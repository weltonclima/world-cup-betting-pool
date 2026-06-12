# UI-SPEC — TASK-06 (CompetitionTabs)

> Fonte: `ai/spec/grupos-eliminatorias-task-06.md` · Layout: `docs/prd-03-1/prd-3-2.png`
> Design intelligence: ui-ux-pro-max (segmented control, nav-state-active, touch-target, deep-linking) — decisões abaixo são **self-contained**; `/implement` e `/ui-review` consomem este artefato sem re-invocar a skill.

## 1. Identity
- Name: `CompetitionTabs`
- Type: Component (client navigation / segmented control)
- Tech: Next.js 15 App Router (React 19), Tailwind v4, shadcn Button, `next/link`, `usePathname`, lucide
- Complexity: Standard

## 2. Visual Structure (ASCII)

```
Área Jogos (dentro de max-w-4xl do AppShell)
┌──────────────────────────────────────────────┐
│  [ Partidas ] [  Grupos  ] [ Eliminatórias ]  │  ← segmented control (pill container)
└──────────────────────────────────────────────┘
   ↑ ativo = pill preenchido verde primário
   conteúdo da página abaixo (MatchList / Grupos / Eliminatórias)
```

Mobile 360px (3 segmentos iguais, sem scroll):
```
┌────────────────────────────────────┐
│ Partidas │  Grupos  │ Eliminatórias │
└────────────────────────────────────┘
   full-width, flex-1 cada, text-xs
```

## 3. Component Breakdown
| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `CompetitionTabs` | client comp | `className?` | hidden (em `/matches/[id]`) / visível | lê `usePathname`; retorna `null` no detalhe |
| `TabLink` (interno) | `next/link` estilizado | `href`, `label`, `active` | default/active/hover/focus/pressed | render como `<Link>` com classes de Button (`buttonVariants`) ou `<Button asChild>` |

Container: `<nav aria-label="Seções de Jogos">` envolvendo um `role="tablist"`-like flex. **Decisão a11y:** usar `<nav>` semântico com `aria-label` + cada link com `aria-current="page"` quando ativo (NÃO usar `role="tab"` real, pois não são painéis ARIA acoplados — são navegação por rota). Isso evita semântica de tab quebrada com rotas.

## 4. Interaction States
| Element | Default | Hover | Active (rota atual) | Focus | Pressed |
|---|---|---|---|---|---|
| TabLink inativo | texto `text-muted-foreground`, fundo transparente | `hover:bg-muted/60`, `hover:text-foreground` | — | `focus-visible:ring-2 ring-ring ring-offset-2` | `active:scale-[0.98]` |
| TabLink ativo | fundo `bg-primary`, texto `text-primary-foreground`, `shadow-sm`, `font-medium`, `aria-current="page"` | mantém (cursor default; é a página atual) | idem default-ativo | ring idem | sem scale (já é a atual) |
| Container | `bg-muted/50 rounded-full p-1` (trilho do segmented) | — | — | — | — |

Transição: `transition-colors duration-150` (token §7). `transform` no pressed via `active:scale-[0.98]` (só inativos), respeita `motion-reduce:transform-none`.

## 5. Data Binding
| Field | Source | Transform | Update Trigger |
|---|---|---|---|
| `pathname` | `usePathname()` | match → aba ativa / null | navegação (Next router) |
| ativo Partidas | `pathname === "/matches"` | bool | — |
| ativo Grupos | `pathname.startsWith("/matches/grupos")` | bool | — |
| ativo Eliminatórias | `pathname.startsWith("/matches/eliminatorias")` | bool | — |
| oculto | pathname casa `/matches/<seg>` com seg ∉ {grupos, eliminatorias} e pathname ≠ `/matches` | retorna `null` | — |

Regra de ocultação precisa (detalhe `/matches/m73`, `/matches/m73/predict`): visível **somente** quando `pathname === "/matches"` OU `startsWith("/matches/grupos")` OU `startsWith("/matches/eliminatorias")`. Qualquer outro → `null`.

## 6. Responsive Behavior
| Breakpoint | Layout | Notas |
|---|---|---|
| 360–430 (mobile) | 3 segmentos `flex-1` iguais, `text-xs`, `h-9`, labels completas (cabe "Eliminatórias" a 14px? usar `text-xs`=12px → cabe ~ folgado) | sem scroll horizontal |
| ≥640 (sm+) | mesma estrutura, `text-sm`, largura intrínseca centralizada (não full-width) ou mantém full dentro do max-w-4xl | container `w-full sm:w-auto sm:inline-flex` |
| Desktop | idem sm; segmented control compacto à esquerda | — |

## 7. Accessibility
- [x] `<nav aria-label="Seções de Jogos">`; links navegáveis por Tab na ordem visual.
- [x] `aria-current="page"` no link ativo (anuncia "página atual" no SR).
- [x] Foco visível: `focus-visible:ring-2 ring-ring ring-offset-2` (token shadcn).
- [x] Contraste: `primary`/`primary-foreground` (tema verde) ≥ 4.5:1 — já garantido pelo tema; inativo `muted-foreground` sobre `muted/50` validar ≥ 4.5:1 (se borderline, usar `text-foreground/70`).
- [x] Touch target ≥ 44px: `h-9` (36px) é abaixo no mobile → usar `h-11` (44px) no mobile, `sm:h-9`. **Obrigatório**: altura ≥44px no mobile.
- [x] `color-not-only`: ativo distinguido por fundo+peso+aria, não só cor.
- [x] `motion-reduce:transform-none` no scale.

## 8. Animation
| Trigger | Animation | Duration | Easing |
|---|---|---|---|
| hover (inativo) | bg/text fade | 150ms | ease-out (`transition-colors`) |
| press (inativo) | scale 1→0.98 | 150ms | default; `motion-reduce` desliga |
| troca de aba | navegação de rota (sem animação custom de indicador nesta task) | — | — |

(Indicador deslizante animado fica fora de escopo — pill por link é suficiente e mais simples/robusto.)

## 9. Edge Cases
| Case | Condition | Behavior |
|---|---|---|
| Rota de detalhe | `/matches/m73`, `/matches/m73/predict` | `CompetitionTabs` → `null` (sem abas) |
| Rota desconhecida sob /matches | improvável | tratada pela regra de visibilidade → `null` (fail-safe) |
| Label longa em 360px | "Eliminatórias" | `text-xs` + `truncate`/`whitespace-nowrap`; cabe sem truncar |
| SSR/primeiro paint | `usePathname` client | componente é `"use client"`; layout server passa children |

## 10. Tech-Specific Notes (Next.js App Router — patterns/nextjs)
- `layout.tsx` em `src/app/(app)/matches/` é **Server Component** (sem `"use client"`); renderiza `<CompetitionTabs />` + `{children}`. Layout compartilhado cobre `/matches`, `/matches/grupos`, `/matches/eliminatorias` e `/matches/[id]` (aninhados).
- `CompetitionTabs` é `"use client"` (usa `usePathname`).
- Navegação: `next/link` com `prefetch` default (deep-link + back/forward nativos preservam estado — `state-preservation`).
- Precedência de rota: segmento estático (`grupos`, `eliminatorias`) > dinâmico (`[id]`). Não criar guard no `[id]/page.tsx`.
- Páginas placeholder (`grupos/page.tsx`, `eliminatorias/page.tsx`): Server Components mínimos com `<h1 className="sr-only">` + texto "em breve" (substituídas em TASK-07/08).
- Cor: tokens shadcn (`bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `ring-ring`) — zero hex hardcoded.

## 11. Files to Create/Modify
```
src/app/(app)/matches/
├── layout.tsx                         (criar — Server Component, tabs + children)
├── grupos/page.tsx                    (criar — placeholder)
└── eliminatorias/page.tsx             (criar — placeholder)
src/features/worldcup/components/
├── CompetitionTabs.tsx                (criar — "use client")
└── __tests__/CompetitionTabs.test.tsx (criar)
src/features/worldcup/components/index.ts (criar/ajustar barrel)
```

## 12. Acceptance Criteria (UI)
- [ ] 360/390/430/768/1024 renderizam sem scroll horizontal; abas full-width no mobile, compactas no desktop.
- [ ] Ativo correto por rota (Partidas/Grupos/Eliminatórias) com `aria-current="page"`.
- [ ] Abas ausentes em `/matches/[id]` e `/matches/[id]/predict`.
- [ ] Touch target ≥44px no mobile.
- [ ] Foco visível por teclado; ordem de tab = ordem visual; navegação por Enter funciona.
- [ ] Contraste AA nos dois temas (claro/escuro).
- [ ] `motion-reduce` desliga o scale.
- [ ] Sem regressão MatchList/MatchDetail.
