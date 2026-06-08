# Design System Master — Bolão dos Parças

> Documento persistente. Todas as tarefas de UI do projeto referenciam este arquivo como contrato visual canônico.
> Gerado em: 2026-06-05 | Projeto: Bolão dos Parças (Copa do Mundo 2026)
> Stack: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 + Shadcn UI (Base UI)

---

## 1. Direção de estilo

**Tema:** Esportivo limpo, mobile-first, moderno e funcional.

**Filosofia visual:**
- Interface de **baixa distração** — o foco é nos dados (jogos, palpites, rankings).
- Estética **esportiva sobria**: não é um app de casino flashy, mas um bolão entre amigos. Clareza acima de brilho.
- **Dark mode nativo** — suporte completo via tokens CSS; modo padrão é light.
- **Densidade informacional média** — cards com breathing room; listas compactas quando necessário.
- **Cor de destaque controlada** — primária escura (modo light) ou clara (modo dark); sem cores de times fixas no shell.

**Inspirações visuais:** ESPN app, FotMob, Google Play Games — hierarquia clara, tipografia funcional, nav inferior mobile.

---

## 2. Paleta de cores (tokens CSS — Shadcn + Tailwind v4)

Os tokens são variáveis CSS em `oklch()` definidas em `src/app/globals.css`. **Nunca usar valores hexadecimais diretamente** — sempre via token.

### 2.1 Tokens semânticos (light mode)

| Token CSS | Classe Tailwind | Valor oklch (light) | Uso |
|---|---|---|---|
| `--background` | `bg-background` | `oklch(1 0 0)` = branco puro | Fundo de página/shell |
| `--foreground` | `text-foreground` | `oklch(0.145 0 0)` = quase preto | Texto primário |
| `--card` | `bg-card` | `oklch(1 0 0)` | Fundo de cards |
| `--card-foreground` | `text-card-foreground` | `oklch(0.145 0 0)` | Texto em cards |
| `--primary` | `bg-primary` / `text-primary` | `oklch(0.205 0 0)` = cinza escuro | Ações primárias, CTA |
| `--primary-foreground` | `text-primary-foreground` | `oklch(0.985 0 0)` = branco | Texto sobre primary |
| `--secondary` | `bg-secondary` | `oklch(0.97 0 0)` = cinza muito claro | Ações secundárias, chips |
| `--secondary-foreground` | `text-secondary-foreground` | `oklch(0.205 0 0)` | Texto sobre secondary |
| `--muted` | `bg-muted` | `oklch(0.97 0 0)` | Fundos sutis, placeholders |
| `--muted-foreground` | `text-muted-foreground` | `oklch(0.556 0 0)` = cinza médio | Texto auxiliar, labels |
| `--accent` | `bg-accent` | `oklch(0.97 0 0)` | Hover states, destaques suaves |
| `--accent-foreground` | `text-accent-foreground` | `oklch(0.205 0 0)` | Texto sobre accent |
| `--destructive` | `bg-destructive` / `text-destructive` | `oklch(0.577 0.245 27.325)` = vermelho | Ações destrutivas, bloqueio |
| `--border` | `border-border` | `oklch(0.922 0 0)` = cinza claro | Bordas de divisão |
| `--input` | `border-input` | `oklch(0.922 0 0)` | Borda de inputs |
| `--ring` | `ring-ring` | `oklch(0.708 0 0)` | Focus ring |
| `--sidebar` | `bg-sidebar` | `oklch(0.985 0 0)` | Fundo SideNav |
| `--sidebar-foreground` | `text-sidebar-foreground` | `oklch(0.145 0 0)` | Texto SideNav |
| `--sidebar-primary` | `bg-sidebar-primary` | `oklch(0.205 0 0)` | Item ativo SideNav |
| `--sidebar-accent` | `bg-sidebar-accent` | `oklch(0.97 0 0)` | Hover SideNav |
| `--sidebar-border` | `border-sidebar-border` | `oklch(0.922 0 0)` | Borda SideNav |

### 2.2 Tokens semânticos (dark mode — classe `.dark`)

| Token CSS | Valor oklch (dark) | Notas |
|---|---|---|
| `--background` | `oklch(0.145 0 0)` = quase preto | |
| `--foreground` | `oklch(0.985 0 0)` = quase branco | |
| `--primary` | `oklch(0.922 0 0)` = cinza muito claro | Inverte com background |
| `--primary-foreground` | `oklch(0.205 0 0)` = escuro | |
| `--muted` | `oklch(0.269 0 0)` | |
| `--muted-foreground` | `oklch(0.708 0 0)` | |
| `--border` | `oklch(1 0 0 / 10%)` | Translúcido |
| `--destructive` | `oklch(0.704 0.191 22.216)` | Vermelho ligeiramente mais vivo |
| `--sidebar-primary` | `oklch(0.488 0.243 264.376)` = azul médio | Destaque sidebar dark |

### 2.3 Tokens de gráficos (ranking, estatísticas)

| Token | Classe | Uso |
|---|---|---|
| `--chart-1` | `bg-chart-1` | 1° lugar / mais alto |
| `--chart-2` | `bg-chart-2` | 2° lugar |
| `--chart-3` | `bg-chart-3` | 3° lugar |
| `--chart-4` | `bg-chart-4` | Valores intermediários |
| `--chart-5` | `bg-chart-5` | Valores baixos / base |

### 2.4-auth Tema de autenticação — duas zonas (`.auth-theme` + `.auth-card`)

A tela de **Login** usa layout de **duas zonas** (ref. `docs/prd-01/login.png`), via duas classes de escopo em `globals.css` (não alteram tokens globais):

- **Hero `.auth-theme`** — no container raiz da página: fundo verde escuro, texto branco, logo + boas-vindas.
- **Cartão `.auth-card`** — aninhado dentro do hero: superfície **clara** (branca) com o formulário; herda o `--primary` verde do hero para CTA e links.

| Classe | Token | Valor oklch | Uso |
|---|---|---|---|
| `.auth-theme` | `--background` | `0.28 0.05 155` | Fundo verde escuro do hero |
| `.auth-theme` | `--foreground` | `0.985 0 0` | Texto branco do hero |
| `.auth-theme` | `--primary` | `0.46 0.16 150` | CTA verde (herdado pelo card) |
| `.auth-theme` | `--primary-foreground` | `0.985 0 0` | Texto branco sobre CTA |
| `.auth-theme` | `--muted-foreground` | `0.86 0.03 155` | Subtítulo do hero |
| `.auth-card` | `--background` / `--card` | `1 0 0` | Superfície clara do form/inputs |
| `.auth-card` | `--foreground` | `0.205 0 0` | Texto escuro (labels/valores) |
| `.auth-card` | `--input` / `--border` | `0.922 0 0` | Borda dos inputs |
| `.auth-card` | `--muted-foreground` | `0.5 0 0` | Placeholders/auxiliar |

**Decisão de contraste (WCAG AA):** `--primary` é verde médio-escuro (`~0.46`) com foreground **branco**. No card claro: CTA "Entrar" (branco sobre verde) e links `text-primary` (verde sobre branco) ficam ambos ≥ AA. No hero: texto branco sobre verde escuro ≥ AA.

**Logo:** Login usa `public/logo-login.png` (troféu **verde**, ref. `login.png`). A tela **Pending** NÃO usa essas classes (mantém tema claro). **Cadastro** será ajustado em iteração futura (decisão adiada).

### 2.4-palpites Tema da área de Palpites em Massa (`.palpites-theme`)

A jornada de palpites em massa (PRD03-01..16, feature `palpites-massa`) usa **shell + CTA + barra + realce de seleção em verde**, conforme os wireframes. Isso é uma **decisão de tema** (remapear `--primary`/`--ring`), não semântica de acerto/erro — por isso **não** reusa `--color-win/loss/draw` (que continuam reservados para semântica esportiva: ✓ de grupo concluído usa `text-win`).

Implementado como **classe de escopo `.palpites-theme`** em `globals.css` (à la `.auth-theme`), aplicada no container raiz da rota `/predictions` (TASK-07). Reusa o **mesmo verde validado AA** de `.auth-theme` (troféu da identidade).

| Classe | Token | Valor oklch | Uso |
|---|---|---|---|
| `.palpites-theme` | `--primary` | `0.46 0.16 150` | CTA, barra de progresso, realce |
| `.palpites-theme` | `--primary-foreground` | `0.985 0 0` | Texto branco sobre primary |
| `.palpites-theme` | `--ring` | `0.46 0.16 150` | Focus ring verde |
| `.palpites-theme` | `--sidebar-primary` | `0.46 0.16 150` | Item ativo da nav no escopo |

**Decisão de contraste (WCAG AA):** `--primary` verde médio-escuro (`~0.46`) com foreground branco → CTA (branco sobre verde) e elementos `text-primary` (verde sobre branco/card claro) ambos ≥ AA. Mesma escolha de `.auth-theme`. Cards internos permanecem em superfície clara neutra; só o shell/CTA/barra/realce ficam verdes. As primitivas (`ProgressBar`, `PhaseCard`, `GroupCard`, `CompactScoreInput`) são neutras-por-token e herdam o verde **dentro** do escopo.

### 2.4-ranking Tema da seção Ranking (`.ranking-theme`) — PRD-05

Os screenshots do PRD-05 são **verdes**; o app é neutro. Decisão do Tech Lead: **verde com escopo no Ranking**, via classe `.ranking-theme` em `globals.css` (mesmo padrão de `.auth-theme`/`.palpites-theme`), aplicada no container raiz de `/rankings` (TASK-07). **Não** re-tematiza o app globalmente. Reusa o **mesmo verde validado AA** (troféu da identidade).

| Classe | Token | Valor oklch | Uso |
|---|---|---|---|
| `.ranking-theme` | `--primary` | `0.46 0.16 150` | Header de destaque, aba ativa, CTA, botão "Tentar Novamente" |
| `.ranking-theme` | `--primary-foreground` | `0.985 0 0` | Texto branco sobre primary (header verde) |
| `.ranking-theme` | `--ring` | `0.46 0.16 150` | Focus ring verde |
| `.ranking-theme` | `--chart-1` | `0.46 0.16 150` | Linha do gráfico de evolução + barras de distribuição |

**Regras de uso (tokens, sem hex):**
- Header de destaque ("Sua Posição Atual", "Visão Geral do Bolão"): `bg-primary text-primary-foreground`.
- Destaque "Você" (linha do usuário no ranking): `bg-primary/10 text-foreground` + badge `bg-primary text-primary-foreground`; contraste AA garantido.
- Aba ativa (`RankingSubNav`): `text-primary font-semibold` + sublinhado `border-primary` (cor NÃO é único indicador — peso + borda).
- Evolução: subiu = `text-primary` + ArrowUp; caiu = `text-destructive` + ArrowDown; manteve = `text-muted-foreground` + Minus.
- `--color-win`/`--color-loss` (já em globals.css) seguem reservados à semântica de acerto/erro de palpite, não ao tema.

### 2.4 Extensões semânticas para esportes (a adicionar em globals.css quando necessário)

Estes tokens **não existem ainda** — devem ser adicionados em `globals.css` quando PRDs de features precisarem:

```css
/* Adicionar em :root quando PRD de rankings precisar */
--color-win: oklch(0.72 0.18 145);      /* verde — vitória/acerto */
--color-loss: oklch(0.577 0.245 27.325); /* vermelho — derrota/erro (reusa destructive) */
--color-draw: oklch(0.75 0.12 85);      /* âmbar — empate */
```

---

## 3. Tipografia

### 3.1 Família de fontes

| Papel | Token | Fonte aplicada |
|---|---|---|
| Corpo / UI | `--font-sans` / `font-sans` | Sistema → Inter (se carregada via Next.js font) |
| Títulos/Heading | `--font-heading` (alias de `--font-sans`) | Mesma fonte, peso diferente |
| Monospace | `font-mono` | Fallback padrão do sistema |

> Configurar `next/font/google` com Inter (ou fonte escolhida) na `src/app/layout.tsx` (TASK-02/TASK-06). O token `--font-sans` é injetado como variável CSS no `<html>`.

### 3.2 Escala tipográfica (classes Tailwind)

| Nome | Classes | Uso principal |
|---|---|---|
| **Display** | `text-3xl font-bold` / `text-4xl font-bold` | Títulos de página grandes (rankings, home) |
| **Heading 1** | `text-2xl font-semibold` | Título principal de seção |
| **Heading 2** | `text-xl font-semibold` | Subtítulo de seção, cards de destaque |
| **Heading 3** | `text-lg font-medium` | Título de card, item de lista |
| **Body Large** | `text-base font-normal` | Texto de conteúdo principal |
| **Body** | `text-sm font-normal` | Texto padrão da UI, labels |
| **Body Small** | `text-xs font-normal` | Metadados, timestamps, contagens |
| **Label** | `text-xs font-medium uppercase tracking-wide` | Labels de campos, tags de status |
| **Nav Item** | `text-xs font-medium` | Rótulos de navegação (BottomNav) |

### 3.3 Pesos tipográficos

| Peso | Classe | Uso |
|---|---|---|
| Regular | `font-normal` (400) | Corpo de texto |
| Medium | `font-medium` (500) | Labels, nav items |
| Semibold | `font-semibold` (600) | Títulos de seção, destaques |
| Bold | `font-bold` (700) | Display, pontuações, scores |

### 3.4 Hierarquia de cores de texto

| Hierarquia | Classe | Uso |
|---|---|---|
| Primário | `text-foreground` | Texto principal |
| Secundário | `text-muted-foreground` | Labels, metadados, textos de suporte |
| Invertido | `text-primary-foreground` | Texto sobre fundo primary |
| Destrutivo | `text-destructive` | Erros, avisos críticos |
| Desabilitado | `text-muted-foreground opacity-50` | Elementos desabilitados |

---

## 4. Espaçamento

O sistema usa a escala padrão do Tailwind (base 4px = `1` unidade). **Nunca usar valores arbitrários** sem justificativa.

### 4.1 Escala de referência

| Token Tailwind | px equivalente | Uso típico |
|---|---|---|
| `space-1` / `p-1` | 4px | Micro espaço, ícones internos |
| `space-2` / `p-2` | 8px | Padding interno pequeno |
| `space-3` / `p-3` | 12px | Padding de badge, chip |
| `space-4` / `p-4` | 16px | Padding padrão de card/seção |
| `space-5` / `p-5` | 20px | — |
| `space-6` / `p-6` | 24px | Padding de modal, seções amplas |
| `space-8` / `p-8` | 32px | Margens de seção, padding de página desktop |
| `space-10` | 40px | — |
| `space-12` | 48px | Gaps entre seções grandes |
| `space-14` / `h-14` | 56px | Altura do Header |
| `space-16` / `h-16` | 64px | Altura do BottomNav |
| `space-20` / `pb-20` | 80px | Padding-bottom para compensar BottomNav |

### 4.2 Padding de layout

| Contexto | Classe | Comentário |
|---|---|---|
| Padding horizontal de página | `px-4` | Mobile e desktop |
| Padding vertical de conteúdo | `py-4` | Top |
| Padding bottom (mobile) | `pb-20` | Compensar BottomNav h-16 + gap |
| Padding bottom (desktop) | `pb-4` | Sem BottomNav |
| Max width de conteúdo (desktop) | `max-w-4xl mx-auto` | Evita linhas excessivamente longas |
| Gap entre cards | `gap-4` | Grid/flex de cards |
| Gap entre itens de lista | `gap-2` | Listas densas |

---

## 5. Raio de borda (Border Radius)

| Token CSS | Classe Tailwind | Valor calculado | Uso |
|---|---|---|---|
| `--radius` | — | `0.625rem` (10px) | Base |
| `--radius-sm` | `rounded-sm` | ~6px | Badges, chips pequenos |
| `--radius-md` | `rounded-md` | ~8px | Inputs, botões pequenos |
| `--radius-lg` | `rounded-lg` | ~10px | Cards, botões padrão |
| `--radius-xl` | `rounded-xl` | ~14px | Modais, sheets |
| `--radius-2xl` | `rounded-2xl` | ~18px | Cards hero, bottom sheets |
| `--radius-full` | `rounded-full` | 50% | Avatares, ícones circulares |

---

## 6. Sombras (Elevation)

Usar sombras com moderação — interface flat-first.

| Nível | Classe | Uso |
|---|---|---|
| Elevação 0 | `shadow-none` | Padrão, itens de lista |
| Elevação 1 | `shadow-sm` | Cards sutis, hover state |
| Elevação 2 | `shadow-md` | Cards em destaque, modais |
| Elevação 3 | `shadow-lg` | Dropdowns, popovers |
| Elevação 4 | `shadow-xl` | Bottom sheets, sidebars em overlay |

---

## 7. Ícones

**Biblioteca:** Lucide React (`lucide-react`).

**Regras:**
- Importação sempre named: `import { Home, Trophy } from "lucide-react"` — **nunca** `import * as Icons`.
- Tamanho padrão: `size={20}` (20px) para UI geral; `size={16}` para inline com texto; `size={24}` para destaques.
- `aria-hidden="true"` em ícones decorativos; `aria-label` em ícones funcionais sem texto visível.
- Cor sempre via `currentColor` (padrão Lucide) — herda do `className` de cor pai.

### Ícones de navegação (TASK-11)

| Destino | Ícone | Import |
|---|---|---|
| Início | `Home` | `lucide-react` |
| Jogos | `Calendar` | `lucide-react` |
| Palpites | `PenLine` | `lucide-react` |
| Ranking | `Trophy` | `lucide-react` |
| Perfil | `User` | `lucide-react` |

### Ícones de estado (TASK-11)

| Estado | Ícone | Uso |
|---|---|---|
| Carregando | spinner CSS | `LoadingScreen` |
| Aguardando aprovação | `Clock` | `PendingApprovalScreen` |
| Bloqueado | `ShieldOff` | `BlockedScreen` |

---

## 8. Componentes Shadcn disponíveis

Instalados via TASK-02. Usar sempre que aplicável — **não criar primitivas que o Shadcn já fornece**.

| Componente | Import | Uso primário |
|---|---|---|
| `Button` | `@/components/ui/button` | Todas as ações |
| `Input` | `@/components/ui/input` | Campos de texto |
| `Form` | `@/components/ui/form` | Formulários com RHF |
| `Sonner` | `sonner` | Notificações toast |

### Variantes do Button

| Variante | Uso |
|---|---|
| `default` | Ação primária (CTA) |
| `secondary` | Ação secundária |
| `destructive` | Sair, deletar, bloquear |
| `outline` | Ação de menor hierarquia |
| `ghost` | Ícones de nav, ações inline |
| `link` | Links textuais |

---

## 9. Padrões de navegação

### 9.1 Estratégia geral

**Mobile-first com adaptação desktop:**
- **Mobile (< 768px / `md`):** `BottomNav` fixo na parte inferior — padrão nativo de apps móveis; thumb-friendly.
- **Desktop (≥ 768px / `md+`):** `SideNav` sticky à esquerda, colapsado com apenas ícones + tooltip de rótulo ao hover.

### 9.2 BottomNav (mobile)

- Altura: `h-16` (64px) — área de toque confortável.
- Posição: `fixed bottom-0 left-0 right-0 z-50`.
- Fundo: `bg-background/95 backdrop-blur-sm border-t border-border`.
- 5 itens: Início, Jogos, Palpites, Ranking, Perfil.
- Cada item: ícone centralizado + rótulo abaixo (`text-xs font-medium`).
- Item ativo: `text-primary font-semibold`; ícone filled-style (via `fill-current` se disponível) ou stroke mais grosso.
- Item inativo: `text-muted-foreground`.
- Toque mínimo: `min-h-[44px]` por item (WCAG 2.5.5).

### 9.3 SideNav (desktop)

- Largura: `w-16` (64px) — colapsado com ícones apenas.
- Posição: `sticky top-14` — fica abaixo do Header; `h-[calc(100vh-3.5rem)]`.
- Fundo: `bg-sidebar border-r border-sidebar-border`.
- Tooltip ao hover: rótulo do item exibido como tooltip à direita.
- Item ativo: `bg-sidebar-primary text-sidebar-primary-foreground rounded-lg`.
- Item inativo: `text-sidebar-foreground hover:bg-sidebar-accent`.
- Ícones: `size={20}` centralizados.

### 9.4 Header

- Altura: `h-14` (56px).
- Posição: `fixed top-0 left-0 right-0 z-50`.
- Fundo: `bg-background/95 backdrop-blur-sm border-b border-border`.
- Conteúdo esquerdo: logotipo/título "Bolão dos Parças" — `font-bold text-lg` ou `font-heading`.
- Conteúdo direito: slot reservado para avatar/menu do usuário (PRD-01 preenche).
- Padding horizontal: `px-4`.

---

## 10. Acessibilidade — padrões obrigatórios

Nível exigido: **Enhanced** (acima de WCAG AA básico).

### 10.1 Contraste de cores

- Texto principal sobre background: WCAG AA mínimo (4.5:1 para texto normal, 3:1 para texto grande).
- Os tokens Shadcn seguem WCAG AA por padrão nos modos light e dark.
- **Nunca criar variações de cor fora do tema** sem verificar contraste.

### 10.2 Áreas de toque

- Mínimo `44×44px` para qualquer elemento interativo (WCAG 2.5.5).
- Itens de `BottomNav`: padding suficiente para atingir o mínimo.
- Botões: `h-10` (40px) padrão Shadcn — aceitável; preferir `h-11` (44px) em contextos mobile críticos.

### 10.3 ARIA obrigatório por componente

| Componente | Atributos ARIA |
|---|---|
| `<header>` | `role="banner"` · `aria-label="Cabeçalho da aplicação"` |
| `BottomNav <nav>` | `role="navigation"` · `aria-label="Navegação principal"` |
| `SideNav <nav>` | `role="navigation"` · `aria-label="Navegação lateral"` |
| Item de nav ativo | `aria-current="page"` |
| Ícones decorativos | `aria-hidden="true"` |
| `<main>` | `id="main-content"` · `tabIndex={-1}` |
| Spinner | `role="status"` · `aria-live="polite"` · `aria-label="Carregando aplicação"` |
| `LoadingScreen` container | `role="status"` |
| `PendingApprovalScreen` | `role="main"` · `aria-label="Aguardando aprovação"` |
| `BlockedScreen` | `role="main"` · `aria-label="Acesso bloqueado"` |

### 10.4 Skip link (obrigatório no AppShell)

```
Pular para o conteúdo principal
```
- Classe `sr-only` por padrão; `focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]` ao receber foco.
- Target: `<main id="main-content" tabIndex={-1}>`.

### 10.5 Focus management

- Nenhum `tabIndex` positivo.
- Ordem natural: skip link → Header → SideNav (desktop) → main → BottomNav (mobile).
- Focus ring visível: `ring-2 ring-ring ring-offset-2` em todos os elementos focáveis.

### 10.6 Reduced motion

- Animações (spinner, transições) respeitam `prefers-reduced-motion`:
  ```css
  motion-reduce:animate-none
  motion-reduce:transition-none
  ```

---

## 11. Breakpoints responsivos

Padrão Tailwind (mobile-first):

| Breakpoint | Prefixo | Largura mínima | Dispositivo típico |
|---|---|---|---|
| Base (mobile) | — | 0px | Smartphones |
| sm | `sm:` | 640px | Tablets pequenos |
| md | `md:` | 768px | Tablets / desktop |
| lg | `lg:` | 1024px | Desktop |
| xl | `xl:` | 1280px | Desktop wide |
| 2xl | `2xl:` | 1536px | Desktop ultrawide |

**Decisão de navegação:**
- `< md` (< 768px): BottomNav visível, SideNav oculta.
- `≥ md` (≥ 768px): SideNav visível, BottomNav oculta.

---

## 12. Animações e transições

**Biblioteca:** Framer Motion (instalada em TASK-02) + `tw-animate-css` (importado em globals.css).

| Uso | Abordagem |
|---|---|
| Spinner de carregamento | `animate-spin` Tailwind (CSS puro, sem JS) |
| Transição de rotas | Framer Motion `AnimatePresence` (PRDs futuros) |
| Hover states simples | `transition-colors duration-150` Tailwind |
| Entrada de modais/sheets | Shadcn built-in (Radix UI) |
| Microinterações de nav | `transition-all duration-200` |

---

## 13. Z-index layers

| Camada | Valor | Uso |
|---|---|---|
| Base | `z-0` | Conteúdo padrão |
| Elevado | `z-10` | Cards em hover |
| Nav | `z-50` | Header, BottomNav, SideNav |
| Modal overlay | `z-[100]` | Modais, drawers |
| Skip link focado | `z-[100]` | Acessibilidade |
| Toast | `z-[200]` | Sonner notifications |

---

## 14. Convenções de código

- **Sem `any`** — TypeScript strict.
- **Sem `style={{}}`** — apenas classes Tailwind ou variáveis CSS de tema.
- **Sem valores hexadecimais** em classes — apenas tokens (`bg-primary`, não `bg-[#333]`).
- **Componentes** totalmente tipados com interfaces explícitas.
- **Imports de ícones** sempre named, nunca `import *`.
- **`next/link`** para navegação, nunca `<a>` diretamente para rotas internas.
- **`useRouter` + `useEffect`** para redirecionamentos programáticos em Client Components.

---

## 15. Tokens a NÃO usar (reservados / não customizados)

| Token | Status | Substituto |
|---|---|---|
| Valores hexadecimais literais | Proibido | Usar tokens oklch |
| `text-[#...]`, `bg-[#...]` arbitrários | Proibido | Usar tokens semânticos |
| `style={{ color: "..." }}` | Proibido | Usar `text-*` classes |
| `!important` em Tailwind | Proibido sem justificativa | Refatorar especificidade |

---

*Este documento é a fonte única de verdade visual do projeto. Ao introduzir novos tokens, cores ou padrões, atualize este arquivo primeiro.*
