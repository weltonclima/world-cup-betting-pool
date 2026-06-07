# SCREEN SPEC – Seleção de Grupo
## Task: TASK-08 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-08.md` · Design contract: `design-system/MASTER.md` + tema `.palpites-theme` (MASTER §2.4-palpites; já em `globals.css` desde TASK-07).
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis neste ambiente (sem Python). Direção derivada de `design-system/MASTER.md` + wireframe PNG.

## Visual Analysis (from image)
- Source: `docs/prd-03-1/PRD03-02-Selecao-Grupo.png`
- Layout: header verde escuro (app shell) "Fase de Grupos"; abaixo, subtítulo de instrução; label "Selecione um grupo"; grid de cards de grupo em 3 colunas (Grupo A … Grupo L), um card destacado em verde (estado selecionado); caixa de dica (info tip) no rodapé do conteúdo; BottomNav.
- Components: header tematizado (shell), label de seção, grid de GroupCard (×12), card selecionado verde, caixa de dica.
- Style signals: verde escuro no header (shell), verde médio no realce de card selecionado; cards brancos/neutros arredondados; densidade média; tipografia funcional.
- States visible: grupo não-iniciado (neutro), grupo selecionado (verde). (Progresso por card implícito pela primitiva GroupCard.)
- Assumptions: o realce verde "selecionado" pertence ao fluxo contínuo/wizard (TASK-16) — nesta tela de seleção avulsa nenhum card nasce selecionado. O header verde é o app shell tematizado via `.palpites-theme` (a tela não desenha header próprio).

## 1. User and Business Goals
O usuário escolhe **qual grupo preencher**. Precisa ver, em grade escaneável, os 12 grupos com seu **progresso/status** (não-iniciado / em andamento / concluído ✓) e tocar para abrir a tela de palpite em massa daquele grupo. Meta de UX: decisão rápida sobre "por onde continuar", reforçando o progresso já feito.

## 2. Design System Reference
- Master: `design-system/MASTER.md`.
- Override de área: `.palpites-theme` (já em `globals.css`; remapeia `--primary`/`--ring`/`--sidebar-primary` para o verde AA). Aplicado no container raiz da rota `/predictions/grupos`.
- Sem `design-system/pages/*`.

## 3. User Flow
- **Entrada:** a partir do Hub (TASK-07) — card "Fase de Grupos" ou CTA "Completar Copa" → `/predictions/grupos`. (Também alcançável pela nav após TASK-16.)
- **Happy path:** vê o grid → toca em "Grupo C" → `/predictions/grupos/C` (TASK-09).
- **Saídas:** card de grupo → tela de palpite do grupo; voltar → Hub (nav/back do shell).
- **Edge cases:** loading (skeleton de grid), erro (retry), vazio (jogos de grupo indisponíveis → mensagem, sem CTA de abertura).

```
[Hub] → /predictions/grupos
   ├─ loading → skeleton grid (role=status)
   ├─ error   → mensagem + "Tentar novamente"
   ├─ vazio   → "Os jogos da fase de grupos ainda não estão disponíveis."
   └─ populated → grid 3→4 col de GroupCard (A..L)
        card → /predictions/grupos/{id}
```

## 4. Information Architecture
1. **Título** "Fase de Grupos" (primário, `h1`).
2. **Subtítulo/instrução** "Escolha o grupo para palpitar todos os jogos de uma vez." (secundário).
3. **Label de seção** "Selecione um grupo" (`text-xs` label/uppercase opcional, ou `text-sm font-medium`).
4. **Grid de GroupCard** — 12 cards: nome "Grupo X" (primário) → fração "X / Y" + barra (secundário) → ✓ se concluído (apoio).
5. **Caixa de dica (info tip)** — texto auxiliar ao final ("Você pode preencher os grupos em qualquer ordem.").

## 5. Layout and Components

### Container da rota (`page.tsx`)
- `<div className="palpites-theme mx-auto flex max-w-2xl flex-col gap-4 pb-20 md:pb-4">` — escopo de tema + ritmo + compensação BottomNav + largura legível desktop.

### Cabeçalho da tela
- `<h1 className="text-2xl font-semibold text-foreground">Fase de Grupos</h1>` (Heading 1, único h1).
- `<p className="text-sm text-muted-foreground">Escolha o grupo para palpitar todos os jogos de uma vez.</p>`

### Label de seção
- `<h2 className="text-sm font-medium text-foreground">Selecione um grupo</h2>` (mantém hierarquia h1→h2, sem pulo).

### Grid de grupos (`GroupSelectionGrid`)
- Container `<ul className="grid grid-cols-3 gap-3 md:grid-cols-4">` — itens `<li>` envolvendo cada `GroupCard` (lista semântica de opções).
- `GroupCard` (primitiva TASK-06) por grupo:
  - `name="Grupo {id}"`, `filledCount`, `totalCount` (6), `status`, `href="/predictions/grupos/{id}"`.
  - `selected` não usado nesta tela (default false).
  - A primitiva já garante `min-h-[44px]`, ✓ quando concluído, barra de progresso fina, foco verde no escopo, `aria-label` resumido.

### Caixa de dica (info tip)
- `<div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">` com ícone `Info` (`size={16} text-muted-foreground aria-hidden`) + `<p className="text-xs text-muted-foreground">Você pode preencher os grupos em qualquer ordem.</p>`.
- Sem cor de alerta (informativo neutro). `role` não necessário (conteúdo estático, não live).

### Loading
- `<div role="status" aria-live="polite">` + `<span className="sr-only">Carregando grupos</span>` + grid de 12 blocos skeleton (`h-16 rounded-xl bg-muted animate-pulse motion-reduce:animate-none`) com o mesmo `grid-cols-3 md:grid-cols-4 gap-3`.

### Error
- `<div role="alert" className="flex flex-col items-start gap-3">` + `text-sm text-destructive` "Não foi possível carregar os grupos." + `buttonVariants outline` "Tentar novamente" (`min-h-[44px]`, `onClick={onRetry}`).

### Empty
- `<p className="py-6 text-center text-sm text-muted-foreground">Os jogos da fase de grupos ainda não estão disponíveis.</p>` (sem CTA — não há grupo para abrir).

## 6. Typography and Color Tokens
- Título: `text-2xl font-semibold text-foreground`. Subtítulo: `text-sm text-muted-foreground`. Label de seção: `text-sm font-medium text-foreground`.
- Nome do grupo: `text-sm font-semibold text-foreground` (primitiva). Fração: `text-xs text-muted-foreground`. Dica: `text-xs text-muted-foreground`.
- **Cor:** realce/foco/barra = `--primary` (verde no escopo); ✓ concluído = `text-win`; erro = `text-destructive`. Zero hex; zero `style` inline (a largura geométrica da barra está encapsulada na primitiva ProgressBar usada pelo GroupCard).
- Contraste: verde escopado + neutros do MASTER ≥ AA (light/dark).

## 7. UI States

| Estado | Tratamento |
|---|---|
| **Loading** | skeleton de grid (12 blocos) `role="status" aria-live="polite"`; `animate-pulse motion-reduce:animate-none`. |
| **Empty** | sem partidas de grupo: mensagem "Os jogos da fase de grupos ainda não estão disponíveis." (sem CTA de abertura). |
| **Populated** | grid 3→4 col de GroupCard (A..L) com fração/status por grupo. |
| **Error** | `role="alert"` + mensagem + "Tentar novamente". |
| **Success/Disabled** | n/a — tela de seleção sem mutação; nenhum card desabilitado (todos navegáveis). |

## 8. Accessibility Requirements (Priority 1)
- **Contraste:** texto ≥ 4.5:1, componentes ≥ 3:1 — verde escopado + neutros do MASTER AA (light/dark).
- **Touch targets:** GroupCard `min-h-[44px]`; gap ≥ 8px (`gap-3` = 12px). CTA de retry `min-h-[44px]`.
- **Labels:** GroupCard com `aria-label` resumido ("Grupo C, 3 de 6 jogos, em andamento") — já na primitiva. Ícones decorativos (`Info`, ✓) `aria-hidden="true"`.
- **Estrutura:** `h1` "Fase de Grupos" único; `h2` "Selecione um grupo" (sem pulo de nível). Grid como `<ul>/<li>` (lista de opções) para leitores de tela.
- **Foco:** ordem natural do DOM (A→L); `focus-visible:ring-2 ring-ring ring-offset-2` (primitiva); sem tabIndex positivo.
- **Screen reader:** loading `role="status" aria-live="polite"`; error `role="alert"`.
- **Cor não-exclusiva:** ✓ "concluído" sempre com ícone + texto no aria-label.
- **Reduced motion:** `motion-reduce:transition-none` (primitiva) e `motion-reduce:animate-none` (skeleton).

## 9. Animation and Motion (Priority 7)
- Hover de card: `transition-colors duration-150` (borda → `border-primary/50`) — já na primitiva.
- Skeleton: `animate-pulse` com fallback `motion-reduce:animate-none`.
- Sem animação de layout; apenas colors (hover) e opacity (skeleton).

## 10. Navigation Patterns (Priority 9)
- GroupCard usa `next/link` (`href="/predictions/grupos/{id}"`). Todos navegáveis (sem bloqueio entre grupos).
- Back para o Hub via shell/browser. Deep-link: `/predictions/grupos` é a tela de seleção.
- Rota destino `/predictions/grupos/[groupId]` ainda não existe (TASK-09) — `href` de convenção; navegação efetiva quando a tela existir.
- BottomNav/SideNav inalterados; localização "Palpites" destacada pela nav existente.

## 11. Pre-Delivery Checklist Status
- Ícones SVG (Lucide: `Info`, `CheckCircle2` via primitiva), import nomeado — OK.
- Sem emoji como ícone — OK.
- Pressed/focus não deslocam layout (ring com offset; hover só de cor) — OK.
- Tokens semânticos; zero hex; sem `style` inline — OK.
- Touch ≥ 44px, gap ≥ 8px — OK.
- Light/dark: tokens neutros + `text-win` com variante dark — OK.
- Acessibilidade (labels, h1/h2, lista semântica, cor não-exclusiva, reduced motion) — OK.
- Estados definidos (loading/empty/populated/error; success/disabled n/a justificado) — OK.

## 12. Design Gaps and Assumptions
- **Estado `selected` (verde) do wireframe:** pertence ao fluxo contínuo/wizard (TASK-16); nesta tela avulsa nenhum card nasce selecionado. Assumido.
- **Rótulo do grupo:** "Grupo {groupId}" derivado do dado. Se houver nome canônico em `groups`/`match`, ajustar futuramente.
- **Texto exato da dica:** "Você pode preencher os grupos em qualquer ordem." é cópia assumida (wireframe ilegível no detalhe). Ajustável; não bloqueia.
- **Rota destino TASK-09** ainda inexistente — `href` de convenção.
- **Header próprio:** a tela não desenha header; reusa o app shell tematizado pelo escopo verde.
