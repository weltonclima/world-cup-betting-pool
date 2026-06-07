# SPEC — TASK-05 · Gating de acesso admin (route guard + nav role-gated)

> Origem: `ai/plan/aprovacao-usuarios.md` §3 TASK-05 · PRD: `ai/prd/aprovacao-usuarios.md` (decisão A3) · Screen: `ai/screen/aprovacao-usuarios-task-05.md` · Contrato visual: `design-system/MASTER.md`.
> Tipo: application / ui · SP: 3 · Criticality: high · Risk: medium · TDD: no (cobertura no `/test`) · Screen: yes (web).
>
> **Defesa em profundidade (A3):** esta task entrega as camadas **1** (entrada de nav role-gated) e **2** (route guard `/admin`). A camada **3** (Firestore Rules) já existe (TASK-01) e é a **autoridade real** de segurança. Guard + nav são UI/UX — **não** substituem as rules.

## 1. Objetivo

Tornar o painel `/admin` exclusivo de `role === "admin"` no client:
1. **Route guard** em `/admin`: libera só `role === "admin"`; redireciona qualquer outro (`role === "user"` ou `role === null`) para `/home`, **mesmo via URL direta**. Trata `loading` antes de decidir (espelha `AuthGuard` — sem flash de conteúdo, R3 do plano).
2. **Entrada de navegação** para `/admin` renderizada **somente** quando `role === "admin"` — invisível (ausente do DOM) para os demais.

Fora de escopo: o conteúdo do painel (tabs/lista/contadores = TASK-06); ações de moderação/modal (TASK-07); qualquer alteração em `AuthGuard`, `AuthProvider`, `NAV_ITEMS` semântico de nav primária, ou nas rules.

## 2. Arquivos

### 2.1 Criar

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/layout/AdminGuard.tsx` | Client Component: guard de `role` que envolve as rotas `/admin`. Espelha o padrão de `AuthGuard`. |
| `src/app/(app)/admin/layout.tsx` | Layout do segmento `/admin` que envolve `children` com `<AdminGuard>`. |

> Por que **layout** e não embutir o guard só na `page.tsx`: o guard no `layout.tsx` do segmento cobre `/admin` **e** qualquer sub-rota futura (`/admin/...`) por composição do App Router, sem repetir a checagem. O `(app)/layout.tsx` pai (AuthGuard + AppShell) já envolve `/admin` — o `admin/layout.tsx` aninha **apenas** o `AdminGuard` em volta do `children` (NÃO re-renderiza AppShell; herda do pai). As telas 03/05 têm nav, então `/admin` deve permanecer dentro do AppShell do `(app)/layout.tsx`.

### 2.2 Alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/Header.tsx` | Preencher o slot direito (`<div aria-label="Ações do usuário">`) com a entrada admin role-gated (ver §5). Vira `"use client"` se ainda não for (precisa de `useAuth`/`usePathname`). |

### 2.3 Criar (página placeholder mínima, se TASK-06 ainda não existir)

- `src/app/(app)/admin/page.tsx` — **opcional nesta task**. TASK-06 cria o painel real. Para validar o gating isoladamente (sem link morto), pode existir um placeholder mínimo (`<h1>Painel admin</h1>`). Se TASK-06 for executada em sequência, ela substitui a page; o `layout.tsx` (guard) permanece. **Coordenar com TASK-06** para não duplicar/sobrescrever.

## 3. Decisão: forma da entrada de navegação (NAV_ITEMS vs Header menu)

**Escolha: item no menu do usuário do Header (slot direito), NÃO item em `NAV_ITEMS`/BottomNav.**

| Critério | `NAV_ITEMS` (Bottom/SideNav) | **Header menu (escolhido)** |
|----------|------------------------------|------------------------------|
| Fidelidade ao mock (03/05) | ✗ Mocks têm 5 itens fixos; sem "Admin" na nav inferior | ✓ Mocks mostram avatar/menu no topo; slot reservado MASTER §9.4 |
| Toque ≥44px (MASTER §10.2) | ✗ 6º item aperta `flex-1` em ~360px (risco <44px) | ✓ Botão-ícone dedicado `h-11 w-11` |
| Ordem de foco para a maioria | ✗ Item que aparece/some reordena nav da maioria (users) | ✓ Item extra no fim do Header; ordem dos users inalterada |
| Complexidade | ✗ Torna `NAV_ITEMS` role-aware (array estático compartilhado) → BottomNav+SideNav role-aware | ✓ Condição local de `role` só no Header |
| Semântica | ✗ Mistura atalho admin com seções primárias do bolão | ✓ Admin é contexto secundário (menu do usuário) |

Implementação concreta: a condição é `role === "admin"` lida via `useAuth()`. Para `role !== "admin"`, o item **não é renderizado** (retorno condicional → ausente do DOM), não `hidden`/`disabled` (não vaza a existência da rota; defesa em profundidade alinhada às rules).

## 4. Contrato do `AdminGuard`

### 4.1 Assinatura

```ts
interface AdminGuardProps {
  children: ReactNode;
}
export function AdminGuard({ children }: AdminGuardProps): ReactNode;
```

### 4.2 Lógica (espelha `AuthGuard`)

Consome `const { loading, role } = useAuth();` e `const router = useRouter();`.

```ts
useEffect(() => {
  if (loading) return;            // aguarda resolução antes de decidir (sem flash)
  if (role !== "admin") {
    router.replace("/home");      // replace: não deixa /admin no histórico do não-admin
  }
}, [loading, role, router]);

if (loading) return <LoadingScreen />;   // mesmo componente do AuthGuard
if (role !== "admin") return null;       // enquanto o redirect resolve, não pinta o painel
return <>{children}</>;                   // role === "admin"
```

Regras do contrato:
- **`loading` é tratado ANTES de qualquer decisão** (paridade exata com `AuthGuard` linhas 31-49). Nunca renderiza `children` nem dispara redirect enquanto `loading === true`.
- **Redirect com `router.replace("/home")`** (não `push`): evita que o não-admin volte para `/admin` pelo histórico.
- **Retorna `null` durante o redirect** (`role !== "admin"` e `!loading`): não vaza o conteúdo do painel no intervalo até a navegação concluir.
- **`role === null`** (perfil indisponível/erro) cai no ramo `role !== "admin"` → redirect para `/home`. Observação: o `AuthGuard` pai já barra `status === null`/`blocked` com `BlockedScreen`, então um usuário que chega ao `AdminGuard` é, por construção, `approved`; o `AdminGuard` decide **apenas** sobre `role`.
- **Não** duplica a lógica de auth/status do `AuthGuard` — assume que já passou por ela (composição de layouts).

### 4.3 `admin/layout.tsx`

```tsx
"use client";
import type { ReactNode } from "react";
import { AdminGuard } from "@/components/layout/AdminGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
```

- **Não** re-renderiza `AppShell`/`AuthGuard` (herdados de `(app)/layout.tsx`).

## 5. Como condicionar a entrada de nav (Header)

Em `Header.tsx`, preencher o slot direito:

> **Nota de API (load-bearing):** o `Button` do projeto é **Base UI** (`@base-ui/react/button`), **não** Radix/Shadcn clássico. Ele **não** tem prop `asChild`; a polimorfia se faz pela prop **`render`** (mesmo idioma já usado em `SideNav.tsx`: `TooltipTrigger render={<Link .../>}`). Além disso `size="icon"` mapeia para `size-8` (32px, **abaixo** de 44px) — para atingir o toque mínimo, **não** usar `size="icon"`; aplicar `className="size-11"` (44px) e `variant="ghost"`.

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
// ...
const { role } = useAuth();
const pathname = usePathname();
const isAdminRoute = pathname.startsWith("/admin");
// ...
<div aria-label="Ações do usuário" className="flex items-center gap-1">
  {role === "admin" ? (
    <Button
      variant="ghost"
      aria-label="Painel admin"
      aria-current={isAdminRoute ? "page" : undefined}
      className="size-11"
      render={
        <Link href="/admin">
          <ShieldCheck size={20} aria-hidden="true" />
        </Link>
      }
    />
  ) : null}
</div>
```

Regras:
- **Condição única** `role === "admin"`; qualquer outro valor → item ausente do DOM (`null`).
- **Polimorfia via `render`** (Base UI), espelhando `SideNav.tsx`. **Não** usar `asChild` (não existe neste Button). O `aria-label`/`aria-current`/`className` ficam no `<Button>`; o `<Link>` e o ícone vão dentro do `render`.
- **Ícone `ShieldCheck`** (lucide-react, import named — MASTER §7), `size={20}`, `aria-hidden="true"` (decorativo; o nome acessível vem do `aria-label` do botão).
- **`aria-label="Painel admin"`** no controle (ícone funcional sem texto — MASTER §7/§10.3).
- **`aria-current="page"`** quando em `/admin` (MASTER §10.3, paridade com Bottom/SideNav).
- **`variant="ghost"`** (ação de nav/ícone inline — MASTER §8); **`size-11`** (44×44px — toque ≥44px, MASTER §10.2). **Não** usar `size="icon"` (32px, abaixo do mínimo).
- **`next/link`** para navegação interna (MASTER §14 — nunca `<a>`).
- **Sem estilo inline, sem hexadecimal** (MASTER §14/§15) — cores herdadas por `currentColor`/tokens.
- Se um `DropdownMenu` Base UI/Shadcn existir no Header em iteração futura, o item "Painel admin" entra como item de menu role-gated; nesta task a entrega mínima é o botão-ícone direto.

## 6. Restrições do projeto (obrigatórias)

- TypeScript strict, **sem `any`** (MASTER §14). `role` já é tipado (`Role | null`) em `AuthContextValue`.
- **Sem estilos inline** — só Tailwind/tokens (MASTER §14/§15). Sem hexadecimais.
- **Mobile-first** — o Header e o item admin funcionam em todos os breakpoints (MASTER §11). O guard é agnóstico de viewport.
- Reusar `LoadingScreen` existente (não criar novo).
- Reusar `useAuth()` (não ler contexto direto). Guard espelha o padrão de `AuthGuard` (`useEffect` + `useRouter`, MASTER §14 "redirecionamentos programáticos").
- **Não** alterar `AuthGuard`, `AuthProvider`, `AppShell`, `BottomNav`, `SideNav`, `NAV_ITEMS` (a entrada admin vive no Header, não na nav primária).

## 7. Critérios de aceite

1. Existe `src/components/layout/AdminGuard.tsx` e `src/app/(app)/admin/layout.tsx` que envolve `children` com `<AdminGuard>`.
2. `AdminGuard`: com `loading === true` renderiza `<LoadingScreen />` (não pinta children, não redireciona).
3. `AdminGuard`: com `role === "admin"` renderiza `children`.
4. `AdminGuard`: com `role !== "admin"` (`"user"` ou `null`) chama `router.replace("/home")` e renderiza `null` (nunca pinta o painel).
5. **Sem flash:** em nenhum estado o conteúdo de `/admin` é exibido a um não-admin antes do redirect; o redirect só ocorre após `loading === false`.
6. Header: item/botão "Painel admin" aparece **somente** quando `role === "admin"`; ausente do DOM para os demais.
7. Header: o item admin navega para `/admin` via `next/link`, tem `aria-label="Painel admin"`, `aria-current="page"` em `/admin`, e área de toque ≥44px.
8. BottomNav/SideNav permanecem com os 5 itens de `NAV_ITEMS` (sem item admin, sem salto de layout).
9. `rtk tsc` e `rtk lint` sem erros novos nos arquivos tocados.

## 8. Plano de teste (`/test`)

> Recomendação do plano: cobertura no `/test` (não TDD). Testes de componente (RTL + Vitest) com `useAuth` mockado; navegação via `useRouter` mockado.

### 8.1 Guard (`AdminGuard`)
- **T1 — loading:** `useAuth → { loading: true, role: null }` ⇒ renderiza `LoadingScreen`; `router.replace` **não** chamado; nenhum `children` no DOM.
- **T2 — admin entra:** `{ loading: false, role: "admin" }` ⇒ renderiza `children` (ex.: marcador de teste); `router.replace` **não** chamado.
- **T3 — user barrado:** `{ loading: false, role: "user" }` ⇒ `router.replace("/home")` chamado **uma vez**; `children` **ausente** do DOM (retorno `null`).
- **T4 — role null barrado:** `{ loading: false, role: null }` ⇒ `router.replace("/home")`; `children` ausente.
- **T5 — sem flash:** transição `loading:true → false` com `role:"user"` ⇒ em nenhum render o `children` aparece (assert que o marcador nunca esteve no DOM); redirect só após `loading:false`.

### 8.2 Entrada de nav (Header)
- **T6 — admin vê:** `role: "admin"` ⇒ `getByRole("link"/"button", { name: "Painel admin" })` presente; `href="/admin"`.
- **T7 — user não vê:** `role: "user"` ⇒ `queryBy...({ name: "Painel admin" })` é `null` (ausente do DOM, não só invisível).
- **T8 — null não vê:** `role: null` ⇒ item ausente.
- **T9 — aria-current:** `usePathname → "/admin"` + `role:"admin"` ⇒ o item tem `aria-current="page"`; em `"/home"` ⇒ sem `aria-current`.

### 8.3 Verificação manual (depende de B1 — admin real no Firebase)
- Logar como **admin** (`role:"admin"`, promovido fora de banda): item "Painel admin" no Header → clica → entra em `/admin`. Digitar `/admin` na URL: entra direto.
- Logar como **user comum** (`role:"user"`, approved): sem item no Header. Digitar `/admin` na URL: redirecionado a `/home` sem piscar o painel; voltar no histórico não retorna a `/admin` (efeito do `replace`).
- Teclado: Tab alcança o item admin no Header; Enter navega. Foco visível (ring).
