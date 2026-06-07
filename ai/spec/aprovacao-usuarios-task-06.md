# SPEC — TASK-06: Painel admin (tabs + lista + contadores, read-only)

> Entrada: `ai/plan/aprovacao-usuarios.md` (TASK-06) · `ai/screen/aprovacao-usuarios-task-06.md` (contrato de UX/UI — fonte das decisões de layout, iniciais, cor de avatar, estados) · `ai/spec/aprovacao-usuarios-task-03.md` (hooks consumidos) · `.claude/CLAUDE.md` (TanStack Query obrigatório, TS strict / sem `any`, sem estilo inline, date-fns para datas, componentes reutilizáveis e tipados, mobile-first) · `design-system/MASTER.md` (tokens/estilo travado).
> Tipo: `ui` · Criticidade: `high` · Risco técnico: `medium` · Story points: 5.
> TDD: não (cobertura no `/test`) · Screen: sim (`aprovacao-usuarios-task-06.md`) · Dependências: TASK-03, TASK-04, TASK-05 (todas JÁ implementadas) — Wave 3.
>
> Naming: convenção pós-PRD-00 (`ai/spec/<feature>-task-NN.md`, ver MEMORY).

---

## 1. Task: TASK-06 — Painel admin: tabs + lista + contadores (read-only)

## 2. Objetivo

Substituir o placeholder de `src/app/(app)/admin/page.tsx` pelo **conteúdo real do painel admin** (telas 03/05 do PRD-01.2): header de página, **3 tabs com contador** (Pendentes/Aprovados/Bloqueados) e a **lista de usuários por tab** (avatar com iniciais, nome, email, data de cadastro `dd/MM/yyyy HH:mm`), com **estados loading/empty/erro por tab**. Render **read-only**: **sem** as ações de moderação (TASK-07) — mas com um **slot de ação** (`actions?: ReactNode`) reservado no item de lista como único ponto de extensão para a TASK-07.

A page **consome** a camada de dados já pronta (TASK-03: `useUsersByStatus`, `useUserStatusCounts`) e os primitivos já prontos (TASK-04: `Tabs`, `Badge`, `Avatar`). **Não** toca em `AdminGuard`/`layout.tsx` (TASK-05), em hooks/serviço/schema (TASK-02/03) nem em `AppShell`/Header/BottomNav.

### Truths que devem ser verdadeiras ao fim
- `/admin` renderiza `UsersPanel` dentro do `AppShell` (herdado de `(app)/layout.tsx`): Header + BottomNav (mobile) / SideNav (desktop), gateado por `AuthGuard` + `AdminGuard`.
- Existem 3 tabs (`Tabs` Base UI) com `value` em `"pending" | "approved" | "blocked"`; tab default = `"pending"`. Cada `TabsTab` mostra rótulo pt-BR + `Badge` com `useUserStatusCounts()` (Bloqueados `destructive`, demais `secondary`).
- Cada `TabsPanel` renderiza `UserStatusList` que chama **um** `useUsersByStatus(status)` e resolve, naquela ordem: loading (skeleton) → erro (com retry) → vazio (texto contextual) → `UserList`.
- `UserListItem` mostra `Avatar` com **iniciais derivadas de `user.name`** (`getInitials`), cor de fundo **determinística por `user.uid`** sobre tokens `chart-*` (`getAvatarVariant`), nome, email e `createdAt` formatado com **date-fns** `dd/MM/yyyy HH:mm`. Expõe slot `actions?: ReactNode` (não renderiza ação nesta task).
- Sem `any`; sem `style={{}}`; sem hexadecimal em classe; toda data via date-fns; toda consulta via TanStack Query (hooks TASK-03) — nenhum `useEffect`+`getDocs`.
- `npx tsc --noEmit` limpo; `rtk next build` (ou `npm run build`) compila a rota `/admin`.

---

## 3. In scope — arquivos exatos

Novos em `src/features/admin/components/` (diretório ainda não existe — criar) + substituição da page. Convenção: componentes de apresentação **puros** (recebem dados por prop, sem hook) separados do componente de **borda de dados** (`UserStatusList`, com hook).

```
src/features/admin/components/
├── UsersPanel.tsx          (novo) — "use client"; orquestra header + Tabs + counts
├── UserStatusList.tsx      (novo) — "use client"; borda de dados de UMA tab (useUsersByStatus)
├── UserList.tsx            (novo) — puro; <ul> de UserListItem
├── UserListItem.tsx        (novo) — puro; avatar+nome+email+data + slot actions
├── UserListSkeleton.tsx    (novo) — puro; estado loading
├── UserListEmpty.tsx       (novo) — puro; estado vazio por status
├── UserListError.tsx       (novo) — puro; estado erro + onRetry
└── userAvatar.ts           (novo) — utils puras: getInitials, getAvatarVariant, AVATAR_CLASSES

src/features/admin/index.ts (editar) — reexportar UsersPanel (barrel público da feature)
src/app/(app)/admin/page.tsx (substituir) — render <UsersPanel />
```

> Util pode alternativamente viver em `src/lib/` se houver reuso fora de admin; como é específico do painel, fica em `features/admin/components/userAvatar.ts` (coesão de feature). Decisão registrada em §13.

### 3.1 `userAvatar.ts` — utils puras (testáveis sem React)

```ts
export type AvatarVariant = "c1" | "c2" | "c3" | "c4" | "c5";

/** Classes Tailwind por variante — paleta de tokens chart-* (MASTER §2.3). Sem hex. */
export const AVATAR_CLASSES: Record<AvatarVariant, string> = {
  c1: "bg-chart-1 text-primary-foreground",
  c2: "bg-chart-2 text-primary-foreground",
  c3: "bg-chart-3 text-primary-foreground",
  c4: "bg-chart-4 text-foreground",
  c5: "bg-chart-5 text-foreground",
};

const AVATAR_VARIANTS: readonly AvatarVariant[] = ["c1", "c2", "c3", "c4", "c5"];

/** Iniciais a partir do nome (1ª da 1ª palavra + 1ª da última; 1 palavra → 2 letras). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = words[0][0];
  const last = words[words.length - 1][0];
  return (first + last).toUpperCase();
}

/** Variante de cor determinística e estável por uid (hash simples → índice). */
export function getAvatarVariant(uid: string): AvatarVariant {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % AVATAR_VARIANTS.length;
  }
  return AVATAR_VARIANTS[hash];
}
```

- `getInitials`/`getAvatarVariant` são **puras e determinísticas** (mesma entrada → mesma saída). `getAvatarVariant` usa `uid` (imutável) → cor estável entre tabs/re-renders (SCREEN §4.2).
- `text-foreground` para `c4`/`c5` e `text-primary-foreground` para `c1..c3` é a hipótese de contraste; **verificar AA no `/review` visual** e ajustar o `Record` se necessário — **nunca** introduzir cor fora do tema (MASTER §10.1/§15).

### 3.2 `UserListItem.tsx` — item puro com slot de ação

```ts
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { getInitials, getAvatarVariant, AVATAR_CLASSES } from "./userAvatar";
import { formatUserCreatedAt } from "./userDate"; // ou util local — ver §5

export interface UserListItemProps {
  user: User;
  /** Slot de ações por linha. TASK-07 injeta os botões aqui; vazio na TASK-06. */
  actions?: ReactNode;
}

export function UserListItem({ user, actions }: UserListItemProps) {
  const initials = getInitials(user.name);
  const variant = getAvatarVariant(user.uid);
  const createdAt = formatUserCreatedAt(user.createdAt);

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <Avatar>
        <AvatarFallback className={cn("text-sm font-medium", AVATAR_CLASSES[variant])}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        {createdAt ? (
          <p className="text-xs text-muted-foreground">{createdAt}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </li>
  );
}
```

- **Slot `actions`**: único ponto de extensão para TASK-07 (Aprovar/Rejeitar/Bloquear/Desbloquear). Nesta task, `UserList` **não** passa `actions` → item read-only.
- `createdAt` é `string | undefined` no schema (`isoDateTime.optional()`) → render condicional (não imprime linha vazia/"Invalid Date").

### 3.3 `UserList.tsx` — lista pura

```ts
import type { ReactNode } from "react";
import type { User } from "@/types";
import { UserListItem } from "./UserListItem";

export interface UserListProps {
  users: User[];
  /** Render-prop opcional p/ ações por usuário (TASK-07). Ausente → read-only. */
  renderActions?: (user: User) => ReactNode;
}

export function UserList({ users, renderActions }: UserListProps) {
  return (
    <ul className="flex flex-col">
      {users.map((user) => (
        <UserListItem
          key={user.uid}
          user={user}
          actions={renderActions?.(user)}
        />
      ))}
    </ul>
  );
}
```

- `renderActions` é o **slot de nível-lista** (TASK-07 passará `(user) => <UserActions user={user} />`). Nesta task: omitido. `key={user.uid}` (estável).

### 3.4 `UserStatusList.tsx` — borda de dados de uma tab

```ts
"use client";
import { useUsersByStatus } from "@/features/admin";
import type { UserStatus } from "@/types";
import { UserList } from "./UserList";
import { UserListSkeleton } from "./UserListSkeleton";
import { UserListEmpty } from "./UserListEmpty";
import { UserListError } from "./UserListError";

export interface UserStatusListProps {
  status: UserStatus;
}

export function UserStatusList({ status }: UserStatusListProps) {
  const { data, isPending, isError, refetch } = useUsersByStatus(status);

  if (isPending) return <UserListSkeleton />;
  if (isError) return <UserListError onRetry={() => void refetch()} />;
  if (data.length === 0) return <UserListEmpty status={status} />;
  return <UserList users={data} />;
}
```

- Ordem de checagem fixa (SCREEN §5). `useUsersByStatus` é o hook TASK-03 (cache 30min/24h herdado). `void refetch()` (retorno ignorado intencionalmente — sem `any`).

### 3.5 `UsersPanel.tsx` — orquestrador

```ts
"use client";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUserStatusCounts } from "@/features/admin";
import { UserStatusList } from "./UserStatusList";

export function UsersPanel() {
  const counts = useUserStatusCounts();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTab value="pending">
            Pendentes <Badge variant="secondary">{counts.pending}</Badge>
          </TabsTab>
          <TabsTab value="approved">
            Aprovados <Badge variant="secondary">{counts.approved}</Badge>
          </TabsTab>
          <TabsTab value="blocked">
            Bloqueados <Badge variant="destructive">{counts.blocked}</Badge>
          </TabsTab>
        </TabsList>

        <TabsPanel value="pending"><UserStatusList status="pending" /></TabsPanel>
        <TabsPanel value="approved"><UserStatusList status="approved" /></TabsPanel>
        <TabsPanel value="blocked"><UserStatusList status="blocked" /></TabsPanel>
      </Tabs>
    </div>
  );
}
```

- `Tabs` Base UI: `value` string; `defaultValue="pending"`. `TabsTab` já é `flex-1` (rótulos repartem a largura). `TabsList className="w-full"` para ocupar a faixa no mobile.
- Os 3 `TabsPanel` montam os 3 `UserStatusList` → as 3 `useUsersByStatus` ficam ativas; o cache é compartilhado com `useUserStatusCounts` (mesma `queryKey`, TASK-03) → sem fetch extra para os contadores.

### 3.6 `UserListSkeleton.tsx` / `UserListEmpty.tsx` / `UserListError.tsx`

- **Skeleton:** container `role="status" aria-busy="true" aria-label="Carregando usuários"`; 3–4 linhas, cada uma com um círculo (`size-10 rounded-full bg-muted`) + 2 barras (`h-3/h-2 bg-muted rounded`), todas com `animate-pulse motion-reduce:animate-none`; conteúdo `aria-hidden="true"`. Sem `style`.
- **Empty:** `props { status: UserStatus }`; `role="status"`; ícone Lucide (`Inbox`/`UserX`/`ShieldOff` por status — named import, `aria-hidden`, `size={24}`); texto contextual por status (SCREEN §5). Centralizado (`flex flex-col items-center gap-2 py-10 text-center text-muted-foreground`).
- **Error:** `props { onRetry: () => void }`; `role="alert"`; ícone `TriangleAlert` (`aria-hidden`), texto "Não foi possível carregar os usuários." + `Button variant="outline"` "Tentar novamente" (`onClick={onRetry}`). Centralizado.

### 3.7 `page.tsx` + barrel

```ts
// src/app/(app)/admin/page.tsx  (substitui o placeholder)
import { UsersPanel } from "@/features/admin/components/UsersPanel";
export default function AdminPage() {
  return <UsersPanel />;
}
```
```ts
// src/features/admin/index.ts  (adicionar — manter exports de hooks existentes)
export { UsersPanel } from "./components/UsersPanel";
```

- A `page.tsx` pode permanecer Server Component (só compõe `UsersPanel`, que é client). Não adicionar `"use client"` na page (o boundary começa em `UsersPanel`).

---

## 4. Out of scope
- **Ações de moderação** (Aprovar/Rejeitar/Bloquear/Desbloquear), **modal de confirmação** e **toast Sonner** → **TASK-07**. Aqui só o slot `actions`/`renderActions`.
- **Mutação / `useUpdateUserStatus`** e tradução de erro de permissão → TASK-07 (hook já existe; não consumido aqui).
- **AdminGuard / gating de rota / entrada de nav** → TASK-05 (JÁ pronto — não tocar `layout.tsx`/`AdminGuard.tsx`).
- **Hooks de dados / serviço / schema de transição** → TASK-02/03 (JÁ prontos — só consumir).
- **Primitivos `Tabs`/`Badge`/`Avatar`/`Dialog`** → TASK-04 (JÁ prontos — só consumir).
- **Busca/filtro textual e paginação** → fora de escopo (sem requisito; <100 usuários).
- **Upload de foto de avatar** → fora de escopo (só iniciais).
- **AppShell/Header/BottomNav/SideNav** → existentes, herdados; não modificar.
- **Realtime/`onSnapshot`** → leitura por query/refetch (PRD §4).

## 5. Formatação de data (date-fns — obrigatório)

- `user.createdAt` é `string | undefined` (ISO 8601, `isoDateTime.optional()` no `userSchema`). Formato alvo (mock 03): `dd/MM/yyyy HH:mm` (ex.: `15/06/2026 14:32`).
- Util dedicada (em `userAvatar.ts` ou `userDate.ts` ao lado):
  ```ts
  import { format, parseISO, isValid } from "date-fns";
  export function formatUserCreatedAt(iso: string | undefined): string | null {
    if (!iso) return null;
    const date = parseISO(iso);
    if (!isValid(date)) return null;
    return format(date, "dd/MM/yyyy HH:mm");
  }
  ```
- `parseISO` + guard `isValid` → nunca renderiza `"Invalid Date"`; `undefined`/inválido → `null` → o item não imprime a linha de data (UserListItem §3.2).
- Fuso: `format` usa o fuso **local** do navegador (decisão A7 do PRD — date-fns, fuso local). Sem `date-fns-tz`.
- **Proibido** `toLocaleString`/`Intl` manual ou template de string para data — regra CLAUDE.md (date-fns).

## 6. Mapeamento status → variante e cor de avatar

- **Badge das tabs:** `pending`/`approved` → `secondary`; `blocked` → `destructive` (SCREEN §4.1).
- **Avatar:** `getAvatarVariant(uid)` → `AvatarVariant` → `AVATAR_CLASSES` (paleta `bg-chart-1..5`, MASTER §2.3). `cn(...)` mescla no `AvatarFallback`, sobrescrevendo o `bg-muted text-muted-foreground` default do primitivo. **Determinístico por `uid`** (SCREEN §4.2). Contraste das iniciais verificado no `/review` visual (§9).

## 7. Contracts and interfaces

```ts
// userAvatar.ts
export type AvatarVariant = "c1" | "c2" | "c3" | "c4" | "c5";
export const AVATAR_CLASSES: Record<AvatarVariant, string>;
export function getInitials(name: string): string;
export function getAvatarVariant(uid: string): AvatarVariant;
export function formatUserCreatedAt(iso: string | undefined): string | null;

// UserListItem.tsx
export interface UserListItemProps { user: User; actions?: ReactNode }
export function UserListItem(props: UserListItemProps): JSX.Element;

// UserList.tsx
export interface UserListProps { users: User[]; renderActions?: (user: User) => ReactNode }
export function UserList(props: UserListProps): JSX.Element;

// UserStatusList.tsx
export interface UserStatusListProps { status: UserStatus }
export function UserStatusList(props: UserStatusListProps): JSX.Element;

// UserListEmpty.tsx
export interface UserListEmptyProps { status: UserStatus }
// UserListError.tsx
export interface UserListErrorProps { onRetry: () => void }
// UserListSkeleton.tsx — sem props

// UsersPanel.tsx
export function UsersPanel(): JSX.Element;
```

- `User`/`UserStatus` reusados de `@/types` (não redeclarar). Hooks importados do barrel `@/features/admin` (TASK-03). Primitivos de `@/components/ui/{tabs,badge,avatar}`. `cn` de `@/lib/utils`. Ícones de `lucide-react` (named).

## 8. Data and persistence impact
- **Leitura:** 3 `useUsersByStatus` (uma por tab) ativas quando `UsersPanel` monta — TanStack Query deduplica por `queryKey` (TASK-03); contadores compartilham o mesmo cache. Nenhuma query nova de contagem.
- **Escrita:** nenhuma (read-only). Sem `updateDoc`/mutação nesta task.
- **Cache:** chaves e política herdadas da TASK-03 (`["users","by-status",status]`, 30min/24h). Esta task não cria chave nem invalida nada.
- **Índice:** nenhum novo (o `status + createdAt` já é da TASK-02).

## 9. Required tests (no `/test`)

> Ambiente: `// @vitest-environment jsdom`, `@testing-library/react`, `vitest`. Mockar `@/features/admin` (hooks) para controlar estados; **não** bater no Firestore. Utils puras testadas sem React.

**`userAvatar.test.ts` (puro):**
- T1 — `getInitials("João da Silva") === "JS"`; `"Maria Santos" === "MS"`; `"Pedro Ramos" === "PR"`.
- T2 — 1 palavra: `getInitials("João") === "JO"`; 1 letra: `getInitials("A") === "A"`; vazio/espaços: `getInitials("  ") === "?"`.
- T3 — `getAvatarVariant(uid)` é **determinística** (mesma `uid` → mesma variante em chamadas repetidas) e retorna sempre um membro de `AvatarVariant`.
- T4 — `formatUserCreatedAt("2026-06-15T14:32:00.000Z")` formata `dd/MM/yyyy HH:mm` (asserir conforme fuso do runner — usar data sem ambiguidade ou fixar TZ no teste); `undefined` → `null`; string inválida → `null`.

**`UserListItem.test.tsx` / `UserList.test.tsx` (render puro):**
- T5 — `UserListItem` renderiza nome, email, iniciais e data formatada; classe de cor do avatar presente (`AVATAR_CLASSES[variant]`).
- T6 — **sem `actions`** → nenhum botão/elemento de ação no DOM (read-only garantido). Com `actions={<button>x</button>}` → o nó aparece no slot.
- T7 — `UserList` com 3 users → 3 `<li>`; sem `renderActions` → nenhuma ação; com `renderActions` → ação por item.

**`UserStatusList.test.tsx` (estados, hook mockado):**
- T8 — `isPending: true` → `UserListSkeleton` (`role="status"`).
- T9 — `isError: true` → `UserListError` (`role="alert"`); clicar "Tentar novamente" chama `refetch`.
- T10 — `data: []` → `UserListEmpty` com texto contextual do `status`.
- T11 — `data: [users]` → `UserList` com os itens; sem botões de ação (read-only).

**`UsersPanel.test.tsx` (tabs + contadores):**
- T12 — `useUserStatusCounts` mock `{pending:3,approved:52,blocked:1}` → os 3 badges exibem 3/52/1; Bloqueados usa variante destructive (classe `text-destructive`).
- T13 — 3 tabs com `role="tab"`; tab default "Pendentes" selecionada (`aria-selected`); clicar "Aprovados" troca o painel exibido (Base UI).

**Build/type:**
- T14 — `npx tsc --noEmit` limpo (sem `any`).
- T15 — `rtk next build` compila `/admin` sem erro.

## 10. Acceptance criteria
- [ ] `src/app/(app)/admin/page.tsx` renderiza `<UsersPanel />` (placeholder removido); page sem `"use client"` (boundary em `UsersPanel`).
- [ ] `/admin` aparece dentro do `AppShell` (Header + BottomNav/SideNav), gateado por `AuthGuard`+`AdminGuard` (sem alterar TASK-05).
- [ ] 3 tabs (`Tabs` Base UI), default `pending`; cada `TabsTab` com `Badge` de contagem de `useUserStatusCounts()`; Bloqueados `destructive`, demais `secondary`.
- [ ] Cada tab usa **um** `useUsersByStatus(status)` e resolve loading (skeleton) / erro (retry) / vazio (texto contextual) / lista — independentemente por tab.
- [ ] `UserListItem`: `Avatar` com iniciais de `getInitials(user.name)`, cor `getAvatarVariant(user.uid)` via tokens `chart-*`, nome, email, data `dd/MM/yyyy HH:mm` (date-fns, condicional a `createdAt`).
- [ ] `UserListItem.actions` / `UserList.renderActions` existem e **não** são usados nesta task (read-only); ponto de extensão único para TASK-07.
- [ ] `<ul>`/`<li>` semântico; tabs com roving focus (Base UI nativo); estados com `role` correto; ícones `aria-hidden`.
- [ ] Sem `any`; sem `style={{}}`; sem hexadecimal em classe; só tokens MASTER; date-fns para datas; hooks TanStack Query (sem `useEffect`+`getDocs`).
- [ ] `getInitials`/`getAvatarVariant`/`formatUserCreatedAt` puras e determinísticas.
- [ ] Contraste das iniciais sobre `chart-*` verificado ≥ AA no `/review` (ajustar `AVATAR_CLASSES` se necessário, sempre via token).
- [ ] `npx tsc --noEmit` limpo; build de `/admin` ok; testes T1–T15 verdes.

## 11. UI/Screen requirement
- Requires screen: **yes** — `ai/screen/aprovacao-usuarios-task-06.md` (fonte das decisões de layout, iniciais, cor de avatar, estados, a11y, tokens).
- Platform: web (Next.js, mobile-first/responsivo).
- Screens involved: tela 03 (Usuários — tabs + lista, este task) e tela 05 (confirma AppShell/BottomNav na zona admin; conteúdo da home é PRD futuro).

## 12. Constraints
- Sem `any` (CLAUDE.md §1) — todos os componentes/props/utils tipados explicitamente.
- Sem estilo inline / `style={{}}` (CLAUDE.md §2, MASTER §14) — só classes Tailwind/tokens; cor do avatar via `cn`+`AVATAR_CLASSES` (sem hex).
- Datas **somente** via date-fns (CLAUDE.md) — `parseISO`+`format`+guard `isValid`; sem `Intl`/template manual.
- Toda consulta via TanStack Query (CLAUDE.md §5) — consumir hooks TASK-03; proibido `getDocs`/`useEffect` de dados na UI.
- Componentes reutilizáveis e tipados (CLAUDE.md §6) — `UserList`/`UserListItem` puros (sem hook), `UserStatusList` isola a borda de dados.
- Reusar primitivos TASK-04 (`Tabs`/`Badge`/`Avatar`) — não recriar (MASTER §8).
- **Não** modificar `AdminGuard`/`(app)/admin/layout.tsx` (TASK-05), `AppShell`/`Header`/`BottomNav`/`SideNav`, hooks/serviço/schema (TASK-02/03).
- Mobile-first (MASTER §11) — funcional em ~360px; truncamento (`min-w-0`/`truncate`) evita overflow.
- Acessibilidade nível enhanced (MASTER §10) — roving focus de tabs (nativo), `<ul>/<li>`, `role` nos estados, contraste AA.
- Não commitar (revisão central).

## 13. Open questions
- **Contraste avatar (`chart-*` × foreground):** hipótese `c1..c3 → text-primary-foreground`, `c4/c5 → text-foreground`. Confirmar AA no `/review` visual; se um par falhar, trocar só o foreground daquele índice (token), nunca hex. Único ponto que pode exigir ajuste pós-implementação.
- **Localização da util:** `userAvatar.ts`/`userDate.ts` em `features/admin/components/` (coesão) vs `src/lib/` (reuso global). Spec escolhe feature-local por especificidade; mover para `lib/` se outra feature precisar de iniciais/avatar.
- **`aria-label` rico na tab:** opcional `aria-label="Pendentes, N usuários"` no `TabsTab` (leitura mais natural que "Pendentes 3"). Refino de a11y; default (texto + badge) já é acessível.
- **Skeleton fixo (3 linhas) vs número da última contagem:** spec usa nº fixo (3–4 linhas) por simplicidade; usar `counts[status]` para dimensionar o skeleton é refino opcional (evita salto de layout), decidir no `/review`.
- **`renderActions` (lista) vs `actions` (item):** ambos previstos para TASK-07; `renderActions` na `UserList` é o caminho preferido (mantém `UserListItem` agnóstico). Confirmar no plano da TASK-07.
