# Screen Design Contract — TASK-11: App Shell + Layout + Auth Guard

> Contrato visual para `/implement`. Todas as decisões de design desta tarefa estão documentadas aqui.
> Referência cruzada: `design-system/MASTER.md` (tokens), `ai/spec/task-11.md` (lógica), `ai/prd/feature.md` (contexto).
> Idioma: pt-BR | Data: 2026-06-05

---

## 1. Visão geral da tarefa

Esta tarefa entrega o **esqueleto visual e estrutural** da aplicação. Não são telas de feature — são as camadas fundamentais:

1. **AppShell** — contêiner responsivo com Header + área de conteúdo + navegação.
2. **Header** — barra de topo fixa com identidade da aplicação.
3. **BottomNav** — navegação inferior para mobile (5 itens).
4. **SideNav** — navegação lateral colapsada para desktop.
5. **LoadingScreen** — tela de carregamento durante resolução de auth.
6. **PendingApprovalScreen** — tela estática para usuários aguardando aprovação.
7. **BlockedScreen** — tela de acesso bloqueado.
8. **AuthGuard** — máquina de estados de roteamento (sem tela própria — lógica de branching).

---

## 2. Fluxo de informação — Máquina de estados de autenticação

### 2.1 Diagrama de fluxo (AuthGuard — rotas `(app)`)

```
┌──────────────────────────────────────────────────────┐
│                   Usuário acessa rota (app)          │
└──────────────────────────────┬───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   loading === true?  │
                    └──────────┬──────────┘
                         sim   │    não
                    ┌──────────▼──────────┐    ┌────────────────────────────┐
                    │  <LoadingScreen />  │    │  firebaseUser === null?    │
                    └─────────────────────┘    └──────────┬─────────────────┘
                                                     sim  │  não
                                             ┌───────────▼───┐    ┌─────────────────────┐
                                             │ redirect /login│    │  status === ?       │
                                             └───────────────┘    └──────────┬──────────┘
                                                                             │
                                              ┌──────────────┬──────────────┼──────────────┐
                                              │              │              │              │
                                         "pending"      "blocked"      "approved"   null/erro
                                              │              │              │              │
                                    ┌─────────▼──┐  ┌────────▼───┐  ┌──────▼───┐  ┌──────▼──────┐
                                    │redirect    │  │<Blocked    │  │{children}│  │<Blocked     │
                                    │/pending    │  │Screen />   │  │(AppShell)│  │Screen />    │
                                    └────────────┘  └────────────┘  └──────────┘  └─────────────┘
```

### 2.2 Diagrama de fluxo (layout `(auth)` — guarda inversa)

```
┌──────────────────────────────────────────────────────┐
│              Usuário acessa rota (auth)              │
└──────────────────────────────┬───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   loading === true?  │
                    └──────────┬──────────┘
                         sim   │   não
                    ┌──────────▼──────────┐    ┌──────────────────────────┐
                    │  <LoadingScreen />  │    │  status === "approved"?  │
                    └─────────────────────┘    └──────────┬───────────────┘
                                                     sim  │  não
                                             ┌───────────▼───┐    ┌─────────────────────┐
                                             │ redirect /home │    │  {children}         │
                                             └───────────────┘    │  (login/pending etc) │
                                                                   └─────────────────────┘
```

---

## 3. Arquitetura de informação — Navegação

### 3.1 Hierarquia de rotas

```
/ (root redirect → /home)
│
├── (auth)/          ← Layout público, sem AppShell
│   ├── /login       ← PRD-01 preenche; placeholder aqui
│   └── /pending     ← PendingApprovalScreen
│
└── (app)/           ← Layout protegido com AuthGuard + AppShell
    ├── /home        ← Dashboard (PRDs futuros)
    ├── /matches     ← Jogos (PRDs futuros)
    ├── /predictions ← Palpites (PRDs futuros)
    ├── /rankings    ← Rankings (PRDs futuros)
    └── /profile     ← Perfil (PRDs futuros)
```

### 3.2 Itens de navegação

| # | Rótulo | Rota | Ícone (Lucide) | Posição BottomNav | Posição SideNav |
|---|---|---|---|---|---|
| 1 | Início | `/home` | `Home` | 1ª (extrema esquerda) | 1º (topo) |
| 2 | Jogos | `/matches` | `Calendar` | 2ª | 2º |
| 3 | Palpites | `/predictions` | `PenLine` | 3ª (centro) | 3º |
| 4 | Ranking | `/rankings` | `Trophy` | 4ª | 4º |
| 5 | Perfil | `/profile` | `User` | 5ª (extrema direita) | 5º (base) |

---

## 4. Especificação visual — AppShell

### 4.1 Layout estrutural

```
┌──────────────────────────────────────────┐  ← viewport
│  ╔════════════════════════════════════╗  │
│  ║            Header (h-14)           ║  │  ← fixed, z-50
│  ╚════════════════════════════════════╝  │
│  ┌────────────────────────────────────┐  │
│  │           main content             │  │
│  │      (px-4, py-4, pb-20)           │  │  ← mobile
│  │                                    │  │
│  └────────────────────────────────────┘  │
│  ╔════════════════════════════════════╗  │
│  ║         BottomNav (h-16)           ║  │  ← fixed, z-50 (apenas mobile)
│  ╚════════════════════════════════════╝  │
└──────────────────────────────────────────┘

Desktop (md+):
┌──────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════╗ │
│  ║                  Header (h-14)               ║ │  ← fixed, z-50
│  ╚══════════════════════════════════════════════╝ │
│  ┌────────┐  ┌───────────────────────────────────┐│
│  │SideNav │  │         main content               ││
│  │ (w-16) │  │    (px-4, py-4, pb-4)              ││
│  │ sticky │  │    max-w-4xl mx-auto                ││
│  │        │  │                                     ││
│  └────────┘  └───────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 4.2 Tokens de classe Tailwind (AppShell)

| Elemento | Classes Tailwind |
|---|---|
| Wrapper raiz | `flex min-h-screen flex-col bg-background` |
| Wrapper interno (header+content) | `flex flex-1` |
| `<main>` | `flex-1 px-4 py-4 pb-20 md:pb-4` |
| Skip link (inativo) | `sr-only` |
| Skip link (ao focar) | `focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-primary` |

---

## 5. Especificação visual — Header

### 5.1 Anatomia

```
┌──────────────────────────────────────────────────────┐
│ px-4                                           px-4  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [Logo/Título "Bolão dos Parças"]     [Slot dir.] │ │  h-14 (56px)
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
  ▲ fixed top-0 left-0 right-0 z-50
  ▲ bg-background/95 backdrop-blur-sm border-b border-border
```

### 5.2 Especificação de elementos

| Elemento | Classes / Props | Notas |
|---|---|---|
| Contêiner `<header>` | `fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur-sm border-b border-border` | `role="banner"` `aria-label="Cabeçalho da aplicação"` |
| Inner wrapper | `flex h-full items-center justify-between px-4` | — |
| Título "Bolão dos Parças" | `font-bold text-lg text-foreground` | Pode ser `<span>` ou `<Link href="/home">` |
| Slot direito | `div` vazio com `aria-label="Ações do usuário"` | PRD-01 insere avatar aqui |

### 5.3 Estilo do título

- Texto: "Bolão dos Parças"
- Tipografia: `font-bold text-lg` — peso 700, ~18px.
- Cor: `text-foreground` — contraste máximo com background.
- Posição: alinhado à esquerda no mobile e desktop.
- Sem ícone/logo específico nesta tarefa (PRD-01 pode adicionar).

### 5.4 Estados

| Estado | Visual |
|---|---|
| Padrão | `bg-background/95 backdrop-blur-sm` |
| Ao rolar (scroll) | O backdrop-blur já cria efeito de glass; sem JS necessário |
| Dark mode | `bg-background/95` → background dark com blur |

---

## 6. Especificação visual — BottomNav (mobile)

### 6.1 Anatomia

```
┌──────────────────────────────────────────────────────┐
│  bg-background/95 backdrop-blur-sm border-t border-border │
│  ┌──────┬──────┬──────┬──────┬──────┐               │
│  │      │      │      │      │      │               │
│  │  🏠  │  📅  │  ✏️  │  🏆  │  👤  │  h-16 (64px)  │
│  │Início│Jogos │Palpit│Rank. │Perfil│               │
│  └──────┴──────┴──────┴──────┴──────┘               │
│  fixed bottom-0 left-0 right-0 z-50                 │
└──────────────────────────────────────────────────────┘
```

### 6.2 Especificação do contêiner

| Propriedade | Valor |
|---|---|
| Posição | `fixed bottom-0 left-0 right-0 z-50` |
| Display | `md:hidden` (oculto em desktop) |
| Altura | `h-16` (64px) |
| Fundo | `bg-background/95 backdrop-blur-sm border-t border-border` |
| ARIA | `role="navigation"` `aria-label="Navegação principal"` |

### 6.3 Especificação de cada item de navegação

| Propriedade | Ativo | Inativo |
|---|---|---|
| Cor ícone | `text-primary` | `text-muted-foreground` |
| Cor rótulo | `text-primary font-semibold` | `text-muted-foreground font-medium` |
| Tamanho ícone | `size={22}` | `size={20}` |
| Fundo item | `bg-accent rounded-lg` (sutil) | transparente |
| Área de toque | `min-h-[44px] min-w-[44px]` | idem |
| ARIA item | `aria-current="page"` | — |
| ARIA link | `aria-label="Ir para início"` etc. | mesmo |

### 6.4 Layout interno de cada item

```
┌─────────────────────┐
│    flex-col          │
│  items-center        │
│  justify-center      │
│  gap-1               │
│  py-2 px-3           │
│                      │
│  ┌──────────────┐    │
│  │   [Ícone]    │    │  size={20} ou size={22}
│  └──────────────┘    │
│  ┌──────────────┐    │
│  │   [Rótulo]   │    │  text-xs font-medium
│  └──────────────┘    │
└─────────────────────┘
```

### 6.5 Distribuição dos 5 itens

- Container: `flex justify-around items-stretch h-full`
- Cada item ocupa `flex-1` — distribuição igual dos 5 itens.

---

## 7. Especificação visual — SideNav (desktop)

### 7.1 Anatomia

```
┌──────────────────┐
│ bg-sidebar        │  ← sticky top-14, h-[calc(100vh-3.5rem)]
│ border-r          │    w-16 (64px)
│ border-sidebar-   │
│ border            │
│                   │
│  ┌────────────┐   │
│  │  [Home]   ◄──── ícone centralizado; tooltip "Início" ao hover
│  └────────────┘   │  item ativo: bg-sidebar-primary rounded-lg
│  ┌────────────┐   │
│  │ [Calendar] │   │  item inativo: hover:bg-sidebar-accent
│  └────────────┘   │
│  ┌────────────┐   │
│  │ [PenLine]  │   │
│  └────────────┘   │
│  ┌────────────┐   │
│  │  [Trophy]  │   │
│  └────────────┘   │
│  ┌────────────┐   │
│  │   [User]   │   │
│  └────────────┘   │
└──────────────────┘
```

### 7.2 Especificação do contêiner

| Propriedade | Valor |
|---|---|
| Display | `hidden md:flex` (oculto em mobile) |
| Largura | `w-16` (64px) — colapsado, apenas ícones |
| Posição | `sticky top-14` |
| Altura | `h-[calc(100vh-3.5rem)]` |
| Direção | `flex-col` |
| Padding | `py-4 px-2` |
| Fundo | `bg-sidebar border-r border-sidebar-border` |
| ARIA | `role="navigation"` `aria-label="Navegação lateral"` |

### 7.3 Especificação de cada item

| Propriedade | Ativo | Inativo |
|---|---|---|
| Fundo | `bg-sidebar-primary` | `hover:bg-sidebar-accent` |
| Cor | `text-sidebar-primary-foreground` | `text-sidebar-foreground hover:text-sidebar-accent-foreground` |
| Padding | `p-3 rounded-lg` | `p-3 rounded-lg` |
| Ícone | `size={20}` | `size={20}` |
| Tooltip | via Shadcn `Tooltip` component | idem |
| Transição | `transition-colors duration-150` | idem |
| ARIA | `aria-current="page"` | — |

### 7.4 Tooltip dos itens

- Posição: `side="right"` (tooltip à direita do ícone).
- Conteúdo: rótulo do item (ex: "Início", "Jogos").
- Ativação: ao hover ou foco do item.
- Implementação: `Tooltip` + `TooltipTrigger` + `TooltipContent` do Shadcn (adicionar se não instalado).

---

## 8. Especificação visual — LoadingScreen

### 8.1 Layout

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│         ╔════════════════════╗           │
│         ║                    ║           │
│         ║    ◌ (spinner)     ║           │  flex items-center justify-center
│         ║                    ║           │  min-h-screen
│         ║  Carregando...     ║           │  bg-background
│         ║  (sr-only / live)  ║           │
│         ╚════════════════════╝           │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

### 8.2 Especificação do spinner

| Propriedade | Valor |
|---|---|
| Elemento | `<div>` circular |
| Tamanho | `h-10 w-10` (40px) |
| Borda | `border-4 border-border border-t-primary` |
| Forma | `rounded-full` |
| Animação | `animate-spin` |
| Reduced motion | `motion-reduce:animate-none` |
| ARIA | `aria-hidden="true"` |

### 8.3 Especificação do contêiner

| Propriedade | Valor |
|---|---|
| Layout | `flex flex-col items-center justify-center gap-4` |
| Altura mínima | `min-h-screen` |
| Fundo | `bg-background` |
| ARIA container | `role="status"` `aria-live="polite"` `aria-label="Carregando aplicação"` |

### 8.4 Texto para leitores de tela

```tsx
<span className="sr-only">Carregando aplicação...</span>
```

### 8.5 Estados visuais

| Estado | Visual |
|---|---|
| Padrão | Spinner `border-t-primary` sobre `border-border` |
| Reduced motion | Spinner estático (sem `animate-spin`) |
| Dark mode | Tokens se adaptam automaticamente |

---

## 9. Especificação visual — PendingApprovalScreen

### 9.1 Layout

```
┌──────────────────────────────────────────┐
│  bg-background                            │
│                                           │
│  flex flex-col items-center               │
│  justify-center min-h-screen px-6         │
│                                           │
│  ┌────────────────────────────────────┐   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║   [Clock icon h-16]    ║      │   │  ← Ícone grande, text-muted-foreground
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │  ← gap-6 entre seções
│  │    ╔════════════════════════╗      │   │
│  │    ║  Aguardando Aprovação  ║      │   │  ← text-2xl font-semibold text-foreground
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║  Sua conta foi criada  ║      │   │  ← text-sm text-muted-foreground text-center
│  │    ║  e está aguardando...  ║      │   │  ← max-w-sm
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║      [Botão Sair]      ║      │   │  ← Button variant="outline"
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### 9.2 Especificação de elementos

| Elemento | Classes / Props | Conteúdo |
|---|---|---|
| Contêiner raiz | `flex flex-col items-center justify-center min-h-screen px-6 gap-6 bg-background` | `role="main"` `aria-label="Aguardando aprovação"` |
| Ícone `Clock` | `h-16 w-16 text-muted-foreground` | `aria-hidden="true"` |
| Título | `text-2xl font-semibold text-foreground text-center` | "Aguardando Aprovação" |
| Descrição | `text-sm text-muted-foreground text-center max-w-sm` | "Sua conta foi criada e está aguardando aprovação do administrador. Você receberá acesso assim que for aprovado." |
| Botão "Sair" | `Button variant="outline"` | `onClick={signOut}` — `firebaseAuth.signOut()` |

### 9.3 Botão "Sair"

- Variante: `outline` (não destrutivo — o usuário não está sendo punido, apenas aguarda).
- Largura: `w-full max-w-xs` para mobile-friendly.
- Ícone opcional: `LogOut` do Lucide à esquerda do texto.
- Ação: chama `signOut` do Firebase Auth.

### 9.4 Nota sobre PRD-01

Esta é a versão **estática/placeholder**. PRD-01 adiciona:
- Botão "Atualizar Status" (checa Firestore novamente).
- Timestamp de quando a conta foi criada.
- Contato do admin.

---

## 10. Especificação visual — BlockedScreen

### 10.1 Layout

```
┌──────────────────────────────────────────┐
│  bg-background                            │
│                                           │
│  flex flex-col items-center               │
│  justify-center min-h-screen px-6         │
│                                           │
│  ┌────────────────────────────────────┐   │
│  │    ╔════════════════════════╗      │   │
│  │    ║  [ShieldOff icon h-16] ║      │   │  ← text-destructive
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║   Acesso Bloqueado     ║      │   │  ← text-2xl font-semibold text-foreground
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║  Sua conta foi         ║      │   │  ← text-sm text-muted-foreground text-center
│  │    ║  bloqueada. Entre em   ║      │   │
│  │    ║  contato com o admin.  ║      │   │
│  │    ╚════════════════════════╝      │   │
│  │                                    │   │
│  │    ╔════════════════════════╗      │   │
│  │    ║      [Botão Sair]      ║      │   │  ← Button variant="destructive"
│  │    ╚════════════════════════╝      │   │
│  └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### 10.2 Especificação de elementos

| Elemento | Classes / Props | Conteúdo |
|---|---|---|
| Contêiner raiz | `flex flex-col items-center justify-center min-h-screen px-6 gap-6 bg-background` | `role="main"` `aria-label="Acesso bloqueado"` |
| Ícone `ShieldOff` | `h-16 w-16 text-destructive` | `aria-hidden="true"` |
| Título | `text-2xl font-semibold text-foreground text-center` | "Acesso Bloqueado" |
| Descrição | `text-sm text-muted-foreground text-center max-w-sm` | "Sua conta foi bloqueada. Entre em contato com o administrador." |
| Botão "Sair" | `Button variant="destructive"` | Ação de logout |

### 10.3 Diferença visual em relação a PendingApprovalScreen

| Aspecto | Pending | Blocked |
|---|---|---|
| Ícone | `Clock` (neutro/cinza) | `ShieldOff` (vermelho/destructive) |
| Cor do ícone | `text-muted-foreground` | `text-destructive` |
| Botão | `variant="outline"` | `variant="destructive"` |
| Tom emocional | Informativo, aguardando | Definitivo, encerramento |

---

## 11. Responsividade — Tabela de comportamento

| Elemento | Mobile (< 768px) | Desktop (≥ 768px) |
|---|---|---|
| Header | `h-14`, visível | `h-14`, visível |
| BottomNav | `flex` (visível) | `hidden md:hidden` |
| SideNav | `hidden` | `md:flex` (visível) |
| `<main>` padding-bottom | `pb-20` | `md:pb-4` |
| `<main>` max-width | 100% | `max-w-4xl mx-auto` |
| LoadingScreen | Centralizado full-screen | Centralizado full-screen |
| PendingApprovalScreen | Full-screen, padding `px-6` | Idem (tela de estado, sem nav) |
| BlockedScreen | Full-screen, padding `px-6` | Idem |

---

## 12. Acessibilidade — Checklist completo

### 12.1 Skip link

- Localização: primeiro elemento filho do `AppShell` (antes do `<header>`).
- Texto: "Pular para o conteúdo principal".
- Comportamento: invisível por padrão (`sr-only`); aparece ao receber foco via Tab.
- Target: `<main id="main-content" tabIndex={-1}>`.

```
Classes do skip link:
- Inativo: sr-only
- Ao focar: focus:not-sr-only focus:absolute focus:top-4 focus:left-4
             focus:z-[100] focus:rounded-md focus:bg-background
             focus:px-4 focus:py-2 focus:text-sm focus:font-medium
             focus:ring-2 focus:ring-primary focus:shadow-md
```

### 12.2 Ordem de foco (Tab order)

1. Skip link
2. Header (título / itens focáveis)
3. SideNav — desktop (itens de nav em ordem: Início → Jogos → Palpites → Ranking → Perfil)
4. `<main>` (conteúdo)
5. BottomNav — mobile (itens de nav em ordem)

### 12.3 ARIA por componente

| Componente | Atributos obrigatórios |
|---|---|
| `AppShell` — skip link | `href="#main-content"` |
| `<header>` | `role="banner"` `aria-label="Cabeçalho da aplicação"` |
| `<main>` | `id="main-content"` `tabIndex={-1}` |
| BottomNav `<nav>` | `role="navigation"` `aria-label="Navegação principal"` |
| SideNav `<nav>` | `role="navigation"` `aria-label="Navegação lateral"` |
| Nav item (ativo) | `aria-current="page"` |
| Nav item (todos) | `aria-label="Ir para início"` etc. |
| Ícones decorativos | `aria-hidden="true"` |
| LoadingScreen container | `role="status"` `aria-live="polite"` `aria-label="Carregando aplicação"` |
| Spinner div | `aria-hidden="true"` |
| LoadingScreen texto | `className="sr-only"` — "Carregando aplicação..." |
| PendingApprovalScreen | `role="main"` `aria-label="Aguardando aprovação"` |
| BlockedScreen | `role="main"` `aria-label="Acesso bloqueado"` |

### 12.4 Reduced motion

Aplicar em todas as animações:
```
motion-reduce:animate-none   (spinner)
motion-reduce:transition-none (transições)
```

### 12.5 Contraste de cores

Todos os pares de texto/fundo usam tokens Shadcn que atendem WCAG AA:
- `text-foreground` sobre `bg-background`: ~21:1 (AAA) no light mode.
- `text-primary-foreground` sobre `bg-primary`: ~10:1 (AAA).
- `text-muted-foreground` sobre `bg-background`: ~4.5:1 (AA).
- `text-destructive` sobre `bg-background`: verificado pelo tema Shadcn.

---

## 13. Decisões visuais — Resumo

### 13.1 Estilo de navegação escolhido

**BottomNav + SideNav colapsado (ícones only)**

Justificativa:
- BottomNav é o padrão de facto para apps mobile sports (ESPN, FotMob, Google Sports).
- Thumb-friendly: 5 itens acessíveis com polegar no canto inferior da tela.
- SideNav colapsado (`w-16`) no desktop economiza espaço horizontal — conteúdo é o rei.
- Tooltip ao hover no SideNav mantém usabilidade sem sacrificar espaço.
- Consistência de ícones entre BottomNav e SideNav — mesma metáfora visual em ambas.

### 13.2 Paleta aplicada nesta tarefa

| Token | Aplicação nesta tarefa |
|---|---|
| `bg-background` | Fundo de todas as telas |
| `text-foreground` | Títulos, texto principal |
| `text-muted-foreground` | Ícones/rótulos inativos de nav, textos de suporte |
| `bg-background/95 backdrop-blur-sm` | Header e BottomNav (efeito glass) |
| `border-border` | Divisores de Header e BottomNav |
| `text-primary` | Item de nav ativo |
| `bg-primary rounded-lg` | Fundo de item ativo no SideNav |
| `text-primary-foreground` | Texto/ícone sobre item ativo no SideNav |
| `bg-accent` | Hover sutil no BottomNav ativo |
| `text-destructive` | Ícone ShieldOff no BlockedScreen |
| `border-t-primary` | Borda do spinner (parte animada) |
| `border-border` | Borda do spinner (parte estática) |

### 13.3 Tipografia aplicada

| Contexto | Classes |
|---|---|
| Título do app (Header) | `font-bold text-lg text-foreground` |
| Títulos das telas de estado | `text-2xl font-semibold text-foreground text-center` |
| Descrições das telas de estado | `text-sm text-muted-foreground text-center` |
| Rótulos de nav (BottomNav) | `text-xs font-medium` |

### 13.4 Espaçamento aplicado

| Contexto | Classes |
|---|---|
| Padding horizontal de página | `px-4` |
| Padding vertical de main | `py-4` |
| Padding bottom mobile | `pb-20` (acomoda BottomNav h-16 + gap) |
| Gap entre elementos de telas de estado | `gap-6` |
| Gap entre ícone e rótulo no BottomNav | `gap-1` |
| Padding itens BottomNav | `py-2 px-3` |
| Padding itens SideNav | `p-3` |

---

## 14. Componentes Shadcn utilizados

| Componente | Arquivo de origem | Uso nesta tarefa |
|---|---|---|
| `Button` | `@/components/ui/button` | Botão "Sair" em PendingApprovalScreen e BlockedScreen |
| `Tooltip` + `TooltipTrigger` + `TooltipContent` | `@/components/ui/tooltip` | Tooltip de rótulo no SideNav |

> Se `Tooltip` não estiver instalado: `npx shadcn@latest add tooltip` (TASK-02 pode não ter incluído).

---

## 15. Referências de design

- `design-system/MASTER.md` — tokens canônicos, tipografia, espaçamento, componentes.
- `ai/spec/task-11.md` — especificação técnica de props, interfaces, lógica de estado.
- `src/app/globals.css` — definição real dos tokens CSS em oklch().
- Shadcn UI docs — variantes de Button, padrão de Tooltip.
- WCAG 2.1 AA — contraste, áreas de toque (2.5.5), focus visible (2.4.7).

---

## 16. Notas para o `/implement`

1. **Instalar Tooltip** do Shadcn se não presente: `npx shadcn@latest add tooltip`.
2. **`TooltipProvider`** deve envolver o `SideNav` (ou estar no provider global).
3. O **slot direito do Header** deve ser um `<div>` vazio com `aria-label="Ações do usuário"` — PRD-01 preenche com avatar.
4. O **`usePathname()`** do Next.js é usado para detectar item ativo — importar de `next/navigation`.
5. **`useRouter().push()`** dentro de `useEffect` no AuthGuard — nunca `redirect()` do servidor em Client Components.
6. A **`LoadingScreen`** é renderizada como primeiro estado do AuthGuard — garante zero flash de conteúdo protegido.
7. Os **placeholders de rota** (`/matches`, `/predictions`, `/rankings`, `/profile`) podem ser Server Components mínimos retornando `null` ou um `<div>` temporário.
8. **`aria-current="page"`** em itens de nav deve ser calculado via `usePathname().startsWith(href)` para funcionar em sub-rotas.
