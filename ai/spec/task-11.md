# SPEC — TASK-11: App shell + layout base (mobile-first)

> Entrada: `ai/plan/feature.md` (TASK-11) + `ai/prd/feature.md` (seção 7 — Impacto UI/Layout) + `.claude/CLAUDE.md` (responsividade mobile-first, controle de acesso status/role, telas MVP, fluxo de auth).
> Tipo: `ui` · Criticidade: `high` · Risco técnico: `medium` · Story points: 3.
> TDD: **não** · Screen: **sim** (primeira tarefa de UI — `/screen` gera `design-system/MASTER.md`) · Dependências: **TASK-02** (Shadcn + tema) + **TASK-06** (provedores + `useAuth`) — Wave 4.

---

## 1. Objetivo e delimitação de escopo

Esta tarefa entrega o **esqueleto de layout raiz** da aplicação e a **camada de roteamento protegido por status de autenticação**. Não é uma feature de usuário; é a fundação visual e estrutural sobre a qual todas as telas do MVP (PRD-01+) serão construídas.

### Dentro do escopo (TASK-11)

- `AppShell`: componente de layout raiz mobile-first — container responsivo, `Header` fixo com título da aplicação, slot de navegação (`BottomNav` no mobile / `SideNav` no desktop).
- `AuthGuard`: componente client que lê `useAuth` e implementa a máquina de estados de roteamento: não autenticado → `/login`; `pending` → tela "Aguardando Aprovação"; `blocked` → mensagem de bloqueio; `approved` → conteúdo interno.
- `LoadingScreen`: tela de carregamento exibida enquanto `loading === true` no `useAuth`.
- `PendingApprovalScreen`: tela informativa para usuários com `status === "pending"`.
- `BlockedScreen`: mensagem de bloqueio para usuários com `status === "blocked"`.
- Placeholder de home interna (`/app` ou `/(app)/home`) apenas como ponto de chegada para testes de roteamento.
- Estrutura de rotas `src/app/` com grupos `(auth)` e `(app)` (App Router Next 15).
- Artefato de design: `/screen` gera `design-system/MASTER.md` e `ai/screen/task-11.md` antes da implementação.

### Fora do escopo — diferido para PRD-01

| Item | Motivo |
|---|---|
| Formulários de Login e Cadastro | PRD-01 (auth feature) |
| Lógica de criação de conta no Firebase | PRD-01 |
| Tela "Aguardando Aprovação" com botão "Atualizar Status" funcional | PRD-01 (aqui: versão estática/placeholder) |
| Recuperação de senha | PRD-01 |
| Conteúdo real das telas de partidas, palpites, rankings etc. | PRDs futuros |
| Painel administrativo | PRD futuro |
| Notificação ao admin de novo cadastro | Fora do PRD-00 |

> O `AuthGuard` redireciona para `/login` quando não autenticado, mas `/login` em si é apenas uma página placeholder nesta task. A página real é entregue pelo PRD-01.

---

## 2. Estrutura de rotas (`src/app/`)

O App Router do Next 15 suporta **route groups** (diretórios com parênteses) que organizam rotas sem afetar o segmento de URL. A estrutura proposta segrega as rotas de autenticação das rotas internas protegidas:

```
src/app/
├── layout.tsx                    # Root layout — Server Component, envolve <Providers>
├── globals.css
│
├── (auth)/                       # Route group — rotas públicas de auth
│   ├── layout.tsx                # Layout de auth: centralizado, sem navegação
│   ├── login/
│   │   └── page.tsx              # Placeholder de login (PRD-01 substitui)
│   └── pending/
│       └── page.tsx              # Tela "Aguardando Aprovação" (estática nesta task)
│
└── (app)/                        # Route group — rotas internas protegidas
    ├── layout.tsx                # Layout de app: AppShell + AuthGuard
    ├── home/
    │   └── page.tsx              # Placeholder de home interna
    ├── matches/
    │   └── page.tsx              # Placeholder (PRDs futuros)
    ├── predictions/
    │   └── page.tsx              # Placeholder (PRDs futuros)
    ├── rankings/
    │   └── page.tsx              # Placeholder (PRDs futuros)
    └── profile/
        └── page.tsx              # Placeholder (PRDs futuros)
```

### Justificativa da estrutura

- **`(auth)/layout.tsx`**: layout minimalista (sem `AppShell`, sem navegação) adequado para telas de login/cadastro centradas na tela. Redireciona para `/(app)/home` se o usuário já estiver autenticado e aprovado.
- **`(app)/layout.tsx`**: envolve todo o conteúdo interno com `<AuthGuard>` e `<AppShell>`. É um **Client Component** (boundary necessário pois `AuthGuard` usa `useAuth`).
- **Root `layout.tsx`**: permanece Server Component; apenas envolve com `<Providers>` (já existente da TASK-06).
- Rotas placeholder (`matches/`, `predictions/`, `rankings/`, `profile/`) existem apenas para que a navegação funcione visualmente; o conteúdo real vem em PRDs futuros.

---

## 3. Componentes de layout

### 3.1 `AppShell` — `src/components/layout/AppShell.tsx`

Componente client que forma o contêiner principal da aplicação interna. Responsável por:

- Renderizar o `Header` (fixo no topo).
- Renderizar a área de conteúdo com padding adequado para não ficar atrás do header ou da nav inferior.
- Renderizar `BottomNav` em mobile (abaixo do conteúdo) ou `SideNav` em desktop (à esquerda).

```
┌─────────────────────────────┐
│         Header              │  ← fixo, h-14, z-50
├──────┬──────────────────────┤
│      │                      │
│ Side │    Conteúdo          │  ← desktop (md+)
│ Nav  │    (main)            │
│      │                      │
└──────┴──────────────────────┘

┌─────────────────────────────┐
│         Header              │  ← fixo, h-14
├─────────────────────────────┤
│                             │
│    Conteúdo (main)          │  ← mobile
│                             │
├─────────────────────────────┤
│       Bottom Nav            │  ← fixo, h-16
└─────────────────────────────┘
```

**Props:**

```ts
interface AppShellProps {
  children: React.ReactNode;
}
```

**Estrutura JSX (referência):**

```tsx
<div className="flex min-h-screen flex-col bg-background">
  <Header />
  <div className="flex flex-1">
    <SideNav className="hidden md:flex" />        {/* desktop */}
    <main
      id="main-content"
      className="flex-1 px-4 py-4 pb-20 md:pb-4"  {/* pb-20 = espaço p/ BottomNav */}
      tabIndex={-1}                               {/* skip-link target */}
    >
      {children}
    </main>
  </div>
  <BottomNav className="md:hidden" />             {/* mobile only */}
</div>
```

> Tokens de cor (`bg-background`, `text-foreground` etc.) são fornecidos pelo tema Shadcn configurado na TASK-02. Nenhum valor hexadecimal ou `style={}` inline.

### 3.2 `Header` — `src/components/layout/Header.tsx`

Barra fixa no topo. Contém o título da aplicação e, futuramente, avatar/menu do usuário (PRD-01).

- Altura: `h-14` (56px).
- Posição: `fixed top-0 left-0 right-0 z-50`.
- Fundo: `bg-background/95 backdrop-blur-sm border-b border-border`.
- Conteúdo: logotipo/título "Bolão dos Parças" à esquerda; slot vazio (`aria-label="Ações do usuário"`) à direita para PRD-01.
- `role="banner"` e `aria-label="Cabeçalho da aplicação"`.

### 3.3 `BottomNav` — `src/components/layout/BottomNav.tsx`

Navegação inferior para mobile. Exibida apenas em telas menores que `md` (< 768px).

- Posição: `fixed bottom-0 left-0 right-0 z-50`.
- Altura: `h-16` (64px).
- Fundo: `bg-background/95 backdrop-blur-sm border-t border-border`.
- Itens de navegação (ver seção 3.5).
- `role="navigation"` e `aria-label="Navegação principal"`.

### 3.4 `SideNav` — `src/components/layout/SideNav.tsx`

Navegação lateral para desktop. Exibida apenas em telas `md+` (≥ 768px).

- Largura: `w-16` (apenas ícones, colapsada por padrão) ou `w-56` (com rótulos) — proposta: **`w-16` com tooltip de rótulo ao hover** para economizar espaço no desktop sem sacrificar usabilidade.
- Posição: `sticky top-14` (abaixo do header fixo), altura `calc(100vh - 3.5rem)`.
- Fundo: `bg-background border-r border-border`.
- Itens de navegação (ver seção 3.5).
- `role="navigation"` e `aria-label="Navegação lateral"`.

### 3.5 Itens de navegação

Os mesmos 5 itens são usados em `BottomNav` e `SideNav`. Extrair como constante tipada em `src/components/layout/nav-items.ts`:

| Rótulo | Rota | Ícone (Lucide) | `aria-label` |
|---|---|---|---|
| Início | `/home` | `Home` | "Ir para início" |
| Jogos | `/matches` | `Calendar` | "Ver jogos" |
| Palpites | `/predictions` | `PenLine` | "Meus palpites" |
| Ranking | `/rankings` | `Trophy` | "Ver ranking" |
| Perfil | `/profile` | `User` | "Meu perfil" |

Cada item é um `<Link>` do Next.js (`next/link`). O item ativo recebe destaque visual usando `usePathname()` do Next.js para comparar a rota atual.

```ts
// src/components/layout/nav-items.ts
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  ariaLabel: string;
}
```

### 3.6 `AuthGuard` — `src/components/layout/AuthGuard.tsx`

Client Component (`"use client"`). Lê `useAuth()` e implementa a máquina de estados de roteamento (ver seção 4). Envolve o `children` do layout `(app)`.

**Props:**

```ts
interface AuthGuardProps {
  children: React.ReactNode;
}
```

**Fluxo interno:**

```
useAuth() → { loading, firebaseUser, status }
    ↓
loading === true        → <LoadingScreen />
firebaseUser === null   → redirect("/login")
status === "pending"    → redirect("/pending")
status === "blocked"    → <BlockedScreen />
status === "approved"   → {children}
status === null (erro)  → <BlockedScreen /> (estado seguro — fallback)
```

> `redirect()` de `next/navigation` funciona dentro de Client Components apenas como `useRouter().push()`. Usar `useRouter` + `useEffect` para redirecionar programaticamente, **não** a função `redirect()` de `next/navigation` (que é server-side). Alternativamente, renderizar `null` enquanto o `useEffect` despacha o push.

### 3.7 `LoadingScreen` — `src/components/layout/LoadingScreen.tsx`

Tela de carregamento exibida enquanto `loading === true`. Não bloqueia hidratação — renderiza conteúdo visual imediatamente no client.

- Ocupar `min-h-screen` centralizado (`flex items-center justify-center`).
- Mostrar um spinner (componente animado via Tailwind `animate-spin`) + texto "Carregando…" para leitores de tela (`aria-live="polite"`, `role="status"`).
- O spinner usa bordas com tokens de tema: `border-border` + `border-t-primary`.

### 3.8 `PendingApprovalScreen` — `src/components/layout/PendingApprovalScreen.tsx`

Tela estática exibida na rota `/pending` para usuários com `status === "pending"`.

Conteúdo mínimo:
- Ícone `Clock` (Lucide) em destaque.
- Título: "Aguardando Aprovação".
- Mensagem: "Sua conta foi criada e está aguardando aprovação do administrador. Você receberá acesso assim que for aprovado."
- Botão "Sair" (logout via `firebaseAuth.signOut()`) — permite ao usuário desvincular a conta enquanto aguarda.

> PRD-01 substitui esta tela pela versão completa com botão "Atualizar Status" funcional.

### 3.9 `BlockedScreen` — `src/components/layout/BlockedScreen.tsx`

Mensagem exibida para usuários com `status === "blocked"` (ou `status === null` em cenário de erro).

Conteúdo mínimo:
- Ícone `ShieldOff` (Lucide).
- Título: "Acesso Bloqueado".
- Mensagem: "Sua conta foi bloqueada. Entre em contato com o administrador."
- Botão "Sair".

---

## 4. Máquina de estados: `status` × comportamento do `AuthGuard`

| `loading` | `firebaseUser` | `status` | Comportamento | Rota resultante |
|---|---|---|---|---|
| `true` | qualquer | qualquer | Renderiza `<LoadingScreen />` | — (aguarda) |
| `false` | `null` | `null` | Redireciona para login | `/login` |
| `false` | definido | `"pending"` | Redireciona para pending | `/pending` |
| `false` | definido | `"blocked"` | Renderiza `<BlockedScreen />` | — (sem rota) |
| `false` | definido | `"approved"` | Renderiza `{children}` | rota solicitada |
| `false` | definido | `null` (erro de perfil) | Renderiza `<BlockedScreen />` (fallback seguro) | — |

> O `status === null` com `firebaseUser` definido ocorre quando `AuthProvider` retornou erro de perfil (`"not-found"`, `"parse-error"`, `"fetch-error"`). O comportamento seguro é bloquear o acesso. PRD-01 tratará o caso `"not-found"` no fluxo de cadastro (doc ainda não criado).

### Layout `(auth)` — inversão de guarda

O layout `(auth)/layout.tsx` realiza a guarda inversa: se `loading === false` e `status === "approved"`, redireciona para `/(app)/home`. Assim um usuário já autenticado e aprovado não vê a tela de login.

| `loading` | `firebaseUser` | `status` | Comportamento em `(auth)` |
|---|---|---|---|
| `true` | qualquer | qualquer | Renderiza `<LoadingScreen />` |
| `false` | `null` | `null` | Renderiza `{children}` (acesso permitido às rotas de auth) |
| `false` | definido | `"approved"` | Redireciona para `/home` |
| `false` | definido | `"pending"` | Renderiza `{children}` (permanece em `/pending`) |
| `false` | definido | `"blocked"` | Renderiza `<BlockedScreen />` |

---

## 5. Responsividade mobile-first e breakpoints

A estratégia segue o `.claude/CLAUDE.md`: **mobile first**, com breakpoints Tailwind `sm` (tablet) e `md`/`lg` (desktop).

| Elemento | Mobile (< 768px) | Desktop (`md+`, ≥ 768px) |
|---|---|---|
| `BottomNav` | visível (`flex`) | oculta (`hidden`) |
| `SideNav` | oculta (`hidden`) | visível (`flex`) |
| `Header` | altura `h-14`, título central ou à esquerda | altura `h-14`, título à esquerda |
| `main` padding-bottom | `pb-20` (espaço para `BottomNav`) | `pb-4` |
| `main` padding-left | `pl-4` | `pl-4` (SideNav é `sticky`, não `absolute`) |
| Largura máxima do conteúdo | 100% | `max-w-4xl mx-auto` (conteúdo não estica em telas muito largas) |

**Classes Tailwind de referência para o layout:**

```
AppShell → "flex min-h-screen flex-col bg-background"
SideNav  → "hidden md:flex w-16 flex-col border-r border-border sticky top-14 h-[calc(100vh-3.5rem)]"
BottomNav → "fixed bottom-0 left-0 right-0 md:hidden h-16 bg-background/95 border-t border-border"
Header   → "fixed top-0 left-0 right-0 h-14 z-50 bg-background/95 backdrop-blur-sm border-b border-border"
main     → "flex-1 px-4 py-4 pb-20 md:pb-4"
```

> Nenhum estilo inline. Nenhum valor de cor diretamente — apenas tokens CSS (`bg-background`, `text-foreground`, `border-border`, `text-primary` etc.) gerados pelo tema Shadcn da TASK-02.

---

## 6. Acessibilidade (nível enhanced)

O plano classifica esta tarefa com `accessibility level: enhanced`. Requisitos:

### 6.1 Skip link

Adicionar ao início do `AppShell` (ou do `(app)/layout.tsx`) um link "Pular para o conteúdo principal" visível apenas ao receber foco:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-primary"
>
  Pular para o conteúdo principal
</a>
```

O `<main id="main-content" tabIndex={-1}>` é o alvo.

### 6.2 Navegação por teclado

- Todos os itens de `BottomNav` e `SideNav` são `<Link>` do Next.js — naturalmente focáveis.
- Ordem de foco: skip link → Header → SideNav (desktop) → main content → BottomNav (mobile).
- Nenhum `tabIndex` positivo.

### 6.3 ARIA

| Elemento | Atributo |
|---|---|
| `<header>` | `role="banner"`, `aria-label="Cabeçalho da aplicação"` |
| `<nav>` (BottomNav) | `role="navigation"`, `aria-label="Navegação principal"` |
| `<nav>` (SideNav) | `role="navigation"`, `aria-label="Navegação lateral"` |
| Item de nav ativo | `aria-current="page"` |
| Item de nav | `aria-label` individual (seção 3.5) |
| `<main>` | `id="main-content"`, `tabIndex={-1}` |
| Spinner de loading | `role="status"`, `aria-live="polite"`, `aria-label="Carregando aplicação"` |
| Telas de bloqueio/pending | `role="main"`, `aria-label` descritivo |

### 6.4 Contraste

Usar apenas tokens de tema da TASK-02. O tema Shadcn segue WCAG AA por padrão. Não criar variações de cor fora do tema.

### 6.5 Reduced motion

O spinner de `LoadingScreen` deve respeitar `prefers-reduced-motion`:

```tsx
<div
  className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary motion-reduce:animate-none"
  aria-hidden="true"
/>
```

---

## 7. Contrato de design — interface com `/screen` e `/implement`

### 7.1 Artefatos gerados por `/screen` (antes de `/implement`)

O `/screen` deve rodar com `--design-system --persist` e gerar:

- `design-system/MASTER.md` — tokens de cor, tipografia, espaçamento, raio, sombra, componentes base. Alimentado pelo tema da TASK-02.
- `ai/screen/task-11.md` — especificação visual dos componentes desta task: `AppShell`, `Header`, `BottomNav`, `SideNav`, `LoadingScreen`, `PendingApprovalScreen`, `BlockedScreen`.

### 7.2 O que `/implement` deve referenciar

- `design-system/MASTER.md`: todos os tokens de cor, espaçamento e tipografia.
- `ai/screen/task-11.md`: especificação visual detalhada de cada componente.
- Esta spec (`ai/spec/task-11.md`): estrutura de componentes, props, máquina de estados, acessibilidade.

### 7.3 Restrições de implementação

- **Sem `any`** — TypeScript strict em todos os arquivos.
- **Sem estilos inline** — `style={{}}` proibido; apenas classes Tailwind ou variáveis CSS de tema.
- **Tokens de tema** — cores apenas via `bg-background`, `text-foreground`, `border-border`, `text-primary` etc. (TASK-02). Nenhum valor hexadecimal literal nas classes.
- **Componentes Shadcn disponíveis:** `Button`, `Input`, `Form`, `Sonner` (já instalados — TASK-02). Reusar em `PendingApprovalScreen` e `BlockedScreen` para botão "Sair".
- **Imports de ícones:** `import { Home, Calendar, PenLine, Trophy, User, Clock, ShieldOff } from "lucide-react"` — não importar o pacote inteiro.
- **`next/link`** para navegação (não `<a>` diretamente).
- **`useRouter` + `useEffect`** para redirecionamentos programáticos no `AuthGuard` e `(auth)/layout.tsx`.

---

## 8. Arquivos a criar / modificar

| Arquivo | Ação | Observação |
|---|---|---|
| `src/app/(auth)/layout.tsx` | criar | Layout público de auth + guarda inversa |
| `src/app/(auth)/login/page.tsx` | criar | Placeholder de login (PRD-01 substitui) |
| `src/app/(auth)/pending/page.tsx` | criar | Renderiza `<PendingApprovalScreen />` |
| `src/app/(app)/layout.tsx` | criar | Envolve com `<AuthGuard>` + `<AppShell>` |
| `src/app/(app)/home/page.tsx` | criar | Placeholder de home interna |
| `src/app/(app)/matches/page.tsx` | criar | Placeholder (pode ser `null` export simples) |
| `src/app/(app)/predictions/page.tsx` | criar | Placeholder |
| `src/app/(app)/rankings/page.tsx` | criar | Placeholder |
| `src/app/(app)/profile/page.tsx` | criar | Placeholder |
| `src/app/page.tsx` | modificar | Redirecionar para `/home` (ou manter como redirect) |
| `src/components/layout/AppShell.tsx` | criar | Layout raiz interno |
| `src/components/layout/Header.tsx` | criar | Barra fixa do topo |
| `src/components/layout/BottomNav.tsx` | criar | Nav inferior mobile |
| `src/components/layout/SideNav.tsx` | criar | Nav lateral desktop |
| `src/components/layout/nav-items.ts` | criar | Constante tipada dos itens de nav |
| `src/components/layout/AuthGuard.tsx` | criar | Guard client por status |
| `src/components/layout/LoadingScreen.tsx` | criar | Tela de carregamento |
| `src/components/layout/PendingApprovalScreen.tsx` | criar | Tela "Aguardando Aprovação" |
| `src/components/layout/BlockedScreen.tsx` | criar | Tela de acesso bloqueado |
| `src/components/layout/index.ts` | criar | Barrel de exports de layout |
| `src/app/layout.tsx` | **não modificar** | Já está correto (TASK-06) |

> `src/app/layout.tsx` já envolve `children` com `<Providers>` e permanece Server Component. Não requer modificação nesta task.

---

## 9. Considerações de SSR e Next 15 App Router

- **`(app)/layout.tsx` deve ser `"use client"`** pois usa `AuthGuard` (que usa `useAuth`, hook client). Isso transforma todo o grupo `(app)` em boundary client.
- **`(auth)/layout.tsx` deve ser `"use client"`** pelo mesmo motivo (guarda inversa usa `useAuth`).
- **Páginas placeholder** (`home/page.tsx`, `matches/page.tsx` etc.) podem ser Server Components simples — não precisam de `"use client"`.
- **`AuthGuard` nunca renderiza conteúdo sensível** antes de `loading === false` + `status === "approved"`, evitando flash de conteúdo não autorizado (FOUC de auth).
- **Durante SSR**, `loading === true` (estado inicial do `AuthProvider`). O `AuthGuard` renderizará `<LoadingScreen />` no primeiro render server-side, que é inócuo — o estado real só é determinado no client após `onAuthStateChanged` disparar.
- **`useRouter().push()`** em `useEffect` com dependência em `[loading, firebaseUser, status]` para redirecionar. Não usar `redirect()` de `next/navigation` em Client Components.

---

## 10. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| T1 | Flash de conteúdo não autorizado (FOUC auth) | Alta | `AuthGuard` renderiza `<LoadingScreen />` enquanto `loading === true`; nunca renderiza `{children}` prematuramente |
| T2 | Loop de redirecionamento entre `(auth)` e `(app)` | Média | Guarda `(auth)` só redireciona se `status === "approved"` e `loading === false`; `(app)/AuthGuard` só redireciona se `firebaseUser === null` |
| T3 | `useRouter` chamado durante SSR | Baixa | Redirecionamentos dentro de `useEffect` (só no client) |
| T4 | `AppShell` re-renderizando desnecessariamente | Baixa | Componentes de layout (`Header`, `BottomNav`, `SideNav`) são `memo` se necessário; o `useAuth` já é memoizado com `useMemo` no provider (TASK-06) |
| T5 | Tokens de tema inexistentes (TASK-02 não completa) | Média | Verificar `globals.css` e `tailwind.config.ts` antes de usar tokens; fallback para classes base do Tailwind se um token ainda não estiver definido |
| T6 | `status === null` com usuário autenticado (erro de perfil) | Média | `AuthGuard` trata `status === null` + `firebaseUser !== null` como `<BlockedScreen />` — comportamento seguro por default |
| T7 | Navegação ativa (`aria-current`) incorreta em rotas aninhadas | Baixa | Usar `usePathname().startsWith(href)` para prefixo em vez de igualdade estrita |

---

## 11. Critérios de aceite e verificação

```bash
npm run typecheck   # tsc --noEmit → 0 erros, sem any
npm run lint        # next lint → 0 erros/warnings
npm run build       # next build → sucesso
```

Checklist funcional:

- [ ] Usuário **não autenticado** acessando `/home` é redirecionado para `/login`.
- [ ] Usuário com `status === "pending"` é redirecionado para `/pending` e vê a `PendingApprovalScreen`.
- [ ] Usuário com `status === "blocked"` vê a `BlockedScreen` em qualquer rota de `/(app)`.
- [ ] Usuário com `status === "approved"` acessa `/home` e vê o `AppShell` com navegação.
- [ ] Enquanto `loading === true`, a `LoadingScreen` é exibida (sem flash de conteúdo).
- [ ] Usuário já autenticado e aprovado tentando acessar `/login` é redirecionado para `/home`.
- [ ] Em mobile (< 768px): `BottomNav` visível, `SideNav` oculta.
- [ ] Em desktop (≥ 768px): `SideNav` visível, `BottomNav` oculta.
- [ ] Skip link aparece ao receber foco via teclado e funciona corretamente.
- [ ] Itens de nav têm `aria-current="page"` no item ativo.
- [ ] Sem `any`, sem estilos inline; tudo tipado.
- [ ] `typecheck`, `lint`, `build` verdes.

---

## 12. Notas para as próximas tarefas

- **PRD-01** (auth): substitui `(auth)/login/page.tsx` pelo formulário real de login/cadastro; expande `PendingApprovalScreen` com botão "Atualizar Status" funcional; resolve o estado `"not-found"` criando o doc `users/{uid}` no Firestore após cadastro.
- **PRDs de features**: substituem os placeholders de `matches/`, `predictions/`, `rankings/`, `profile/` pelo conteúdo real.
- **`design-system/MASTER.md`**: gerado por `/screen` antes desta implementação; todas as tasks de UI subsequentes o referenciam como contrato visual do projeto.
- **`Header`**: slot direito vazio reservado para avatar/menu do usuário (PRD-01 adiciona o componente de perfil).
- **`SideNav`**: largura `w-16` (colapsada). Se PRDs futuros demandarem sidebar expandida com rótulos, adicionar estado de expansão e `aria-expanded` ao componente.
