# SCREEN — APROVACAO-USUARIOS TASK-05: Gating de acesso admin (route guard + entrada de nav role-gated)

> Origem: `ai/plan/aprovacao-usuarios.md` §3 TASK-05 · PRD: `ai/prd/aprovacao-usuarios.md` (decisão A3 — painel admin EXCLUSIVO `role === "admin"`, defesa em 3 camadas) · Contrato visual: `design-system/MASTER.md` (§9 navegação, §10 acessibilidade).
> Mocks fonte-de-verdade: `docs/prd-01-2/03-pendentes-admin.png` (painel admin) e `docs/prd-01-2/05-usuario-aprovado.png` (home do aprovado).
>
> **Escopo desta tela:** SOMENTE camadas 1 e 2 da defesa em profundidade (A3): (1) **ponto de entrada de navegação** para `/admin` que aparece *apenas* quando `role === "admin"`; (2) **route guard** em `/admin` que barra/redireciona não-admin mesmo via URL direta. A camada 3 (Firestore Rules) já existe (TASK-01) e é a autoridade real — esta tela é defesa em profundidade, não substitui as rules. **Não** desenha o conteúdo do painel (tabs/lista = TASK-06).

---

## 0. Leitura dos mocks (decide a forma da entrada)

| Mock | O que mostra | Implicação para a entrada admin |
|------|--------------|----------------------------------|
| 03 (painel admin) | BottomNav **padrão de 5 itens** (Home/Jogos/Palpites/Ranking/Perfil), **sem** item "Admin". Hambúrguer no topo-esquerdo + busca no topo-direito. | A entrada admin **NÃO** está no BottomNav nos mocks. |
| 05 (home do aprovado) | BottomNav padrão de 5 itens. Topo-direito: sino + **avatar circular** (menu do usuário). | O acesso a áreas extra parte do **menu do usuário no Header**, não da nav inferior. |

**Conclusão de design (recomendação travada):** a entrada admin é um **item no menu do usuário no Header** (slot reservado em `Header.tsx`, MASTER §9.4 "Conteúdo direito: slot reservado para avatar/menu do usuário"), renderizado **condicionalmente** quando `role === "admin"`. **Não** adicionar um 6º item ao `NAV_ITEMS`/BottomNav. Justificativa detalhada em `ai/spec/aprovacao-usuarios-task-05.md` §3.

> Decisão de granularidade: a TASK-05 entrega o **gating** (guard + condição de visibilidade da entrada). Se o menu de usuário do Header ainda não existir como componente, esta task adiciona o **mínimo viável**: um menu/ação no slot direito do Header com um único item "Painel admin" visível só para admin. O menu de usuário completo (perfil/sair/tema) é PRD futuro — aqui só garantimos o ponto de entrada role-gated sem quebrar foco/aria.

---

## 1. Fluxo de navegação

```
┌─ Usuário admin (role==="admin", status==="approved") ─────────────┐
│  Header (slot direito) → menu do usuário → item "Painel admin"     │
│     │  visível APENAS para admin (role==="admin")                  │
│     ▼                                                              │
│  next/link → /admin                                                │
│     ▼                                                              │
│  (app)/admin/layout.tsx  →  AdminGuard                             │
│     loading? → mantém LoadingScreen (sem flash)                    │
│     role==="admin"? → renderiza children (painel, TASK-06)         │
└────────────────────────────────────────────────────────────────────┘

┌─ Usuário comum (role==="user") ────────────────────────────────────┐
│  Header → menu do usuário → SEM item "Painel admin"  (camada 1)     │
│  Digita /admin na URL direta:                                      │
│     ▼                                                              │
│  (app)/admin/layout.tsx → AdminGuard                               │
│     loading? → LoadingScreen                                       │
│     role!=="admin" → router.replace("/home")  (camada 2)           │
│     enquanto redireciona → renderiza null (não vaza painel)         │
└────────────────────────────────────────────────────────────────────┘
```

Ordem de guards (load-bearing): `AuthGuard` (no `(app)/layout.tsx`) já garante que só usuários **autenticados + approved** chegam a qualquer rota de `(app)`, incluindo `/admin`. O `AdminGuard` roda **dentro** desse contexto e adiciona só a checagem de `role`. Logo o `AdminGuard` pode assumir `firebaseUser != null` e `status === "approved"`, e precisa decidir apenas sobre `role`. (Ver contrato exato no SPEC §4.)

---

## 2. Onde o ponto de entrada admin aparece

### 2.1 Menu do usuário no Header (slot direito) — RECOMENDADO

- **Local:** `src/components/layout/Header.tsx`, `<div aria-label="Ações do usuário">` (slot já reservado, hoje vazio).
- **Visibilidade:** o item "Painel admin" é renderizado **somente** se `role === "admin"` (lido via `useAuth()`). Para `role !== "admin"` o item simplesmente não existe no DOM (não é `hidden`/`disabled` — não vaza a existência da rota).
- **Forma visual:** ícone `ShieldCheck` (lucide-react) + rótulo "Painel admin", como `<Link href="/admin">` dentro de um menu (DropdownMenu se já disponível) ou, na entrega mínima, um botão-ícone `ghost` direto no Header com `aria-label="Painel admin"`. O `Button` do projeto é **Base UI** — usar a prop `render` (não `asChild`) para envolver o `<Link>`, e `className="size-11"` (44px) em vez de `size="icon"` (32px). Ver SPEC §5.
- **Estado ativo:** quando `pathname.startsWith("/admin")`, marcar `aria-current="page"` (paridade com BottomNav/SideNav, MASTER §10.3).

### 2.2 Por que NÃO no BottomNav/`NAV_ITEMS`

- Os mocks 03/05 mostram o BottomNav com exatamente 5 itens; um 6º item "Admin" **quebraria o layout** (`flex-1` divide o espaço; 6 itens reduzem a largura de toque por item, arriscando o mínimo de 44px da MASTER §10.2).
- `NAV_ITEMS` é um array **estático compartilhado** por BottomNav e SideNav; condicioná-lo por `role` exigiria tornar os dois componentes role-aware e introduzir um item que aparece/some — risco de "salto" de layout e de quebra de ordem de foco para a maioria (usuários comuns) por causa de uma minoria (admins).
- A entrada admin é **funcionalmente um atalho administrativo**, não uma seção primária do app de bolão — pertence ao menu do usuário (contexto secundário), não à nav primária.

> Alternativa registrada (não recomendada): item condicional em `NAV_ITEMS`. Só seria aceitável se filtrado por `role` **e** se o BottomNav garantisse `min-h-[44px] min-w-[44px]` com 6 itens (apertado em telas ~360px). Descartada por densidade e por divergir do mock. Ver SPEC §3 para o trade-off completo.

---

## 3. Estados da tela (guard `/admin`)

O `AdminGuard` espelha o padrão do `AuthGuard` (`src/components/layout/AuthGuard.tsx`): **trata `loading` ANTES de decidir** para evitar flash de conteúdo (R3 do plano).

| Estado | Condição | Render | Notas a11y |
|--------|----------|--------|------------|
| **Loading** | `loading === true` | `<LoadingScreen />` (mesmo componente do AuthGuard) | `role="status"` `aria-live="polite"` (já no LoadingScreen) |
| **Autorizado** | `!loading && role === "admin"` | `children` (painel TASK-06) | foco natural; `<main>` do AppShell recebe foco |
| **Negado / redirect** | `!loading && role !== "admin"` | `null` enquanto `router.replace("/home")` resolve | nada é pintado → não vaza painel admin |

- **Sem flash:** enquanto `loading`, **nunca** renderizar `children` nem disparar redirect (espelha `AuthGuard` linhas 31-43/46-49). O redirect só é decidido após `loading === false`.
- **Redirect destino:** `/home` (rota approved padrão). Usar `router.replace` (não `push`) para não deixar `/admin` no histórico de um não-admin (evita voltar e re-tentar).
- **Renderizar `null` durante o redirect:** igual ao `AuthGuard` para `pending`/sem-auth — o efeito navega e o componente retorna `null` no meio-tempo (sem piscar o painel).

---

## 4. Acessibilidade (MASTER §10 — nível enhanced)

- **Entrada no Header:**
  - Item/botão admin é focável por teclado na ordem natural do Header (após o título). **Sem `tabIndex` positivo** (MASTER §10.5).
  - Nome acessível: rótulo visível "Painel admin"; se for botão-ícone sem texto, `aria-label="Painel admin"` (MASTER §7 — ícone funcional sem texto exige `aria-label`).
  - Ícone `ShieldCheck` decorativo quando há texto: `aria-hidden="true"`. Funcional (só ícone): vira `aria-label` no controle.
  - `aria-current="page"` quando em `/admin` (MASTER §10.3).
  - Área de toque ≥ 44×44px (MASTER §10.2): botão-ícone com `min-h-[44px] min-w-[44px]` ou `h-11 w-11`.
- **Item condicional NÃO quebra ordem de foco:** como o item admin é o único elemento extra do slot direito e fica **no fim** da ordem do Header, sua presença/ausência não reordena os controles anteriores. Para o usuário comum a ordem de foco é idêntica à de hoje (slot vazio).
- **Guard / redirect:**
  - Durante `loading`, o `LoadingScreen` já anuncia carregamento (`role="status"`); o foco não é movido para conteúdo inexistente.
  - No redirect, como nada é renderizado (`null`), não há armadilha de foco nem leitura de conteúdo proibido.
- **Reduced motion:** sem animações novas nesta task; transições herdadas do Header/menu respeitam `motion-reduce:*` (MASTER §10.6 / §12).

---

## 5. Referência a tokens / contrato visual (MASTER.md)

- **Header:** `h-14` (56px), `fixed top-0`, `bg-background/95 backdrop-blur-sm border-b border-border`, `px-4` (MASTER §9.4) — **não alterar**; só preencher o slot direito.
- **Item admin (menu/botão):**
  - Ícone Lucide `size={20}` (UI geral) ou `size={16}` inline com texto (MASTER §7).
  - Variante de botão: `ghost` (ícone de nav / ação inline — MASTER §8 "Variantes do Button").
  - Cor padrão herdada via `currentColor`; ativo `text-primary`, inativo `text-foreground`/`text-muted-foreground` (MASTER §3.4, §9.2). **Sem hexadecimais, sem estilo inline** (MASTER §14/§15).
  - Raio: se menu/dropdown, `rounded-lg` (MASTER §5); se card de menu, `shadow-lg` (elevação 3 — dropdown, MASTER §6).
  - Z-index do menu aberto: `z-[100]` (modal overlay, MASTER §13).
- **LoadingScreen:** reusado como está (já segue MASTER §7 estado "Carregando").
- **Focus ring:** `ring-2 ring-ring ring-offset-2` em todo elemento focável (MASTER §10.5) — Shadcn `Button` já aplica.

---

## 6. Divergências conhecidas vs mock (intencionais)

- **Mocks não desenham explicitamente um item "Painel admin".** O mock 03 mostra um **hambúrguer** no topo-esquerdo e o 05 um **avatar** no topo-direito; nenhum rotula a entrada admin. Interpretação: o acesso administrativo parte do **menu do usuário** (avatar/hambúrguer), coerente com o slot reservado da MASTER §9.4. Materializamos esse acesso como item role-gated no slot direito do Header.
- **BottomNav permanece com 5 itens** em todas as telas internas (mocks 03/05), inclusive para admin — o acesso ao painel **não** ocupa a nav primária.
- **Conteúdo do painel (tabs/lista/contadores)** NÃO é desta tela — é TASK-06 (`/screen` próprio). Aqui só garantimos que o admin **chega** ao `/admin` e o não-admin **não**.

---

## 7. Checklist de aceite visual/UX (resumo)

1. Admin vê o item "Painel admin" no menu do usuário (Header) e clicando navega para `/admin`.
2. Usuário comum **não** vê o item (ausente do DOM, não apenas escondido).
3. Acessando `/admin` por URL direta: admin entra; não-admin é redirecionado a `/home` sem piscar o painel.
4. Durante `loading`, exibe `LoadingScreen` (sem flash de conteúdo admin) — paridade com `AuthGuard`.
5. Entrada admin: foco por teclado, `aria-label`/rótulo, `aria-current` em `/admin`, toque ≥44px.
6. BottomNav segue com 5 itens; nenhum item novo nem salto de layout para usuário comum.
