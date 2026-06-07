# SPEC — TASK-06 · Header de boas-vindas + sino (PRD-02)

> Origem: `ai/plan/home-dashboard.md` §3 TASK-06 · PRD: `ai/prd/home-dashboard.md` §2 (bloco 1), §5 R5/R7, §7b D1
> Tipo: ui · SP: 2 · Criticality: medium · Risk: low · TDD: no · Screen: yes (mobile|both)
> Dependências: nenhuma (usa `useAuth` existente — TASK-06 é a fundação do /screen da Home)

---

## 1. Objetivo

Criar o componente `HomeHeader` — bloco de boas-vindas no topo do conteúdo da página `/home`. Exibe:

1. Avatar do usuário por iniciais (reusa helpers existentes de `src/features/admin/components/userAvatar.ts` e o primitive `Avatar` de `src/components/ui/avatar.tsx`).
2. Saudação "Olá {nome} 👋" + subtítulo.
3. Ícone de notificações estático (Lucide `Bell`) sem realtime (R5 do PRD).

Este é o **primeiro componente UI da feature Home**. Antes de implementá-lo, o passo `/screen` deve produzir o contrato visual completo da página `/home` (grid de cards, paleta semântica, skeleton layout, estados), que TASK-07, TASK-08, TASK-09 e TASK-10 referenciarão. A seção §12 desta spec documenta esse contrato esperado do `/screen`.

---

## 2. Relação com o `Header` fixo do AppShell

O `AppShell` (`src/components/layout/AppShell.tsx`) já monta um `Header` fixo (`src/components/layout/Header.tsx`):

- **`Header` fixo** (`h-14`, `z-50`, `fixed top-0`): identidade da aplicação ("Bolão dos Parças") + link de admin (role-gated). É o *chrome* global — não deve ser alterado por esta task.
- **`HomeHeader`** (novo): bloco de conteúdo posicionado dentro da `<main>` do AppShell, **abaixo** do Header fixo. É o topo da área de conteúdo da Home, não uma barra de navegação. Não substitui, não duplica, não se sobrepõe ao Header fixo.

```
┌─────────────────────────────────────────────┐  ← Header fixo (chrome, z-50, h-14)
│  Bolão dos Parças                 [Admin]   │
├─────────────────────────────────────────────┤
│  ← pt-14 (compensação do header fixo)      │  ← main (AppShell, px-4 py-4 pb-20)
│  ┌─────────────────────────────────────┐    │
│  │  [Avatar]  Olá, {nome} 👋  [Bell]  │    │  ← HomeHeader (este componente)
│  │            Bem-vindo ao bolão       │    │
│  └─────────────────────────────────────┘    │
│  ... cards de métrica, jogos, avisos ...    │
│                                             │
└─────────────────────────────────────────────┘
│  BottomNav (fixed bottom, z-50, h-16)       │
```

**Consequência de implementação:** `HomeHeader` não usa `<header>` HTML nem `role="banner"` (já ocupados pelo Header fixo). Usar `<section>` ou `<div>` com `aria-label="Boas-vindas"`.

---

## 3. Arquivos a criar

```
src/features/home/components/
  HomeHeader.tsx           ← componente principal (este spec)
  index.ts                 ← barrel (se não existir — criar; se existir, adicionar export)
```

Nenhum arquivo existente é alterado nesta task (leitura de `useAuth`, helpers e primitivos são imports sem modificação).

---

## 4. Props e fonte de dados

### 4.1 Interface de props

```ts
// src/features/home/components/HomeHeader.tsx

export interface HomeHeaderProps {
  /**
   * Nome completo do usuário (profile.name).
   * Quando null (loading ou erro de perfil), exibe skeleton/placeholder.
   */
  name: string | null;
  /**
   * uid do usuário autenticado (firebaseUser.uid).
   * Usado para derivar a variante de cor do avatar de forma determinística.
   * Quando null, avatar exibe fallback neutro.
   */
  uid: string | null;
}
```

### 4.2 Fonte de dados — uso em `home/page.tsx`

O componente é **presentational**: recebe props, não chama hooks internamente. Quem monta a Home obtém os dados de `useAuth` e passa via props:

```ts
// Exemplo de uso (src/app/(app)/home/page.tsx — TASK-10 irá compor)
const { profile, firebaseUser } = useAuth();

<HomeHeader
  name={profile?.name ?? null}
  uid={firebaseUser?.uid ?? null}
/>
```

**Justificativa de ser presentational:** TASK-10 (página `/home`) orquestra todos os estados (loading/empty/error). Um componente presentational é testável em isolamento com props estáticas, sem necessidade de mockar context.

### 4.3 Exibição do nome: `name` vs. `nickname`

O PRD usa "Olá {nome}" sem especificar qual campo. Decisão desta spec:

- **Usar `profile.name`** (campo `name: nonEmptyString` do `userSchema`) como dado primário — é o nome completo que o usuário cadastrou.
- **Não usar `nickname`** no `HomeHeader`: o apelido é relevante em rankings (identificação entre pares), mas a saudação pessoal usa o nome real.
- Se o produto decidir usar `nickname` no futuro, a prop `name` desta interface absorve ambos — basta alterar o valor passado em `home/page.tsx`.

---

## 5. Especificação do componente `HomeHeader`

### 5.1 Estrutura JSX

```
<section aria-label="Boas-vindas">
  <div className="flex items-center justify-between gap-3">

    {/* Lado esquerdo: Avatar + texto */}
    <div className="flex items-center gap-3 min-w-0">

      {/* Avatar por iniciais */}
      <Avatar className="size-12 shrink-0">
        <AvatarFallback className={cn("text-sm font-semibold", avatarColorClass)}>
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Bloco de texto */}
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground truncate">
          {greeting}  {/* "Olá, {nome} 👋" ou skeleton */}
        </p>
        <p className="text-sm text-muted-foreground">
          Bem-vindo ao bolão
        </p>
      </div>
    </div>

    {/* Lado direito: Sino estático */}
    <button
      type="button"
      aria-label="Notificações (em breve)"
      disabled
      className="flex items-center justify-center size-11 rounded-full text-muted-foreground
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Bell size={20} aria-hidden="true" />
    </button>

  </div>
</section>
```

### 5.2 Lógica interna

```ts
// Derivações internas (sem hooks — apenas cálculos puros)
const initials = name ? getInitials(name) : "?";
const avatarColorClass = uid ? AVATAR_CLASSES[getAvatarVariant(uid)] : AVATAR_CLASSES["c1"];
const greeting = name ? `Olá, ${name} 👋` : "Olá 👋";
```

**Imports de helpers:**

```ts
import { getInitials, getAvatarVariant, AVATAR_CLASSES } from "@/features/admin/components/userAvatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
```

### 5.3 Estado de loading / null

Quando `name === null` (perfil ainda carregando ou erro), o componente não usa skeleton próprio — exibe o placeholder neutro `"Olá 👋"` com iniciais `"?"`. O estado de loading completo (com skeleton) é responsabilidade de `TASK-10` (página) que envolve o `HomeHeader` em um skeleton de seção durante `isLoading`.

**Justificativa:** manter o componente simples e desacoplado de estados de carregamento globais. A página (`home/page.tsx`) centraliza o controle de loading.

---

## 6. Tokens e estilo (design-system/MASTER.md)

| Elemento | Classes Tailwind | Referência no MASTER.md |
|---|---|---|
| Container `<section>` | `mb-6` | Espaço antes dos cards (§4.2 gap-4) |
| Avatar | `size-12 shrink-0 rounded-full` | §5 `rounded-full`; tamanho maior que admin (size-10) por destaque |
| AvatarFallback cor | `AVATAR_CLASSES[variant]` → `bg-primary text-primary-foreground` \| etc. | §2.1 pares semânticos; já usados em admin |
| AvatarFallback texto | `text-sm font-semibold` | §3.2 Body + weight Bold (iniciais) |
| Texto saudação | `text-lg font-semibold text-foreground truncate` | §3.2 Heading 3; truncate p/ nomes longos |
| Subtítulo | `text-sm text-muted-foreground` | §3.2 Body; §3.4 hierarquia Secundário |
| Botão sino | `size-11 rounded-full text-muted-foreground` | §10.2 toque mínimo 44px (size-11 = 44px) |
| Botão sino desabilitado | `disabled:opacity-50 disabled:cursor-not-allowed` | Estado visual de indisponível |
| Bell icon | `size={20} aria-hidden="true"` | §7 tamanho padrão 20px; decorativo |
| Hover do botão (se habilitado no futuro) | `hover:bg-accent transition-colors duration-150` | §12 animações hover |

**Proibições obrigatórias (CLAUDE.md + MASTER.md):**
- Sem `style={{}}` — toda estilização via Tailwind.
- Sem valores hexadecimais — apenas tokens semânticos.
- Sem `any` em TypeScript.
- Sem importação `import * as Icons` — usar named import `{ Bell }`.

---

## 7. Sino estático (R5 do PRD)

O sino **não tem realtime** no MVP. Decisões:

- O `<button>` existe no DOM mas está `disabled` (sem listener ativo além do atributo).
- `aria-label="Notificações (em breve)"` comunica ao leitor de tela que a funcionalidade existe mas ainda não está disponível.
- Não exibe badge de contagem (sem dados de notificação no MVP).
- Não abre popover, drawer ou rota — nenhuma ação ao clicar.
- Quando realtime for implementado (PRD futuro), basta remover `disabled` e adicionar o handler.

**Alternativa rejeitada:** omitir o sino completamente. Rejeitada porque o mockup `home.png` mostra o ícone, e reservar o espaço agora evita layout shift quando for implementado.

---

## 8. Acessibilidade (nível Standard — plano §TASK-06)

| Elemento | Requisito |
|---|---|
| `<section>` container | `aria-label="Boas-vindas"` — região semântica identificável |
| Avatar | Puramente visual; sem texto alternativo além das iniciais visíveis. `aria-hidden="true"` no `AvatarFallback` se o nome completo for lido pelo texto adjacente — avaliar durante implementação |
| Texto de saudação | Texto visível; nenhum atributo ARIA adicional necessário |
| Botão sino | `type="button"` · `aria-label="Notificações (em breve)"` · `disabled` · `aria-disabled="true"` (redundante mas recomendado para compatibilidade com leitores de tela mais antigos) |
| Bell icon | `aria-hidden="true"` (decorativo; o label do botão pai já descreve) |
| Área de toque do botão | `size-11` = 44×44px (WCAG 2.5.5) |
| Focus ring | Herdado de Tailwind/Shadcn — garantir `focus-visible:ring-2 ring-ring` no botão |

---

## 9. Responsividade (mobile-first)

O `HomeHeader` é um bloco de largura total dentro do `<main>` do AppShell (já limitado a `max-w-4xl mx-auto`). Não tem breakpoints específicos — o layout flex `items-center justify-between` funciona em qualquer largura:

- **Mobile (< 768px):** Avatar (size-12) + texto ocupam a esquerda; sino à direita. `truncate` no nome evita overflow em telas estreitas (360px).
- **Tablet / Desktop (≥ 768px):** mesma estrutura; `max-w-4xl` do AppShell centraliza o conteúdo. O HomeHeader não precisa de breakpoint próprio.

---

## 10. Arquivo de implementação completo (referência)

```tsx
// src/features/home/components/HomeHeader.tsx
"use client";

import { Bell } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getInitials,
  getAvatarVariant,
  AVATAR_CLASSES,
} from "@/features/admin/components/userAvatar";
import { cn } from "@/lib/utils";

export interface HomeHeaderProps {
  /** Nome completo do usuário (profile.name). null durante loading ou erro. */
  name: string | null;
  /** uid do Firebase Auth. null se não autenticado. */
  uid: string | null;
}

/**
 * Bloco de boas-vindas no topo do conteúdo da Home.
 * NÃO é o Header fixo do AppShell — é um bloco de conteúdo dentro de <main>.
 *
 * Exibe: avatar por iniciais + saudação "Olá, {nome} 👋" + sino estático (MVP).
 */
export function HomeHeader({ name, uid }: HomeHeaderProps) {
  const initials = name ? getInitials(name) : "?";
  const avatarColorClass = uid
    ? AVATAR_CLASSES[getAvatarVariant(uid)]
    : AVATAR_CLASSES["c1"];
  const greeting = name ? `Olá, ${name} 👋` : "Olá 👋";

  return (
    <section aria-label="Boas-vindas" className="mb-6">
      <div className="flex items-center justify-between gap-3">

        {/* Avatar + texto */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback
              className={cn("text-sm font-semibold", avatarColorClass)}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">
              {greeting}
            </p>
            <p className="text-sm text-muted-foreground">
              Bem-vindo ao bolão
            </p>
          </div>
        </div>

        {/* Sino estático (MVP — R5: sem realtime) */}
        <button
          type="button"
          aria-label="Notificações (em breve)"
          aria-disabled="true"
          disabled
          className={cn(
            "flex items-center justify-center size-11 rounded-full",
            "text-muted-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Bell size={20} aria-hidden="true" />
        </button>

      </div>
    </section>
  );
}
```

---

## 11. Barrel `src/features/home/components/index.ts`

Criar (ou adicionar ao existente):

```ts
export { HomeHeader } from "./HomeHeader";
export type { HomeHeaderProps } from "./HomeHeader";
```

---

## 12. Nota para o passo `/screen` — contrato visual da página Home

Esta é a **primeira task de UI da Home Dashboard**. Antes de implementar (e antes de TASK-07/08/09/10), o passo `/screen` deve produzir o contrato visual completo da página `/home`. Esse documento deve cobrir:

### O que o `/screen` da Home deve especificar

1. **Layout geral da página** — estrutura do grid de cards em mobile (1 coluna, stack vertical) e desktop (grid 2 colunas ou misto). Baseado em `docs/prd-02/home.png`.
2. **Hierarquia visual** — ordem dos blocos: `HomeHeader` → cards de métrica (Ranking, Acertos, Aproveitamento, Meu Desempenho) → Próximo Jogo → Fase Atual → Últimos Resultados → Avisos.
3. **Tokens semânticos de cor** a serem adicionados em `globals.css` — especificamente `--color-win` (verde, acerto) e `--color-loss` (vermelho, erro) do §2.4 do MASTER.md, necessários para TASK-07/08 (estado de acertou/errou).
4. **Skeleton layout** — forma dos placeholders de loading por card (TASK-10).
5. **Estados empty e error** — visual do card quando sem dados ou com falha.
6. **Tipografia por bloco** — aplicação da escala (§3.2 MASTER.md) aos números de métrica (Display/Heading 1 para números grandes), rótulos de card, etc.
7. **`HomeHeader` em contexto** — como o bloco se encaixa visualmente no início da página, referenciando este spec como fonte.

**Grounding:** `design-system/MASTER.md` (tokens canônicos) + `docs/prd-02/home.png` (mockup) + `ai/prd/home-dashboard.md` §7 (requisitos de UI).

TASK-07, TASK-08, TASK-09 e TASK-10 referenciarão o output do `/screen` da Home como contrato visual.

---

## 13. Critérios de aceite

1. `HomeHeader` renderiza sem erro com `name: null, uid: null` — exibe `"Olá 👋"` e iniciais `"?"`.
2. `HomeHeader` com `name: "Ana Lima", uid: "abc123"` exibe `"Olá, Ana Lima 👋"` e iniciais `"AL"` com variante de cor determinística para `"abc123"`.
3. Avatar usa `getInitials` e `getAvatarVariant` de `src/features/admin/components/userAvatar.ts` — sem duplicação de lógica.
4. Avatar usa o primitive `Avatar` / `AvatarFallback` de `src/components/ui/avatar.tsx`.
5. Sino é um `<button disabled>` com `aria-label="Notificações (em breve)"` — não abre nada ao clicar.
6. Botão do sino tem `size-11` (44×44px) — atende WCAG 2.5.5.
7. `Bell` é importado como named import de `lucide-react` com `aria-hidden="true"`.
8. Nenhum `style={{}}` no componente — toda estilização via Tailwind.
9. Nenhum `any` no TypeScript — arquivo passa `rtk tsc` sem erros novos.
10. `HomeHeader` está dentro da `<main>` do AppShell (bloco de conteúdo), **não** substituindo nem duplicando o `Header` fixo.
11. Export correto no barrel `src/features/home/components/index.ts`.
12. Texto "Bem-vindo ao bolão" visível como subtítulo em `text-muted-foreground`.
13. `truncate` no parágrafo da saudação previne overflow em nomes longos em telas de 360px.
14. `<section aria-label="Boas-vindas">` — região semântica identificável por leitores de tela.
