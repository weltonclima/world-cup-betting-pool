# SPEC — TASK-07: Ações de moderação + modal de confirmação

> Entrada: `ai/plan/aprovacao-usuarios.md` (TASK-07) · `ai/screen/aprovacao-usuarios-task-07.md` (contrato de UX/UI — fluxo por ação, anatomia dos diálogos, copy, cores, a11y) · `ai/prd/aprovacao-usuarios.md` (A1 Rejeitar=`blocked`, A5 Desbloquear=`blocked→approved`) · `ai/spec/aprovacao-usuarios-task-06.md` (slots `renderActions`/`actions` que esta task preenche) · `.claude/CLAUDE.md` (TS strict / sem `any`, sem estilo inline, toast via Sonner, componentes reutilizáveis e tipados, mobile-first) · `design-system/MASTER.md` (tokens/estilo travado).
> Tipo: `ui` / `application` · Criticidade: `high` · Risco técnico: `high` · Story points: 5.
> TDD: não (fluxo coberto no `/test`) · Screen: sim (`aprovacao-usuarios-task-07.md`) · Dependências: TASK-06, TASK-03 (todas JÁ implementadas) — Wave 4.
>
> Naming: convenção pós-PRD-00 (`ai/spec/<feature>-task-NN.md`, ver MEMORY).

---

## 1. Task: TASK-07 — Ações de moderação + modal de confirmação

## 2. Objetivo

Habilitar as quatro ações administrativas de moderação — **Aprovar** (`pending→approved`), **Rejeitar** (`pending→blocked`, A1), **Bloquear** (`approved→blocked`), **Desbloquear** (`blocked→approved`, A5) — como **botões contextuais por tab** injetados no slot `renderActions` (TASK-06), disparando a mutação via `useUpdateUserStatus` (TASK-03) com:

- **Confirmação-antes** para ações destrutivas (Rejeitar/Bloquear) e leve para Desbloquear, via `ConfirmActionDialog` reutilizável;
- **Modal de sucesso** "Usuário aprovado!" (mock 04) pós-aprovação, via `ApprovedDialog`;
- estados `pending`/`disabled` nos botões durante a mutação (com `aria-busy` + spinner);
- **toast Sonner** de sucesso (Rejeitar/Bloquear/Desbloquear) e de erro (todas), com mensagens pt-BR mapeadas (`permission-denied` → "Você não tem permissão para esta ação."; `InvalidStatusTransitionError` → "Não é possível alterar o status deste usuário.").

A troca de tab pós-sucesso ocorre via **invalidação origem+destino já feita pelo hook** (TASK-03) — **NÃO reimplementar**. Esta task **não** altera `UsersPanel`/`UserStatusList`/`UserListItem`/`UserList` além de ligar `renderActions` (já existente) a `UserActions`.

### Truths que devem ser verdadeiras ao fim
- Cada `UserStatusList` injeta `renderActions={(user) => <UserActions user={user} status={status} />}` (a prop já existe e é repassada à `UserList`/`UserListItem` — TASK-06).
- `UserActions` renderiza os botões certos por `status`: `pending` → Aprovar+Rejeitar; `approved` → Bloquear; `blocked` → Desbloquear.
- Aprovar dispara `mutateAsync({uid, from:"pending", to:"approved"})` **direto**; no sucesso abre `ApprovedDialog`; em erro mostra toast e **não** abre o modal.
- Rejeitar/Bloquear/Desbloquear abrem `ConfirmActionDialog` **antes** de mutar; só ao confirmar disparam `mutateAsync` com o par `from/to` correto; sucesso fecha o diálogo + `toast.success`; erro mantém o diálogo aberto + `toast.error`.
- Durante o submit de uma linha: botão acionado `aria-busy` + spinner; **ambos** botões da linha `disabled`; `ConfirmActionDialog` não fecha por Esc/backdrop/X/Cancelar.
- Erros mapeados em pt-BR por `mapUserActionError` (`InvalidStatusTransitionError` → mensagem clara; `permission-denied` → permissão; fallback genérico). Service/hook **não** traduzem.
- Sem `any`; sem `style={{}}`; sem hexadecimal em classe; toast via Sonner; só tokens MASTER; reusa `Dialog`/`Button` (TASK-04) e o hook (TASK-03) sem recriá-los.
- `npx tsc --noEmit` limpo; `rtk next build` compila `/admin`.

---

## 3. In scope — arquivos exatos

Novos em `src/features/admin/components/` + ligação dos slots em `UserStatusList.tsx` (que já recebe/repassa `renderActions`).

```
src/features/admin/components/
├── UserActions.tsx          (novo) — "use client"; botões por status + orquestra mutação/diálogos/toast
├── ConfirmActionDialog.tsx  (novo) — "use client"; diálogo reutilizável de confirmar-antes (controlado)
├── ApprovedDialog.tsx       (novo) — "use client"; modal de sucesso "Usuário aprovado!" (mock 04)
├── userActionsConfig.ts     (novo) — puro; mapa status → ações + copy pt-BR (sem hardcode disperso)
└── userActionErrors.ts      (novo) — puro; mapUserActionError(error: unknown): string (padrão mapAuthError)

src/features/admin/components/UserStatusList.tsx (editar) — passar renderActions={(user)=><UserActions user={user} status={status} />}
src/features/admin/index.ts (editar, opcional) — reexportar UserActions se necessário ao barrel
```

> **Não tocar:** `useUpdateUserStatus.ts`, `usersKeys.ts`, `useUsers.ts`, `services/users.ts`, `firestore.rules`, `src/components/ui/{dialog,button}.tsx`, `UserList.tsx`/`UserListItem.tsx`/`UsersPanel.tsx` (só consumir os slots `renderActions`/`actions` já existentes).

### 3.1 `userActionsConfig.ts` — mapa de ações + copy (puro, testável)

```ts
import type { UserStatus } from "@/types";

/** Variante de Button suportada pelas ações (subset de @/components/ui/button). */
export type ActionVariant = "default" | "destructive" | "outline";

export interface UserActionDef {
  /** Identidade da ação (chave de UI/teste). */
  readonly id: "approve" | "reject" | "block" | "unblock";
  /** Status destino da transição (origem = a tab atual). */
  readonly to: UserStatus;
  /** Rótulo do botão na linha. */
  readonly label: string;
  /** Variante visual do botão (SCREEN §6). */
  readonly variant: ActionVariant;
  /**
   * Fluxo: "success" → dispara direto e abre ApprovedDialog (Aprovar);
   * "confirm" → abre ConfirmActionDialog antes de mutar (demais).
   */
  readonly flow: "success" | "confirm";
  /** Copy do diálogo de confirmação (ausente quando flow === "success"). */
  readonly confirm?: {
    readonly title: string;
    /** `{name}` é interpolado com user.name no componente. */
    readonly description: string;
    readonly confirmLabel: string;
    readonly confirmVariant: ActionVariant;
  };
  /** Toast de sucesso (ausente p/ Aprovar — feedback é o modal). */
  readonly successToast?: string;
}

export const USER_ACTIONS: Record<UserStatus, readonly UserActionDef[]> = {
  pending: [
    { id: "approve", to: "approved", label: "Aprovar", variant: "default", flow: "success" },
    {
      id: "reject", to: "blocked", label: "Rejeitar", variant: "destructive", flow: "confirm",
      confirm: {
        title: "Rejeitar usuário?",
        description: "{name} será bloqueado e não poderá acessar o bolão. Você pode desbloquear depois.",
        confirmLabel: "Rejeitar", confirmVariant: "destructive",
      },
      successToast: "Usuário rejeitado.",
    },
  ],
  approved: [
    {
      id: "block", to: "blocked", label: "Bloquear", variant: "destructive", flow: "confirm",
      confirm: {
        title: "Bloquear usuário?",
        description: "{name} perderá o acesso ao bolão imediatamente. Você pode desbloquear depois.",
        confirmLabel: "Bloquear", confirmVariant: "destructive",
      },
      successToast: "Usuário bloqueado.",
    },
  ],
  blocked: [
    {
      id: "unblock", to: "approved", label: "Desbloquear", variant: "outline", flow: "confirm",
      confirm: {
        title: "Desbloquear usuário?",
        description: "{name} voltará a ter acesso ao bolão.",
        confirmLabel: "Desbloquear", confirmVariant: "default",
      },
      successToast: "Usuário desbloqueado.",
    },
  ],
};
```

- `from` da transição = o `status` da tab (chave do `Record`); `to` vem do def. Garante pares corretos: `pending→approved`/`pending→blocked`/`approved→blocked`/`blocked→approved`.
- Copy centralizada (CLAUDE.md §3 — sem hardcode disperso). `{name}` interpolado por `replace("{name}", user.name)` no componente.

### 3.2 `userActionErrors.ts` — mapeamento de erro pt-BR (puro, padrão `mapAuthError`)

```ts
import { FirebaseError } from "firebase/app";
import { InvalidStatusTransitionError } from "../hooks/useUpdateUserStatus";

const PERMISSION_MESSAGE = "Você não tem permissão para esta ação.";
const INVALID_TRANSITION_MESSAGE = "Não é possível alterar o status deste usuário.";
const FALLBACK_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

/**
 * Traduz um erro de mutação de status (TASK-03) para mensagem pt-BR (Sonner).
 * Ordem: erro de transição client-side (mais específico) → permission-denied das
 * rules → fallback. Função pura — a UI mapeia (services/hook não traduzem).
 */
export function mapUserActionError(error: unknown): string {
  if (error instanceof InvalidStatusTransitionError) return INVALID_TRANSITION_MESSAGE;
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return PERMISSION_MESSAGE;
  }
  // Defensivo: alguns wrappers expõem só `.code` string.
  if (
    typeof error === "object" && error !== null && "code" in error &&
    (error as { code: unknown }).code === "permission-denied"
  ) {
    return PERMISSION_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
```

- Espelha `src/features/auth/errors.ts`: constantes centralizadas + fallback, função pura determinística.
- `InvalidStatusTransitionError` é importado do hook (TASK-03 já o exporta). `permission-denied` é o código do Firestore quando as rules recusam o `update` (defesa de segurança real — PRD §3/§8).
- O `instanceof FirebaseError` cobre o caso real do SDK; o guard de `code` string é defensivo (não introduz `any` — usa narrowing).

### 3.3 `ConfirmActionDialog.tsx` — confirmação reutilizável (controlado)

```ts
"use client";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionVariant } from "./userActionsConfig";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant: ActionVariant;
  /** Submetendo a mutação: trava fechar acidental e habilita spinner/disabled. */
  pending: boolean;
  /** Dispara a mutação. NÃO fecha o diálogo (o pai fecha no sucesso). */
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open, onOpenChange, title, description,
  confirmLabel, confirmVariant, pending, onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!pending}
        onPointerDownOutside={(e) => { if (pending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (pending) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" className="h-11" disabled={pending}>Cancelar</Button>}
          />
          <Button
            variant={confirmVariant}
            className="h-11"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- **`onOpenChange={pending ? undefined : onOpenChange}`** + `onPointerDownOutside`/`onEscapeKeyDown` com `preventDefault` quando `pending` + `showCloseButton={!pending}` + Cancelar `disabled` ⇒ **fechar acidental impossível durante submit** (SCREEN §3.1/§7). Verificar no `/review` que as props `onPointerDownOutside`/`onEscapeKeyDown` do `DialogContent` (Base UI Popup) existem com esse nome; se a API for `onClose`/`onOpenChangeComplete`, adaptar mantendo o invariante "não fecha enquanto pending" — **decisão registrada em §13**.
- Botão de confirmação **não** é `DialogClose` (dispara `onConfirm`, o pai fecha no sucesso). Cancelar **é** `DialogClose` (fecha imediato).
- `Button` usa prop `render` (NÃO `asChild`) para a polimorfia com `DialogClose` (Base UI) — Cancelar/OK.

### 3.4 `ApprovedDialog.tsx` — modal de sucesso (mock 04)

```ts
"use client";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ApprovedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
}

export function ApprovedDialog({ open, onOpenChange, userName }: ApprovedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 size={32} className="text-primary" aria-hidden="true" />
        </div>
        <DialogHeader className="items-center">
          <DialogTitle>Usuário aprovado!</DialogTitle>
          <DialogDescription>{userName} foi aprovado com sucesso.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
          O usuário receberá acesso imediatamente.
        </div>
        <DialogFooter>
          <DialogClose render={<Button className="h-11 w-full">OK</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- Aberto pelo pai **no sucesso** de Aprovar. Só "OK" (`DialogClose` → fecha). `showCloseButton={false}` (paridade mock); Esc/backdrop livres (sem submit pendente).
- `DialogHeader className="items-center"` centraliza ícone+textos (o header default é `text-center` no mobile; `items-center` alinha o eixo cruzado). Sem `style`.

### 3.5 `UserActions.tsx` — orquestrador por linha

```ts
"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUpdateUserStatus } from "../hooks/useUpdateUserStatus";
import type { User, UserStatus } from "@/types";
import { USER_ACTIONS, type UserActionDef } from "./userActionsConfig";
import { mapUserActionError } from "./userActionErrors";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { ApprovedDialog } from "./ApprovedDialog";

export interface UserActionsProps {
  user: User;
  /** Status da tab (origem da transição). Decide quais ações aparecem. */
  status: UserStatus;
}

export function UserActions({ user, status }: UserActionsProps) {
  const actions = USER_ACTIONS[status];
  const mutation = useUpdateUserStatus();
  const [confirming, setConfirming] = useState<UserActionDef | null>(null);
  const [approvedOpen, setApprovedOpen] = useState(false);

  const pending = mutation.isPending;

  async function run(action: UserActionDef): Promise<void> {
    try {
      await mutation.mutateAsync({ uid: user.uid, from: status, to: action.to });
      if (action.flow === "success") {
        setApprovedOpen(true);
      } else {
        setConfirming(null);
        if (action.successToast) toast.success(action.successToast);
      }
    } catch (error) {
      toast.error(mapUserActionError(error));
      // confirm fica aberto p/ retry; success-flow não abre o ApprovedDialog.
    }
  }

  function onClick(action: UserActionDef): void {
    if (action.flow === "success") void run(action);
    else setConfirming(action);
  }

  const description = useMemo(
    () => confirming?.confirm?.description.replace("{name}", user.name) ?? "",
    [confirming, user.name],
  );

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant}
          className="h-11"
          disabled={pending}
          aria-busy={pending && /* acionada */ true ? undefined : undefined}
          onClick={() => onClick(action)}
        >
          {action.label}
        </Button>
      ))}

      {confirming?.confirm ? (
        <ConfirmActionDialog
          open={confirming !== null}
          onOpenChange={(o) => { if (!o) setConfirming(null); }}
          title={confirming.confirm.title}
          description={description}
          confirmLabel={confirming.confirm.confirmLabel}
          confirmVariant={confirming.confirm.confirmVariant}
          pending={pending}
          onConfirm={() => void run(confirming)}
        />
      ) : null}

      <ApprovedDialog
        open={approvedOpen}
        onOpenChange={setApprovedOpen}
        userName={user.name}
      />
    </>
  );
}
```

- **`mutateAsync` com `from: status` e `to: action.to`** garante o par correto por ação (a tab é a origem). O hook valida `canTransition` na borda (TASK-03) e invalida origem+destino no sucesso — **não reimplementar aqui**.
- `disabled={pending}` em **todos** os botões da linha (um único `mutation` por `UserActions` → ambos desabilitam juntos durante o submit). `aria-busy` no botão acionado: como `mutation.isPending` é por-linha (não por-botão), aplicar `aria-busy={pending}` ao botão acionado e ao botão de confirmação do diálogo. **Refino (§13):** se for necessário distinguir QUAL botão está busy, guardar `activeId` em estado; para o MVP, `disabled` em ambos + `aria-busy` no confirm do diálogo cobre o caso destrutivo, e o botão Aprovar recebe `aria-busy={pending}`. Simplificar o JSX acima removendo o ternário inválido — usar `aria-busy={pending}` direto.
- `confirming` guarda a ação em confirmação (ou `null`). `onOpenChange` fecha o confirm só quando `!pending` (a prop do dialog já trava o `pending`).
- O componente retorna um **fragmento** (sem wrapper) — o `UserListItem` já provê o `<div class="flex gap-2">` do slot (TASK-06 §6).

> **Correção do JSX (a implementação deve aplicar):** trocar `aria-busy={pending && ... ? undefined : undefined}` por `aria-busy={pending}` no `<Button>` de ação. O trecho acima é ilustrativo; o critério é "botão acionado tem `aria-busy` quando `pending`".

### 3.6 `UserStatusList.tsx` — ligar o slot (única edição em componente existente)

```ts
// dentro de UserStatusList (TASK-06), trocar a chamada read-only por:
return (
  <UserList
    users={data}
    renderActions={(user) => <UserActions user={user} status={status} />}
  />
);
```

- `status` já é prop de `UserStatusList` (TASK-06). `renderActions` já é repassado a `UserList`→`UserListItem.actions` (TASK-06 §6). Nenhuma outra mudança estrutural.
- Importar `UserActions` no topo do arquivo. Manter `"use client"` (já presente).

---

## 4. Out of scope
- **Invalidação de cache / troca de tab** → JÁ feita por `useUpdateUserStatus` (TASK-03); não reimplementar `invalidateQueries`.
- **Hook de mutação / serviço / schema de transição / rules** → TASK-02/03/01 (JÁ prontos; só consumir).
- **Primitivos `Dialog`/`Button`** → TASK-04 (JÁ prontos; só consumir, sem editar).
- **Layout do painel / tabs / lista / contadores / avatar / estados loading-empty-erro** → TASK-06 (só ligar `renderActions`).
- **Optimistic UI / `onSnapshot` / realtime** → leitura por query/refetch (PRD §4); sem update otimista.
- **Busca/filtro/paginação** → fora de escopo (<100 usuários).
- **Confirmação para Aprovar** → decisão SCREEN §0.1: Aprovar dispara direto (modal de sucesso, não de confirmação).

## 5. Contracts and interfaces

```ts
// userActionsConfig.ts
export type ActionVariant = "default" | "destructive" | "outline";
export interface UserActionDef { /* id, to, label, variant, flow, confirm?, successToast? — §3.1 */ }
export const USER_ACTIONS: Record<UserStatus, readonly UserActionDef[]>;

// userActionErrors.ts
export function mapUserActionError(error: unknown): string;

// ConfirmActionDialog.tsx
export interface ConfirmActionDialogProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  title: string; description: ReactNode;
  confirmLabel: string; confirmVariant: ActionVariant;
  pending: boolean; onConfirm: () => void;
}
export function ConfirmActionDialog(props: ConfirmActionDialogProps): JSX.Element;

// ApprovedDialog.tsx
export interface ApprovedDialogProps { open: boolean; onOpenChange: (open: boolean) => void; userName: string }
export function ApprovedDialog(props: ApprovedDialogProps): JSX.Element;

// UserActions.tsx
export interface UserActionsProps { user: User; status: UserStatus }
export function UserActions(props: UserActionsProps): JSX.Element;
```

- `User`/`UserStatus` de `@/types` (não redeclarar). `useUpdateUserStatus`/`InvalidStatusTransitionError` de `../hooks/useUpdateUserStatus` (TASK-03). `Dialog*`/`Button` de `@/components/ui/{dialog,button}`. `toast` de `sonner`. Ícones (`CheckCircle2`/`Loader2`) named de `lucide-react`. `cn` de `@/lib/utils`.

## 6. Data and persistence impact
- **Escrita:** uma `updateUserStatus(uid, to)` por ação confirmada, via `useUpdateUserStatus.mutateAsync` (TASK-03). O hook valida `canTransition` na borda e invalida `usersKeys.byStatus(from)` + `usersKeys.byStatus(to)` no sucesso → as tabs de origem e destino refazem a query (item troca de tab, contadores recontam).
- **Leitura:** nenhuma nova; consome o `User` já em mãos (vindo da lista) e o estado da `mutation`.
- **Cache:** esta task **não** cria chaves nem invalida diretamente (delega ao hook). Sem manipulação manual de `queryClient`.
- **Segurança:** a barreira real é a Firestore Rule (`update` só admin — TASK-01); a UI é defesa em profundidade. Um `permission-denied` (rules) é tratado como erro mapeado (não falha silenciosa) — PRD §8 / SCREEN §5.2.

## 7. Required tests (no `/test`)

> Ambiente: `// @vitest-environment jsdom`, `@testing-library/react` + `@testing-library/user-event`, `vitest`. **Mockar** `useUpdateUserStatus` (controlar `mutateAsync` resolved/rejected e `isPending`) e `sonner` (`toast.success`/`toast.error`). Não bater no Firestore. Utils puras testadas sem React.

**`userActionsConfig.test.ts` (puro):**
- T1 — `USER_ACTIONS.pending` tem `approve`(to `approved`, flow `success`) e `reject`(to `blocked`, flow `confirm`); `approved` tem `block`(to `blocked`); `blocked` tem `unblock`(to `approved`). Pares de transição corretos.
- T2 — toda ação `confirm` tem `confirm` + `successToast` definidos; `approve` (success) não tem `confirm` nem `successToast`.

**`userActionErrors.test.ts` (puro):**
- T3 — `mapUserActionError(new InvalidStatusTransitionError("pending","approved"))` → "Não é possível alterar o status deste usuário.".
- T4 — `mapUserActionError(new FirebaseError("permission-denied", "..."))` → "Você não tem permissão para esta ação.".
- T5 — `mapUserActionError({ code: "permission-denied" })` (objeto cru) → mensagem de permissão; erro desconhecido/`new Error("x")` → fallback.

**`UserActions.test.tsx` (fluxo, hook+sonner mockados):**
- T6 — **Aprovar (success-flow):** click em "Aprovar" chama `mutateAsync({uid, from:"pending", to:"approved"})` **direto** (sem diálogo de confirmação); ao resolver, `ApprovedDialog` abre (texto "Usuário aprovado!" + `user.name`); `toast.success` **não** é chamado para Aprovar.
- T7 — **Rejeitar (confirm-flow):** click em "Rejeitar" **não** muta ainda → abre `ConfirmActionDialog` ("Rejeitar usuário?"); clicar "Cancelar" fecha sem `mutateAsync`; reabrir e clicar "Rejeitar" no diálogo chama `mutateAsync({from:"pending", to:"blocked"})`; ao resolver, diálogo fecha + `toast.success("Usuário rejeitado.")`.
- T8 — **Bloquear:** tab `approved` → click "Bloquear" → confirma → `mutateAsync({from:"approved", to:"blocked"})` + `toast.success("Usuário bloqueado.")`.
- T9 — **Desbloquear:** tab `blocked` → click "Desbloquear" → confirma → `mutateAsync({from:"blocked", to:"approved"})` + `toast.success("Usuário desbloqueado.")`.
- T10 — **Erro mapeado:** `mutateAsync` rejeita com `permission-denied` → `toast.error("Você não tem permissão para esta ação.")`; `ConfirmActionDialog` **permanece aberto** (retry); no success-flow, `ApprovedDialog` **não** abre.
- T11 — **Erro de transição:** `mutateAsync` rejeita com `InvalidStatusTransitionError` → `toast.error("Não é possível alterar o status deste usuário.")`.
- T12 — **Disabled durante submit:** com `isPending: true`, todos os botões da linha estão `disabled`; o botão de confirmação tem `aria-busy="true"` e exibe spinner.
- T13 — **Botões por tab:** `status="pending"` renderiza Aprovar+Rejeitar; `status="approved"` só Bloquear; `status="blocked"` só Desbloquear.

**`ConfirmActionDialog.test.tsx` (a11y/trava):**
- T14 — `pending: true` → backdrop-click/Esc **não** fecham (handler chama `preventDefault`); X ausente (`showCloseButton={false}`); Cancelar `disabled`. `pending: false` → Cancelar fecha (`onOpenChange(false)`), Esc fecha.
- T15 — `role="dialog"`/`aria-modal` presentes (Base UI); `aria-labelledby`←título, `aria-describedby`←descrição; foco move para dentro do diálogo ao abrir.

**`ApprovedDialog.test.tsx`:**
- T16 — `open: true` + `userName="João da Silva"` → "Usuário aprovado!", "João da Silva foi aprovado com sucesso.", "O usuário receberá acesso imediatamente.", botão "OK"; clicar OK chama `onOpenChange(false)`; sem botão X.

**Build/type:**
- T17 — `npx tsc --noEmit` limpo (sem `any`).
- T18 — `rtk next build` compila `/admin`.

## 8. Acceptance criteria
- [ ] `UserStatusList` injeta `renderActions={(user) => <UserActions user={user} status={status} />}`; nenhuma outra mudança em `UserList`/`UserListItem`/`UsersPanel`.
- [ ] `UserActions` renderiza por tab: `pending`→Aprovar(`default`)+Rejeitar(`destructive`); `approved`→Bloquear(`destructive`); `blocked`→Desbloquear(`outline`).
- [ ] Aprovar dispara `mutateAsync({from:"pending", to:"approved"})` **direto**; sucesso abre `ApprovedDialog` com `user.name`; erro só toast (modal não abre).
- [ ] Rejeitar/Bloquear/Desbloquear abrem `ConfirmActionDialog` **antes** de mutar; confirmam com o par `from/to` correto; sucesso fecha o diálogo + `toast.success` específico; cancelar não muta.
- [ ] Durante o submit: botão acionado `aria-busy` + spinner; **ambos** botões da linha `disabled`; `ConfirmActionDialog` **não** fecha por Esc/backdrop/X/Cancelar.
- [ ] Erros mapeados: `permission-denied`→"Você não tem permissão para esta ação."; `InvalidStatusTransitionError`→"Não é possível alterar o status deste usuário."; demais→fallback. Mapeamento na UI (`mapUserActionError`), não no service/hook.
- [ ] Item troca de tab pós-sucesso via invalidação do hook (TASK-03) — **não** reimplementada nesta task.
- [ ] Reusa `Dialog`/`Button` (TASK-04) via prop `render` (não `asChild`) e o hook (TASK-03) sem editá-los.
- [ ] Modal com foco preso/Esc/retorno de foco (Base UI nativo); botões `h-11` (≥44px); copy via `userActionsConfig` (sem hardcode disperso); contraste AA.
- [ ] Sem `any`; sem `style={{}}`; sem hexadecimal; toast via Sonner; só tokens MASTER.
- [ ] `npx tsc --noEmit` limpo; build de `/admin` ok; testes T1–T18 verdes.

## 9. UI/Screen requirement
- Requires screen: **yes** — `ai/screen/aprovacao-usuarios-task-07.md` (fonte das decisões de fluxo por ação, anatomia dos diálogos, copy, cores, a11y).
- Platform: web (Next.js, mobile-first/responsivo).
- Screens involved: tela 03 (botões de ação na lista) e tela 04 (modal "Usuário aprovado!"). Confirmações destrutivas/leves são derivadas (não há mock dedicado — anatomia em SCREEN §3.1).

## 10. Constraints
- Sem `any` (CLAUDE.md §1) — props/configs/erros tipados; `error: unknown` + narrowing em `mapUserActionError`.
- Sem `style={{}}` / hex (CLAUDE.md §2, MASTER §14/§15) — só classes/tokens; `bg-primary/10`, `text-destructive`, etc.
- Toast **via Sonner** (CLAUDE.md / MASTER §8) — `toast.success`/`toast.error`; nunca alert nativo.
- Componentes reutilizáveis e tipados (CLAUDE.md §6) — `ConfirmActionDialog` parametrizado; `UserActions` por linha.
- Reusar `Dialog`/`Button` (TASK-04) e `useUpdateUserStatus` (TASK-03) — **não** recriar nem editar.
- **Não** reimplementar invalidação/troca de tab (TASK-03) nem layout/lista (TASK-06).
- Mobile-first (MASTER §11); botões `h-11` (≥44px, MASTER §10.2) p/ toque mobile crítico.
- Acessibilidade **critical** (MASTER §10) — foco preso, Esc, fechar-acidental travado no submit, `aria-busy`, contraste AA.
- Não commitar (revisão central).

## 11. Open questions / decisões registradas
- **API de `preventDefault` no fechar do `DialogContent` (Base UI):** o SPEC assume `onPointerDownOutside`/`onEscapeKeyDown` com `event.preventDefault()`. Se a versão do `@base-ui/react/dialog` expuser a interação por outra prop (ex.: `onOpenChange` com `reason`/`details`, ou `dismissible`/`closeOnEscape`), **adaptar mantendo o invariante** "não fecha enquanto `pending`" (ex.: condicionar `onOpenChange` a `!pending` e desabilitar dismiss). Confirmar no `/review`/implementação contra a API real do `dialog.tsx`. Invariante é inegociável; o mecanismo exato é detalhe.
- **`aria-busy` por-botão vs por-linha:** `mutation.isPending` é por `UserActions` (linha). MVP aplica `aria-busy={pending}` ao botão acionado + ao confirm do diálogo; ambos os botões da linha ficam `disabled`. Se o `/review` exigir busy só no botão clicado, guardar `activeId` em estado. (Correção do JSX ilustrativo em §3.5 já anotada.)
- **Toast de sucesso para Aprovar:** decisão = **só modal** "Usuário aprovado!" (sem toast), p/ não duplicar feedback. Demais ações = **só toast**. Reabrir se o `/review` quiser toast também no Aprovar.
- **Ícones inline nos botões de ação** (`Check`/`X`/`Ban`/`RotateCcw`, `size={16}`): opcionais; texto é o nome acessível. Decidir por espaço no mobile (~360px) no `/review` visual (SCREEN §8.4).
- **`UserActions` retorna fragmento** (slot já provê o wrapper flex do `UserListItem`). Se preferir encapsular o wrapper aqui, ajustar — mas evita `div` duplicado.
