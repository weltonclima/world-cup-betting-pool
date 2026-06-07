# SCREEN — APROVACAO-USUARIOS TASK-06: Painel admin (tabs + lista + contadores, read-only)

> Origem: `ai/plan/aprovacao-usuarios.md` §3 TASK-06 · PRD: `ai/prd/aprovacao-usuarios.md` (telas 03/05) · Contrato visual: `design-system/MASTER.md` (§2 cores, §3 tipografia, §4 espaçamento, §5 raio, §9 nav/header, §10 acessibilidade).
> Mocks fonte-de-verdade: `docs/prd-01-2/03-pendentes-admin.png` (painel admin / tab Pendentes) e `docs/prd-01-2/05-usuario-aprovado.png` (home aprovado — confirma BottomNav + AppShell na zona admin).
> Predecessoras consumidas: TASK-03 (hooks `useUsersByStatus`/`useUserStatusCounts`, JÁ implementados em `src/features/admin/`), TASK-04 (primitivos `Tabs`/`Badge`/`Avatar`, JÁ em `src/components/ui/`), TASK-05 (`AdminGuard` em `(app)/admin/layout.tsx`, JÁ implementado — **não tocar**).
>
> **Escopo desta tela:** o conteúdo do painel `/admin` — header de página, **3 tabs com contador** (Pendentes/Aprovados/Bloqueados), **lista de usuários por tab** (avatar com iniciais, nome, email, data de cadastro) e os **estados loading/empty/erro** por tab. Render **puro/read-only**: **SEM** botões Aprovar/Rejeitar/Bloquear/Desbloquear (isso é TASK-07) — mas com o **slot de ação** já reservado na composição. A page substitui o placeholder `src/app/(app)/admin/page.tsx`.

---

## 0. Leitura do mock (decide layout, hierarquia e divergências)

Mock `03-pendentes-admin.png` (mobile, ~360px), de cima para baixo:

| Região | O que o mock mostra | Decisão para esta tela |
|--------|---------------------|------------------------|
| Topbar | Hambúrguer (esq.) + título "Usuários Pendentes" + busca (dir.) | O **Header global** (`AppShell`) já cobre a topbar (logo + slot direito). O título "Usuários Pendentes" do mock vira **header de página** (`<h1>`) dentro do `<main>`, **não** sobrescreve o Header global. Busca **fora de escopo** (não há requisito; <100 usuários). |
| Tabs | "Pendentes `3`" · "Aprovados `52`" · "Bloqueados `1`" — tab ativa sublinhada em verde, contadores em pílula | `Tabs` do projeto (Base UI) com 3 `TabsTab`; cada um traz um `Badge` com o contador de `useUserStatusCounts()`. |
| Lista | Cards/linhas: avatar circular colorido com **iniciais** (JS, MS, PR), nome em negrito, email em cinza, data `15/06/2026 14:32` abaixo | `UserList` → `UserListItem`: `Avatar`+`AvatarFallback` (iniciais), nome (`text-foreground`), email (`text-muted-foreground`), data formatada via date-fns. |
| Ações | Botões "Aprovar" (verde) + "Rejeitar" (vermelho) à direita de cada linha | **TASK-07.** Aqui só fica o **slot** (`actions?: ReactNode`) reservado à direita do item; sem botões renderizados. |
| BottomNav | 5 itens (Home/Jogos/Palpites/Ranking/Perfil) | Vem do `AppShell` (telas 03/05 têm nav). `/admin` está em `(app)` → herda Header + BottomNav + `AuthGuard`. Nada a fazer aqui. |

**Divergências intencionais vs mock (documentadas em §8):** busca da topbar não implementada; avatar do mock usa cores chapadas variadas (verde/amarelo/azul) — reinterpretadas como **cor determinística por usuário** a partir de uma paleta de **tokens** do tema (sem hexadecimais — MASTER §2/§15); botões de ação ausentes (TASK-07).

---

## 1. Hierarquia visual e layout (mobile-first)

```
(app)/admin/page.tsx  → dentro de AppShell <main> (px-4 py-4 pb-20 md:pb-4, max-w-4xl mx-auto)
│
└─ <UsersPanel>                              (client component — orquestra tabs + listas)
   ├─ <header>                               (header de PÁGINA, não o Header global)
   │   └─ <h1> "Usuários"                    (text-2xl font-semibold — MASTER §3.2 Heading 1)
   │
   └─ <Tabs defaultValue="pending">          (Base UI Tabs — roving focus/arrows nativos)
      ├─ <TabsList>                          (3 tabs, w-full — ocupa a largura no mobile)
      │   ├─ <TabsTab value="pending">  Pendentes  <Badge>{counts.pending}</Badge>
      │   ├─ <TabsTab value="approved"> Aprovados  <Badge>{counts.approved}</Badge>
      │   └─ <TabsTab value="blocked">  Bloqueados <Badge>{counts.blocked}</Badge>
      │
      ├─ <TabsPanel value="pending">  <UserStatusList status="pending"  /></TabsPanel>
      ├─ <TabsPanel value="approved"> <UserStatusList status="approved" /></TabsPanel>
      └─ <TabsPanel value="blocked">  <UserStatusList status="blocked"  /></TabsPanel>

<UserStatusList status>                       (1 hook useUsersByStatus(status) → decide estado)
   ├─ loading → <UserListSkeleton />          (3–4 linhas skeleton)
   ├─ error   → <UserListError onRetry />     (mensagem + "Tentar novamente")
   ├─ empty   → <UserListEmpty status />      (ícone + texto contextual por status)
   └─ data    → <UserList users>
                  └─ <UserListItem user> × N  (avatar+nome+email+data, + slot actions)
```

- **Densidade:** lista compacta (MASTER §1 "densidade média") — itens separados por `border-b border-border`, `gap-2` interno (MASTER §4.2 "Gap entre itens de lista"). Cada item `py-3` para folga vertical e alvo de toque confortável.
- **Largura:** `max-w-4xl mx-auto` já vem do `AppShell`; a lista ocupa 100% no mobile e fica confortável no desktop sem layout adicional.
- **Mobile-first:** nenhuma variante `md:` é necessária para funcionar; a tela é a mesma em todos os breakpoints (a única adaptação de nav — BottomNav↔SideNav — já é do `AppShell`). `TabsList` usa `grid grid-cols-3` (ou `w-full` + `flex-1` por tab — o `TabsTab` do projeto já é `flex-1`) para os 3 rótulos caberem lado a lado em ~360px sem overflow.

---

## 2. Componentes e composição

Todos novos em `src/features/admin/components/` (ver árvore exata no SPEC §3). Totalmente tipados, sem `any`, sem estilo inline.

| Componente | Responsabilidade | Reusa |
|---|---|---|
| `UsersPanel` | Orquestra header de página + `Tabs` + contadores. Único `"use client"` que lê `useUserStatusCounts()`. | `Tabs/TabsList/TabsTab/TabsPanel`, `Badge` |
| `StatusTabBadge` (interno ou inline) | Pílula de contagem ao lado do rótulo da tab. | `Badge` (variante por estado, §4) |
| `UserStatusList` | Recebe `status`, chama `useUsersByStatus(status)`, decide loading/error/empty/data. **Fronteira de dados de cada tab.** | hook TASK-03 |
| `UserList` | Render puro de `User[]` → `<ul>` de `UserListItem`. Sem hook (recebe `users` por prop). | — |
| `UserListItem` | Uma linha: `Avatar`(iniciais) + nome + email + data + **slot `actions`**. Componente **read-only e reutilizável** (TASK-07 injeta os botões via `actions`). | `Avatar`, `AvatarFallback` |
| `UserListSkeleton` | Placeholder de carregamento (linhas com `animate-pulse`). | — |
| `UserListEmpty` | Estado vazio por `status` (ícone Lucide + texto). | `lucide-react` |
| `UserListError` | Estado de erro + botão "Tentar novamente" (`onRetry`). | `Button` |
| `getInitials(name)` | Util pura de derivação de iniciais. | — (em `lib`/local) |
| `getAvatarVariant(uid)` | Util pura: `uid → variante de cor` (paleta de tokens). | — |

> **Por que `UserStatusList` separado de `UserList`:** isola a borda de dados (hook + estados) do render puro da lista. `UserList` fica testável sem React Query e reutilizável; `UserStatusList` concentra o `useUsersByStatus`. Espelha o padrão "componente de dados fino + componente de apresentação puro".

---

## 3. Derivação de iniciais (avatar — sem upload)

Regra determinística e pura (`getInitials(name: string): string`), aplicada sobre `user.name` (mock: "João da Silva" → **JS**; "Maria Santos" → **MS**; "Pedro Ramos" → **PR**):

1. `trim` + colapsar espaços; dividir por espaço em palavras não vazias.
2. **0 palavras** (nome vazio — não deve ocorrer: `userSchema` exige `nonEmptyString`): fallback `"?"`.
3. **1 palavra**: as **2 primeiras letras** dela em maiúsculo (ex.: "João" → "JO"); se tiver 1 letra, só ela.
4. **≥2 palavras**: **primeira letra da primeira palavra + primeira letra da última palavra**, maiúsculas (ex.: "João da Silva" → "JS", ignorando partículas do meio).
5. Resultado sempre **`.toUpperCase()`**, no máximo 2 caracteres.
6. Usar `name` (não `nickname`/`email`) por casar com o mock; documentar no SPEC que a fonte é `user.name`.

> Locale: usar `.toLocaleUpperCase("pt-BR")` é desnecessário aqui (letras latinas básicas); `.toUpperCase()` simples basta e é determinístico. Sem dependência de Intl.

---

## 4. Mapeamento status → variante (badge) e cor do avatar

### 4.1 Badge de contagem nas tabs (decisão de variante)

O `Badge` do projeto já tem variantes de tema (`default`/`secondary`/`destructive`/`outline`/`muted`). Decisão **semântica, neutra e legível** (o contador é informação, não alarme):

| Tab | Variante do contador | Racional |
|---|---|---|
| Pendentes | `secondary` | Neutro de destaque suave; a tab ativa já recebe ênfase do próprio `Tabs` (sublinhado/seleção). |
| Aprovados | `secondary` | Idem — consistência entre tabs evita "semáforo" ruidoso no header. |
| Bloqueados | `destructive` | Único com carga semântica de alerta (MASTER §2 destructive = bloqueio); comunica gravidade do total sem cor chapada vermelha forte (`bg-destructive/10 text-destructive`). |

> **Decisão travada:** contador é `secondary` para Pendentes/Aprovados e `destructive` para Bloqueados. Alternativa rejeitada — todos `muted`: perderia o sinal de que "Bloqueados" é a categoria sensível. Alternativa rejeitada — `default` (primary preenchido): pesado demais para 3 pílulas no topo (MASTER §1 baixa distração).

### 4.2 Cor do avatar (iniciais) — **determinística por usuário, via tokens**

O mock usa cores variadas por usuário (verde/amarelo/azul). **Decisão travada:** a cor de fundo das iniciais é **determinística por `uid`** (mesmo usuário → sempre a mesma cor, em qualquer tab e re-render), derivada de uma **paleta de tokens do tema** — **nunca hexadecimais** (MASTER §2.1/§15) e **nunca estilo inline** (MASTER §14).

- **Função pura** `getAvatarVariant(uid: string): AvatarVariant` — hash estável simples do `uid` (soma de char codes, `% N`) → índice na paleta. Determinística e sem dependências.
- **Paleta = tokens de gráfico** já existentes no tema: `--chart-1..--chart-5` (MASTER §2.3), expostos como classes `bg-chart-1 text-…` etc. São 5 cores de tema, já com contraste validado para o projeto, sem introduzir hex novo. Mapeamento via objeto `Record<AvatarVariant, string>` de classes Tailwind (sem `style`):

  ```
  AvatarVariant = "c1" | "c2" | "c3" | "c4" | "c5"
  AVATAR_CLASSES: Record<AvatarVariant, string> = {
    c1: "bg-chart-1 text-primary-foreground",
    c2: "bg-chart-2 text-primary-foreground",
    c3: "bg-chart-3 text-primary-foreground",
    c4: "bg-chart-4 text-foreground",
    c5: "bg-chart-5 text-foreground",
  }
  ```
  (A combinação exata de foreground por chart é ajustada no SPEC para garantir contraste AA — ver SPEC §6/§9; se algum `chart-*` não der AA com `primary-foreground`, usar `text-foreground` correspondente. Validar no `/review` visual.)

- A classe escolhida é **mesclada no `AvatarFallback`** via `cn(...)` (sobrescreve o `bg-muted text-muted-foreground` default do primitivo). O `AvatarFallback` do projeto aceita `className` (MASTER §14 — só classes).

> **Decisão travada:** cor **determinística por `uid`** sobre paleta `--chart-1..5` (tokens). Alternativa rejeitada — **neutra única** (`bg-muted`): mais sóbria, porém perde a leitura rápida "por pessoa" do mock e a vivacidade da lista; descartada por divergir do mock sem ganho. Alternativa rejeitada — hash sobre `name`: instável se o usuário renomear; `uid` é imutável → cor estável por identidade.

> **Por que `uid` e não índice da lista:** índice mudaria a cor quando o usuário troca de posição/tab; `uid` mantém a identidade visual consistente entre as 3 tabs.

---

## 5. Estados por tab (loading / empty / erro / dados)

Cada `UserStatusList` deriva o estado de **um** `useUsersByStatus(status)` (`UseQueryResult<User[]>`). Ordem de checagem: `isPending` → `isError` → `data.length === 0` (empty) → lista.

| Estado | Condição (React Query) | Render | a11y |
|--------|------------------------|--------|------|
| **Loading** | `isPending` (ou `isLoading`) | `<UserListSkeleton />` — 3–4 linhas com `animate-pulse motion-reduce:animate-none` imitando avatar(círculo)+2 linhas de texto | container `role="status"` `aria-busy="true"` `aria-label="Carregando usuários"`; skeleton `aria-hidden` |
| **Erro** | `isError` | `<UserListError onRetry={() => refetch()} />` — ícone `TriangleAlert`, "Não foi possível carregar os usuários." + `Button` outline "Tentar novamente" | `role="alert"`; botão com nome acessível textual |
| **Vazio** | `!isPending && !isError && data.length === 0` | `<UserListEmpty status />` — ícone + texto **contextual**: Pendentes "Nenhum usuário aguardando aprovação."; Aprovados "Nenhum usuário aprovado ainda."; Bloqueados "Nenhum usuário bloqueado." | container `role="status"`; ícone `aria-hidden` |
| **Dados** | `data.length > 0` | `<UserList users={data} />` | `<ul>`/`<li>` semântico (§7) |

- **Granularidade dos estados:** por **tab**, não global. Trocar de tab não pisca a tela inteira; cada `TabsPanel` resolve seu próprio estado (e compartilha cache com o contador da tab — mesma `queryKey`, TASK-03).
- **Erro do contador:** `useUserStatusCounts()` já devolve `0` em loading/erro (default `?? 0` — TASK-03), então o badge nunca mostra `NaN`. Não há tratamento de erro extra para o badge; o erro "real" aparece no painel da tab via `UserListError`.
- **Sem ações:** nenhum estado renderiza botões de mutação. O `UserListItem` recebe `actions={undefined}` nesta task (TASK-07 passa os botões).

---

## 6. Anatomia do `UserListItem` (read-only + slot de ação)

```
<li> (flex items-center gap-3 border-b border-border py-3 last:border-b-0)
  ├─ <Avatar class=size-10>
  │     └─ <AvatarFallback class={cn("text-sm font-medium", AVATAR_CLASSES[variant])}>
  │            {initials}                       (ex.: "JS")
  ├─ <div class="min-w-0 flex-1">              (min-w-0 → trunca email longo)
  │     ├─ <p class="text-sm font-medium text-foreground truncate">{user.name}</p>
  │     ├─ <p class="text-sm text-muted-foreground truncate">{user.email}</p>
  │     └─ <p class="text-xs text-muted-foreground">{formattedCreatedAt}</p>
  └─ {actions ? <div class="flex shrink-0 items-center gap-2">{actions}</div> : null}
        └─ SLOT TASK-07: <UserActions user={user} /> (Aprovar/Rejeitar/Bloquear/Desbloquear)
```

- **Tipografia (MASTER §3.2):** nome = Body `text-sm font-medium`; email = Body `text-sm` muted; data = Body Small `text-xs` muted (metadado/timestamp). Avatar `size-10` (40px, default do primitivo).
- **Truncamento:** `min-w-0` + `truncate` no bloco central evita que email/nome longos empurrem o avatar ou o slot de ação (importante no mobile estreito).
- **Slot `actions`:** `actions?: ReactNode`. Quando ausente (TASK-06), o `<div>` de ações não é renderizado e o item fica read-only. **Ponto de extensão único e explícito** para TASK-07 — nenhuma outra mudança no item será necessária.

---

## 7. Acessibilidade (MASTER §10 — nível enhanced)

- **Tabs (roving focus):** o `Tabs` do projeto é Base UI → já entrega `role="tablist"`/`role="tab"`/`role="tabpanel"`, `aria-selected`, `aria-controls`/`aria-labelledby`, **roving tabindex** e navegação por **setas** (←/→) nativos. **Não** reimplementar teclado. Cada `TabsPanel` recebe foco (`outline` visível via `focus-visible:ring-3 ring-ring/50`, já no primitivo).
- **Contador no rótulo da tab:** o `Badge` é decorativo-textual dentro do `TabsTab`; o número fica no nome acessível da tab ("Pendentes 3"). Aceitável e informativo. (Opcional: `aria-label="Pendentes, 3 usuários"` no `TabsTab` para leitura mais natural — registrado como refino no SPEC.)
- **Lista semântica:** `UserList` usa `<ul>` e cada item `<li>` — navegável por leitor de tela como lista; contagem anunciada. Nome do usuário é o conteúdo textual primário do item.
- **Estados:** loading `role="status"`/`aria-busy`; erro `role="alert"`; vazio `role="status"`. Ícones decorativos `aria-hidden="true"` (MASTER §7).
- **Contraste:**
  - Texto: nome `text-foreground`, email/data `text-muted-foreground` — ambos ≥ AA sobre `bg-background` (tokens do tema, MASTER §10.1).
  - **Avatar:** as iniciais sobre `bg-chart-*` precisam de ≥ AA (3:1 p/ texto grande/bold pequeno). A combinação `chart→foreground` é fixada no SPEC §6 e marcada para verificação no `/review` visual; se algum par falhar, trocar o foreground daquele índice. **Nunca** introduzir cor fora do tema para "consertar" contraste (MASTER §10.1).
  - Badge `destructive` = `text-destructive` sobre `bg-destructive/10` (já AA no tema).
- **Toque:** itens de lista não são interativos nesta task (sem ação) → sem requisito de 44px aqui; quando TASK-07 adicionar botões no slot, eles seguem `h-...`/área mínima da MASTER §10.2 (responsabilidade da TASK-07).
- **Reduced motion:** skeleton `animate-pulse motion-reduce:animate-none`; transições de tab herdam `transition-colors` do primitivo (respeita `motion-reduce` — MASTER §10.6/§12).
- **Foco:** sem `tabIndex` positivo; ordem natural skip-link → Header → (SideNav) → main(tabs→painel) → BottomNav (MASTER §10.5). `<main>` já recebe foco via `AppShell`.

---

## 8. Tokens / contrato visual (MASTER.md) e divergências

**Tokens usados (todos do tema — zero hexadecimal, zero `style`):**
- Layout/superfície: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border` (MASTER §2.1).
- Tabs: classes do primitivo (`bg-muted`, `data-selected:bg-background`...) — não sobrescrever cor.
- Badge: variantes `secondary`/`destructive` (MASTER §2 / componente).
- Avatar: paleta `bg-chart-1..5` (MASTER §2.3) + `text-primary-foreground`/`text-foreground`.
- Tipografia: `text-2xl font-semibold` (h1), `text-sm`/`text-xs` (MASTER §3.2).
- Espaçamento: `gap-2/3`, `py-3`, herdando `px-4 py-4 pb-20` do `AppShell` (MASTER §4).
- Raio: avatar `rounded-full` (primitivo), tabs `rounded-lg`/`rounded-md` (primitivo) (MASTER §5).
- Ícones Lucide `size={…}` (estados vazio/erro), `aria-hidden` (MASTER §7).

**Divergências intencionais vs mock (`03`):**
1. **Busca** da topbar (lupa) — **não** implementada (sem requisito; <100 usuários, sem paginação/filtro textual no PRD). Registrada como possível PRD futuro.
2. **Botões Aprovar/Rejeitar** — ausentes nesta task (TASK-07). O mock mostra-os; aqui só o slot.
3. **Título da página** — mock mostra "Usuários Pendentes" (rótulo da tab ativa) na topbar; usamos `<h1>` "Usuários" estável dentro do `<main>` (o Header global já é a topbar). O contexto da tab ativa fica nas tabs, não no `<h1>` — evita `<h1>` que muda ao trocar de aba.
4. **Cores chapadas do avatar** → reinterpretadas como paleta de **tokens** determinística (§4.2).

---

## 9. Checklist de aceite visual/UX (resumo)

1. `/admin` (já gateado por `AdminGuard`) renderiza dentro do `AppShell` com BottomNav (mobile) / SideNav (desktop) — paridade com mocks 03/05.
2. 3 tabs (Pendentes/Aprovados/Bloqueados), cada uma com `Badge` de contagem vindo de `useUserStatusCounts()`; Bloqueados em `destructive`, demais `secondary`.
3. Tab ativa muda o painel exibido; navegação por setas e foco visível funcionam (Base UI).
4. Lista por tab: avatar com **iniciais derivadas de `user.name`**, nome, email, data `dd/MM/yyyy HH:mm` (date-fns); cor do avatar **determinística por `uid`** sobre tokens `chart-*`.
5. Cada tab resolve **loading (skeleton)**, **erro (com retry)** e **vazio (texto contextual)** independentemente.
6. **Nenhum** botão de ação renderizado; `UserListItem` expõe slot `actions` pronto para TASK-07.
7. Sem hexadecimais, sem `style={{}}`, sem `any`; texto e avatar ≥ WCAG AA (avatar verificado no `/review`).
8. Truncamento de nome/email longo não quebra o layout no mobile (~360px).
