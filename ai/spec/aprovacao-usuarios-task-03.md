# SPEC — TASK-03: Hooks TanStack Query (listas + contadores + mutação)

> Entrada: `ai/plan/aprovacao-usuarios.md` (TASK-03) + `ai/spec/aprovacao-usuarios-task-02.md` (service consumido) + `.claude/CLAUDE.md` (stack, TanStack Query obrigatório para consultas, `staleTime` 30min / `gcTime` 24h, TS strict / sem `any`, hooks em `src/hooks` ou `src/features/<dominio>/hooks`) + `src/services/users.ts` (`listUsersByStatus`, `updateUserStatus` — JÁ implementado) + `src/schemas/userStatusTransition.ts` (`statusTransitionSchema`/`canTransition` — TASK-02) + `src/providers/QueryProvider.tsx` (config do `QueryClient`).
> Tipo: `application` · Criticidade: `high` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: TASK-02 — Wave 2.

> Nota de naming: segue a convenção de features pós-PRD-00 (`ai/{spec}/<feature>-task-NN.md`, ver MEMORY). Slot gravado como `ai/spec/aprovacao-usuarios-task-03.md` para não colidir com `ai/spec/task-03.md` (SPEC da TASK-03 da fundação PRD-00).

---

## 1. Task: TASK-03 — Hooks TanStack Query (listas + contadores + mutação)

## 2. Objetivo

Fornecer a camada de **dados reativa** do painel admin (telas 03/04/05 do PRD-01.2) consumindo o service da TASK-02 via **TanStack Query** (regra obrigatória do CLAUDE.md — nenhuma consulta direta a `useEffect`/`getDocs` na UI). Três responsabilidades:

1. **`useUsersByStatus(status)`** — uma `useQuery` por tab (`pending` / `approved` / `blocked`), com **chave de query estável** e respeitando `staleTime`/`gcTime` do projeto (herdados do `QueryClient` global).
2. **Contadores das 3 tabs** — derivação dos totais Pendentes/Aprovados/Bloqueados para o badge das tabs (TASK-06).
3. **`useUpdateUserStatus()`** — `useMutation` que chama `updateUserStatus` e, **no sucesso, invalida as queries das tabs de ORIGEM e DESTINO** para recontagem/relista (R2 do plano). A transição é **validada na borda** (`canTransition`/`statusTransitionSchema`, TASK-02) **antes** de chamar o service.

Os hooks são finos: orquestram cache e invalidação, não reimplementam Firestore (isso é da TASK-02) nem renderizam UI (TASK-06/07). Erros do service propagam crus para a UI traduzir (TASK-07) — esta camada **não** traduz mensagens.

### Truths que devem ser verdadeiras ao fim
- Existe um **factory de query keys** único e estável: `usersKeys.byStatus(status) === ["users", "by-status", status]`. Toda a feature (queries + invalidação) usa ESSE factory — sem strings literais soltas.
- `useUsersByStatus(status)` retorna o `UseQueryResult<User[]>` de uma `useQuery` com `queryKey: usersKeys.byStatus(status)` e `queryFn: () => listUsersByStatus(status)`. Não redefine `staleTime`/`gcTime` (herda do `QueryClient` global = 30min / 24h).
- Os contadores das 3 tabs vêm de **3 queries** (uma por status), expostos via `useUserStatusCounts()` → `{ pending, approved, blocked }` (`number`, default `0` enquanto carrega/sem dados).
- `useUpdateUserStatus()` expõe uma `useMutation`; a variável de mutação é `{ uid, from, to }`.
  - Antes de chamar o service, valida `canTransition(from, to)`; transição inválida **rejeita** a mutação (sem tocar o Firestore).
  - `mutationFn` válida → `updateUserStatus(uid, to)`.
  - `onSuccess` → `invalidateQueries` das chaves de **origem** (`usersKeys.byStatus(from)`) **e destino** (`usersKeys.byStatus(to)`).
- Hooks vivem em `src/features/admin/hooks/` e são reexportados pelo barrel da feature (`src/features/admin/index.ts`).
- Sem `any`; TS strict; sem `useEffect`/fetch manual para dados (regra 5 do CLAUDE.md).

---

## 3. In scope

### `src/features/admin/hooks/usersKeys.ts` (novo) — factory de query keys
- Fonte única das chaves de query da feature. Evita strings mágicas e drift entre query e invalidação (causa raiz do R2).
```ts
import type { UserStatus } from "@/types";

export const usersKeys = {
  all: ["users"] as const,
  byStatus: (status: UserStatus) => ["users", "by-status", status] as const,
} as const;
```
- Chave estável: o array é determinístico para o mesmo `status` (TanStack Query serializa por igualdade estrutural).

### `src/features/admin/hooks/useUsers.ts` (novo) — leitura + contadores
- `useUsersByStatus(status: UserStatus): UseQueryResult<User[]>`:
  ```ts
  export function useUsersByStatus(status: UserStatus) {
    return useQuery({
      queryKey: usersKeys.byStatus(status),
      queryFn: () => listUsersByStatus(status),
    });
  }
  ```
  - **Não** passa `staleTime`/`gcTime` (herda do `QueryClient` global — 30min/24h). Documentar no JSDoc que a herança é intencional.
- `useUserStatusCounts(): UserStatusCounts` — **3 queries** (decisão §6), derivando os totais:
  ```ts
  export interface UserStatusCounts {
    pending: number;
    approved: number;
    blocked: number;
  }

  export function useUserStatusCounts(): UserStatusCounts {
    const pending = useUsersByStatus("pending");
    const approved = useUsersByStatus("approved");
    const blocked = useUsersByStatus("blocked");
    return {
      pending: pending.data?.length ?? 0,
      approved: approved.data?.length ?? 0,
      blocked: blocked.data?.length ?? 0,
    };
  }
  ```
  - Reusa `useUsersByStatus` → **compartilha cache** com as listas das tabs (mesma `queryKey`): nenhuma query extra além das 3 já necessárias para renderizar as listas. Contador = `data?.length`, não uma agregação separada.
  - Default `0` enquanto `data === undefined` (loading/erro) — o badge nunca renderiza `NaN`/`undefined`.

### `src/features/admin/hooks/useUpdateUserStatus.ts` (novo) — mutação + invalidação
- Variável de mutação tipada:
  ```ts
  export interface UpdateUserStatusVars {
    uid: string;
    from: UserStatus;
    to: UserStatus;
  }
  ```
- Hook:
  ```ts
  export function useUpdateUserStatus() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ uid, from, to }: UpdateUserStatusVars) => {
        if (!canTransition(from, to)) {
          throw new InvalidStatusTransitionError(from, to);
        }
        await updateUserStatus(uid, to);
      },
      onSuccess: (_data, { from, to }) => {
        void queryClient.invalidateQueries({
          queryKey: usersKeys.byStatus(from),
        });
        void queryClient.invalidateQueries({
          queryKey: usersKeys.byStatus(to),
        });
      },
    });
  }
  ```
- `InvalidStatusTransitionError` (classe `Error` dedicada, exportada) — permite à UI (TASK-07) distinguir "transição barrada no client" de erro do Firestore (`permission-denied`). Mensagem default reusa o texto do schema; carrega `from`/`to`.
  - Alternativa aceitável: usar diretamente `statusTransitionSchema.parse({ from, to })` (lança `ZodError`). Decisão registrada em §6 — preferir a classe dedicada por clareza de UI; se optar pelo `parse`, ajustar T11 para `ZodError`.

### Barrel — `src/features/admin/index.ts`
- Substituir o placeholder `export {};` pelos reexports públicos:
  ```ts
  export {
    useUsersByStatus,
    useUserStatusCounts,
    type UserStatusCounts,
  } from "./hooks/useUsers";
  export {
    useUpdateUserStatus,
    InvalidStatusTransitionError,
    type UpdateUserStatusVars,
  } from "./hooks/useUpdateUserStatus";
  export { usersKeys } from "./hooks/usersKeys";
  ```

### Tests (TDD) — `src/features/admin/hooks/__tests__/`
- `useUsers.test.tsx` e `useUpdateUserStatus.test.tsx` (jsdom + RTL `renderHook` + `QueryClientProvider` wrapper), mockando `@/services/users`. Ver §9.

---

## 4. Out of scope
- **UI das tabs/lista/contador** (render do badge, avatar, estados visuais de loading/empty/erro) → **TASK-06**.
- **Botões de ação, modal de confirmação, toast Sonner e tradução de erro** (`permission-denied`→pt-BR, `InvalidStatusTransitionError`→mensagem) → **TASK-07**. Este hook só **propaga** o erro.
- **Optimistic update** (mover o item de tab antes do servidor confirmar) — **opcional, fora do contrato mínimo**. A invalidação origem+destino é o mínimo exigido (R2). Anotado como refino em §13.
- **`onSnapshot`/realtime** — leitura é por query/refetch (PRD §4). Pending atualiza via "Atualizar status" (já existente).
- **Service de Firestore** (`listUsersByStatus`/`updateUserStatus`) e **schema de transição** (`statusTransitionSchema`/`canTransition`) → **TASK-02** (JÁ implementados; aqui só consumidos).
- **`AdminGuard`/gating de rota e nav** → **TASK-05**.
- **Paginação / contagem agregada server-side** (`<100 usuários` — listagem simples basta; `data.length` é exato).

## 5. Main technical areas
- `src/features/admin/hooks/usersKeys.ts` (novo) — query keys factory.
- `src/features/admin/hooks/useUsers.ts` (novo) — `useUsersByStatus` + `useUserStatusCounts`.
- `src/features/admin/hooks/useUpdateUserStatus.ts` (novo) — mutação + invalidação + `InvalidStatusTransitionError`.
- `src/features/admin/index.ts` (substitui placeholder pelos reexports).
- `src/services/users.ts` (consumido — sem alteração).
- `src/schemas/userStatusTransition.ts` (`canTransition`/`statusTransitionSchema` consumidos — sem alteração).
- `src/types` (`User`, `UserStatus` — reuso, sem alteração).
- `src/providers/QueryProvider.tsx` (config herdada — sem alteração; cache 30min/24h vive aqui).
- `src/features/admin/hooks/__tests__/useUsers.test.tsx` + `useUpdateUserStatus.test.tsx` (novos).

## 6. Business rules and behavior

- **Chave de query única e estável (R2):** toda query e toda invalidação passam por `usersKeys.byStatus(status)`. Proibido literal `["users", ...]` solto fora do factory — drift de chave é a causa raiz da contagem obsoleta apontada no plano.

- **Cache herdado, não redefinido:** os hooks NÃO passam `staleTime`/`gcTime` próprios; herdam o default do `QueryClient` global (`makeQueryClient`: 30min/24h). Garante coerência com a política do projeto e evita números mágicos duplicados.

- **Contadores = 3 queries reusando as listas (decisão de design):**
  - **Escolhido:** `useUserStatusCounts` chama `useUsersByStatus` 3× e usa `data?.length`. Como cada tab da TASK-06 já dispara `useUsersByStatus(status)`, as 3 queries **já existem** — o contador compartilha o **mesmo cache** (mesma `queryKey`), sem custo de rede extra. Contagem exata (`<100 usuários`, sem paginação).
  - **Rejeitado — hook agregador com `useQueries`:** adicionaria uma abstração sem ganho; as keys precisariam ser as mesmas para compartilhar cache, então `useQueries` só reescreveria o que 3 `useUsersByStatus` já fazem.
  - **Rejeitado — query de contagem dedicada (`getCountFromServer`):** outra `queryKey` → cache separado → o contador não reflete invalidação da lista sem invalidar 2 chaves; viola o princípio "uma fonte por status". Desnecessário para `<100` docs.

- **Invalidação origem + destino (R2):** a mutação `pending→approved` (Aprovar) deve invalidar **`pending`** (item sai da tab origem → recontagem) **e** `approved` (item entra → relista/recontagem). Idem para as 4 transições. Invalidar só o destino deixaria a contagem da origem obsoleta. As 4 transições e seus pares de invalidação:
  | Ação | `from→to` | Invalida |
  |---|---|---|
  | Aprovar | `pending→approved` | `pending`, `approved` |
  | Rejeitar | `pending→blocked` | `pending`, `blocked` |
  | Bloquear | `approved→blocked` | `approved`, `blocked` |
  | Desbloquear | `blocked→approved` | `blocked`, `approved` |

- **Validação de transição na borda (TASK-02):** `mutationFn` chama `canTransition(from, to)` ANTES de `updateUserStatus`. Transição fora da tabela (ex.: `approved→pending`, `x→x`) **lança** (`InvalidStatusTransitionError`) e **não** atinge o Firestore. Defesa em profundidade: as Security Rules (TASK-01) são a barreira real; isto previne disparo inválido no client e dá erro claro à UI.

- **Sem tradução de erro:** erro do service (`permission-denied`, `unavailable`, `ZodError` de parse…) e o `InvalidStatusTransitionError` propagam crus pelo `error` da query/mutation. A UI (TASK-07) mapeia para pt-BR/toast.

- **`onSuccess` não faz refetch manual:** apenas `invalidateQueries` (marca stale → TanStack refaz quando a tab estiver montada/observada). Sem `refetchQueries` forçado — evita refetch de tab não visível.

## 7. Contracts and interfaces
```ts
// src/features/admin/hooks/usersKeys.ts
export const usersKeys: {
  all: readonly ["users"];
  byStatus: (status: UserStatus) => readonly ["users", "by-status", UserStatus];
};

// src/features/admin/hooks/useUsers.ts
export function useUsersByStatus(status: UserStatus): UseQueryResult<User[]>;

export interface UserStatusCounts {
  pending: number;
  approved: number;
  blocked: number;
}
export function useUserStatusCounts(): UserStatusCounts;

// src/features/admin/hooks/useUpdateUserStatus.ts
export interface UpdateUserStatusVars {
  uid: string;
  from: UserStatus;
  to: UserStatus;
}
export class InvalidStatusTransitionError extends Error {
  readonly from: UserStatus;
  readonly to: UserStatus;
}
export function useUpdateUserStatus(): UseMutationResult<
  void,
  Error,
  UpdateUserStatusVars
>;
```
- `User` e `UserStatus` reusados de `@/types` (não redeclarar).
- Tipos de retorno (`UseQueryResult`/`UseMutationResult`) de `@tanstack/react-query`.

## 8. Data and persistence impact
- **Leitura:** delega a `listUsersByStatus` (TASK-02) — 1 query Firestore por `status` distinto observado, deduplicada pelo cache do TanStack Query (3 status → no máx. 3 queries simultâneas, compartilhadas entre lista e contador).
- **Escrita:** delega a `updateUserStatus` (TASK-02) — 1 `updateDoc` parcial (`status` + `updatedAt`). A invalidação subsequente provoca **até 2 refetches** (origem + destino) quando essas tabs estão observadas.
- **Cache:** chaves `["users","by-status",<status>]`; `staleTime` 30min / `gcTime` 24h (herdados). Nenhuma escrita direta de cache (`setQueryData`) no contrato mínimo — só `invalidateQueries`.
- Nenhum índice novo além do já anotado na TASK-02 (`status + createdAt`).

## 9. Required tests (TDD — escritos antes da implementação)

> Ambiente: `// @vitest-environment jsdom`, `@testing-library/react` (`renderHook`, `waitFor`), `vitest`. Wrapper de teste com `QueryClientProvider` + `QueryClient` dedicado por teste (sem retry, para falhas determinísticas):
> ```ts
> function makeWrapper() {
>   const client = new QueryClient({
>     defaultOptions: { queries: { retry: false } },
>   });
>   return ({ children }: { children: ReactNode }) => (
>     <QueryClientProvider client={client}>{children}</QueryClientProvider>
>   );
> }
> ```
> Mock do service: `vi.mock("@/services/users", () => ({ listUsersByStatus: vi.fn(), updateUserStatus: vi.fn() }))`. Mock de `@/schemas` NÃO é necessário (usar `canTransition` real — é puro e barato; valida a integração borda↔schema).

### `src/features/admin/hooks/__tests__/useUsers.test.tsx`
- **T1 — query monta com a chave certa:** `renderHook(() => useUsersByStatus("pending"))` chama `listUsersByStatus` com `"pending"`; após `waitFor`, `result.current.data` é o array mockado. (Reforço opcional: inspecionar `queryClient.getQueryCache()` confirma a presença de `["users","by-status","pending"]`.)
- **T2 — `usersKeys.byStatus` é estável e correto:** `usersKeys.byStatus("approved")` deep-equals `["users","by-status","approved"]`; duas chamadas com o mesmo status produzem arrays estruturalmente iguais.
- **T3 — contadores corretos:** `listUsersByStatus` mockado retorna 2 docs p/ `pending`, 3 p/ `approved`, 1 p/ `blocked`; `renderHook(() => useUserStatusCounts())` → após `waitFor`, `{ pending: 2, approved: 3, blocked: 1 }`.
- **T4 — contador default 0 enquanto carrega:** antes de resolver as promises (`listUsersByStatus` pendente), o snapshot inicial é `{ pending: 0, approved: 0, blocked: 0 }` (sem `undefined`/`NaN`).

### `src/features/admin/hooks/__tests__/useUpdateUserStatus.test.tsx`
- **T5 — transição válida chama o service:** `mutateAsync({ uid: "u1", from: "pending", to: "approved" })` → `updateUserStatus` chamado com `("u1", "approved")`; mutation resolve.
- **T6 — invalida origem + destino:** com `vi.spyOn(queryClient, "invalidateQueries")` (wrapper que expõe o `client`), após sucesso de `pending→approved` há invalidação de `usersKeys.byStatus("pending")` **e** `usersKeys.byStatus("approved")` (asserir os 2 `queryKey`). Repetir ≥1 outra transição (ex.: `approved→blocked` invalida `approved`+`blocked`) para cobrir o mapeamento, não só um caso.
- **T7 — transição inválida barrada:** `mutateAsync({ uid: "u1", from: "approved", to: "pending" })` **rejeita** com `InvalidStatusTransitionError` e `updateUserStatus` **não** é chamado; `invalidateQueries` **não** é chamado (nada invalidado em falha pré-serviço).
- **T8 — no-op barrado:** `from === to` (ex.: `approved→approved`) também rejeita e não toca o service (cobre o caso de clique acidental).
- **T9 — erro do service propaga:** `updateUserStatus` rejeita com `{ code: "permission-denied" }`; `mutateAsync` rejeita com o **mesmo** erro (sem tradução) e `invalidateQueries` **não** roda (`onSuccess` não dispara em erro).

## 10. Acceptance criteria
- [ ] `usersKeys.byStatus(status)` retorna `["users","by-status",status]`; é o **único** lugar com a string de chave (queries e invalidação o usam).
- [ ] `useUsersByStatus(status)` é uma `useQuery` com `queryKey: usersKeys.byStatus(status)` e `queryFn` chamando `listUsersByStatus(status)`; **não** redefine `staleTime`/`gcTime` (herda 30min/24h).
- [ ] `useUserStatusCounts()` retorna `{ pending, approved, blocked }` (3 queries reusando `useUsersByStatus`; `data?.length ?? 0`).
- [ ] `useUpdateUserStatus()` valida `canTransition(from, to)` antes do service; transição inválida rejeita sem tocar o Firestore.
- [ ] `onSuccess` invalida `usersKeys.byStatus(from)` **e** `usersKeys.byStatus(to)` (origem + destino).
- [ ] Camada não traduz erros (service e `InvalidStatusTransitionError` propagam crus).
- [ ] Hooks em `src/features/admin/hooks/` e reexportados em `src/features/admin/index.ts` (placeholder `export {}` removido).
- [ ] Reuso de `User`/`UserStatus` (`@/types`) e `canTransition` (`@/schemas`) — sem redefinição.
- [ ] Sem `any`; sem `useEffect`/fetch manual de dados; TS strict.
- [ ] `npx vitest run src/features/admin/hooks/__tests__` verde (T1–T9).
- [ ] `npx tsc --noEmit` limpo.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none (consumido por TASK-06 — tabs/lista/contador — e TASK-07 — ações/modal).

## 12. Constraints
- Não usar `any` (CLAUDE.md regra 1); tipar variável de mutação e retorno dos hooks.
- Toda consulta via TanStack Query (CLAUDE.md regra 5) — proibido `useEffect`+`getDocs`/fetch manual na feature.
- `staleTime`/`gcTime` herdados do `QueryClient` global (30min/24h) — **não** hardcodar nos hooks.
- Hooks reutilizáveis e totalmente tipados (regra 6); chave de query centralizada (sem string mágica).
- Não traduzir erros nesta camada (UI mapeia — TASK-07).
- Validar transição com `canTransition`/`statusTransitionSchema` (TASK-02) **na borda** antes do service.
- Sem `onSnapshot`/realtime (leitura por query/refetch — PRD §4).
- Não commitar (revisão central).

## 13. Open questions
- **Optimistic update (opcional):** mover o item de tab e ajustar contadores via `onMutate`/`setQueryData` antes do servidor confirmar, com rollback em `onError`. Fora do contrato mínimo (invalidação basta para `<100` usuários e refetch barato). Decidir no `/review` se a percepção de latência justifica.
- **`InvalidStatusTransitionError` vs `ZodError`:** spec escolhe a classe dedicada (UI distingue erro de client de erro de servidor). Se o time preferir reusar `statusTransitionSchema.parse` direto, T7/T8 passam a asserir `ZodError` e a UI mapeia pela `issue.message` ("Transição de status não permitida.").
- **Reuso futuro:** se outra feature precisar de leitura de `users` por outra dimensão, estender `usersKeys` (ex.: `byRole`) mantendo `all: ["users"]` como prefixo para invalidação em lote — não necessário agora.
