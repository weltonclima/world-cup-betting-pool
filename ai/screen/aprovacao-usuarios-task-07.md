# SCREEN — APROVACAO-USUARIOS TASK-07: Ações de moderação + modal de confirmação

> Origem: `ai/plan/aprovacao-usuarios.md` §3 TASK-07 · PRD: `ai/prd/aprovacao-usuarios.md` (A1 Rejeitar=`blocked`, A5 Desbloquear=`blocked→approved`) · Contrato visual: `design-system/MASTER.md` (§2 cores, §3 tipografia, §4 espaçamento, §5 raio, §8 Button, §10 acessibilidade, §13 z-index, §14 convenções).
> Mock fonte-de-verdade: `docs/prd-01-2/04-aprovar-usuario.png` — modal de **sucesso** "Usuário aprovado!" (check verde, "{Nome} foi aprovado com sucesso.", caixa "O usuário receberá acesso imediatamente", botão "OK"). Mock `03-pendentes-admin.png` mostra os botões "Aprovar" (verde) + "Rejeitar" (vermelho) à direita de cada linha.
> Predecessoras consumidas (JÁ implementadas — **não reescrever**): TASK-03 `useUpdateUserStatus` (`src/features/admin/hooks/useUpdateUserStatus.ts` — `mutateAsync({uid,from,to})`, valida transição na borda, lança `InvalidStatusTransitionError`, invalida origem+destino no sucesso); TASK-04 `Dialog` (`src/components/ui/dialog.tsx` — Base UI, foco preso/Esc/aria nativos) e `Button` (`src/components/ui/button.tsx` — variantes `default`/`destructive`/`outline`/`ghost`, prop `render` p/ polimorfia, **não** `asChild`); TASK-06 slots de ação (`UserList.renderActions` / `UserListItem.actions` / `UserStatusList.renderActions` — JÁ existem, hoje read-only).
>
> **Escopo desta tela:** os **controles de ação por tab** injetados no slot de cada linha (`renderActions`) e os **diálogos** que gatilham/confirmam a mutação — confirmação-antes para ações destrutivas (Rejeitar/Bloquear), sucesso-depois para Aprovar (modal "Usuário aprovado!", mock 04) e confirmação leve para Desbloquear. **Não** toca em `UsersPanel`/`UserStatusList`/`UserListItem` (só injeta via `renderActions`), nem em hook/serviço/rules.

---

## 0. Leitura do mock + decisão de fluxo por ação

Mock `04-aprovar-usuario.png` (mobile, ~360px), de cima para baixo dentro do modal:

| Região | O que o mock mostra | Decisão |
|--------|---------------------|---------|
| Ícone | Círculo verde claro com check verde (com "raios"/confete sutil) | `CheckCircle2` (Lucide) `size={32}` em `text-primary` dentro de um disco `bg-primary/10 rounded-full` (sem confete — divergência §8). |
| Título | "Usuário aprovado!" | `DialogTitle` `text-lg font-semibold`. |
| Descrição | "João da Silva foi aprovado com sucesso." | `DialogDescription` com **nome interpolado** (`{user.name}`). |
| Caixa info | "O usuário receberá acesso imediatamente" em caixa verde clara | Bloco `rounded-lg bg-primary/10 p-3 text-sm text-foreground` (informativo, não interativo). |
| CTA | Botão verde "OK" full-width | `Button` (`default`, verde primary) full-width que fecha o diálogo. |
| Sem botão "Fechar" (X) | Mock não mostra X no canto | Modal de **sucesso** usa `showCloseButton={false}` (já é estado pós-sucesso; só "OK"). |

O mock 04 é claramente um modal de **sucesso pós-aprovação** — não um "confirmar antes". Daí a decisão de fluxo travada abaixo.

### 0.1 Fluxo por ação (TRAVADO)

| Ação | Tab | Transição | Variante botão | Fluxo de diálogo |
|------|-----|-----------|----------------|------------------|
| **Aprovar** | Pendentes | `pending→approved` | `default` (verde) | **Sucesso-depois.** Click no botão dispara a mutação **direto** (sem confirmar antes — ação construtiva, reversível via Bloquear). No sucesso, abre o **modal "Usuário aprovado!"** (mock 04). Em erro, **toast** (sem modal). |
| **Rejeitar** | Pendentes | `pending→blocked` | `destructive` (vermelho) | **Confirmar-antes.** Click abre `ConfirmActionDialog` (tom destrutivo); só ao confirmar dispara a mutação. Sucesso → **toast**; erro → **toast** (diálogo fecha no sucesso, permanece aberto no erro p/ retry). |
| **Bloquear** | Aprovados | `approved→blocked` | `destructive` (vermelho) | **Confirmar-antes** (idêntico a Rejeitar, copy própria). |
| **Desbloquear** | Bloqueados | `blocked→approved` | `outline` (neutro) | **Confirmar-leve.** Reverte um bloqueio → confirma-antes com `ConfirmActionDialog` em **tom neutro** (`default`), copy leve. Sucesso → **toast**. (Decisão: confirmar mesmo sendo construtivo, pois reabre acesso de quem foi barrado — evita clique acidental.) |

> **Por que Aprovar não confirma antes:** o mock 04 entrega um modal de **sucesso**, não de confirmação. Pedir confirmação **e** mostrar sucesso seriam dois modais para a ação mais comum (aprovar a fila de pendentes) — atrito desnecessário. Aprovar é a ação "feliz", construtiva e reversível (admin pode Bloquear depois). Logo: dispara direto, celebra no sucesso.
>
> **Por que destrutivas confirmam antes:** Rejeitar e Bloquear cortam acesso de um usuário (carga semântica de alerta, MASTER §2 destructive). Confirmação previne clique acidental e dá nome explícito à consequência. Sem modal de sucesso para destrutivas (toast basta — a troca de tab via invalidação já é o feedback visual).
>
> **Por que Desbloquear confirma (leve):** construtivo, mas reabre acesso → confirmar-antes em tom neutro evita reversão acidental de uma decisão de moderação. Sem modal de sucesso (toast).

---

## 1. Controles de ação por tab (slot `renderActions`)

`UserStatusList` passa `renderActions={(user) => <UserActions user={user} status={status} />}` por tab. `UserActions` decide os botões **pelo `status` da tab** (não infere do user — a tab é a fonte da intenção):

```
Pendentes  → [ Aprovar (default) ] [ Rejeitar (destructive) ]
Aprovados  → [ Bloquear (destructive) ]
Bloqueados → [ Desbloquear (outline) ]
```

- Botões ficam no `<div class="flex shrink-0 items-center gap-2">` que o `UserListItem` já renderiza quando `actions` é passado (TASK-06 §6).
- **Tamanho de toque (MASTER §10.2 — CRÍTICO):** botões `h-11` (44px) via `className` (o `Button` default é `h-8`; aqui sobrescreve para alvo mobile). Texto curto (`text-sm`), `px-3`. Em mobile estreito (~360px) com avatar+nome+2 botões, usar rótulos curtos; ícone Lucide opcional inline-start (`Check`/`X`/`Ban`/`RotateCcw`) `size={16}` para reforço — não obrigatório (texto é o nome acessível).
- **Estado de submit:** durante a mutação daquele user, **ambos** os botões da linha ficam `disabled` (evita Aprovar+Rejeitar concorrentes no mesmo doc) e o botão acionado recebe `aria-busy="true"` + spinner (`Loader2` `animate-spin motion-reduce:animate-none`, MASTER §10.6). `disabled:opacity-50 disabled:pointer-events-none` já vem do `Button`.

---

## 2. Estrutura de componentes (decisão travada)

| Componente | Responsabilidade | Reusa |
|---|---|---|
| `UserActions` | `"use client"`. Recebe `{ user, status }`; renderiza os botões da tab; detém o `useUpdateUserStatus()`, o estado de qual diálogo está aberto e o handler de submit (toast sucesso/erro). **Único ponto com lógica de mutação.** | `Button`, `ConfirmActionDialog`, `ApprovedDialog`, hook TASK-03, `sonner` |
| `ConfirmActionDialog` | Diálogo **reutilizável de confirmação-antes** (Rejeitar/Bloquear/Desbloquear). Controlado (`open`/`onOpenChange`); recebe `title`, `description`, `confirmLabel`, `confirmVariant`, `pending`, `onConfirm`. Trava fechar-no-backdrop e Esc enquanto `pending`. | `Dialog*`, `Button` |
| `ApprovedDialog` | Diálogo **de sucesso** "Usuário aprovado!" (mock 04). Controlado; recebe `open`/`onOpenChange` + `userName`. Só "OK". `showCloseButton={false}`. | `Dialog*`, `Button`, `CheckCircle2` |
| `userActionsConfig` (objeto/constantes) | Mapa `status → { actions[] }` com copy pt-BR de cada ação (rótulo botão, título/descrição do confirm, label de confirmação, variante). Sem hardcode disperso (CLAUDE.md §3). | — |

> **Por que `ConfirmActionDialog` genérico (1 componente) e `ApprovedDialog` separado:** as 3 confirmações destrutivas/neutras compartilham a mesma anatomia (título + descrição + cancelar/confirmar) → 1 componente parametrizado. O modal de sucesso tem **anatomia diferente** (ícone de celebração, caixa info, só OK, sem cancelar/X) e semântica oposta (pós-sucesso, não pré-ação) → componente próprio. Não forçar os dois no mesmo molde.
>
> **Por que `UserActions` detém o hook (1 por linha) e não `UsersPanel` (1 global):** mantém o estado de submit/diálogo **isolado por usuário** — aprovar o user A não desabilita os botões do user B, e cada linha tem seu próprio diálogo. Com <100 usuários e 1 mutação ativa por vez na prática, o custo de N hooks de mutação montados é irrelevante (mutation hooks não disparam fetch). Alternativa rejeitada — hook único no painel + `mutate` com `variables`: exigiria rastrear "qual user está em submit" manualmente; mais complexo, sem ganho.

---

## 3. Anatomia dos diálogos

### 3.1 `ConfirmActionDialog` (confirmar-antes — Rejeitar / Bloquear / Desbloquear)

```
<Dialog open={open} onOpenChange={pending ? noop : onOpenChange}>
  <DialogContent showCloseButton={!pending}
      onPointerDownOutside={pending ? preventDefault : undefined}
      onEscapeKeyDown={pending ? preventDefault : undefined}>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>                  ← ex.: "Rejeitar usuário?"
      <DialogDescription>{description}</DialogDescription> ← ex.: "{nome} será bloqueado e não poderá acessar o bolão. Você pode desbloquear depois."
    </DialogHeader>
    <DialogFooter>
      <DialogClose render={<Button variant="outline" disabled={pending}>Cancelar</Button>} />
      <Button variant={confirmVariant} onClick={onConfirm}
              disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
        {confirmLabel}                                     ← ex.: "Rejeitar"
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- `confirmVariant`: `destructive` (Rejeitar/Bloquear) ou `default` (Desbloquear). `Cancelar` sempre `outline`.
- **Botão de confirmação NÃO usa `DialogClose`** — ele dispara `onConfirm` (mutação) e o diálogo só fecha **no sucesso** (controlado pelo pai). Em erro, fica aberto (permite retry). `Cancelar` usa `DialogClose` (fecha imediatamente).
- **Trava durante submit (a11y CRÍTICO):** com `pending`, `onOpenChange` vira no-op, `onPointerDownOutside`/`onEscapeKeyDown` chamam `preventDefault`, `showCloseButton={false}` e Cancelar `disabled` — **fechar acidental impossível** enquanto a mutação corre. Ao resolver, restaura comportamento normal.
- Foco preso, retorno de foco ao gatilho, `role="dialog"`/`aria-modal`/`aria-labelledby`/`aria-describedby`: **nativos do `Dialog` Base UI** (TASK-04) — não reimplementar.

### 3.2 `ApprovedDialog` (sucesso-depois — Aprovar, mock 04)

```
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent showCloseButton={false} className="text-center">
    <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
      <CheckCircle2 size={32} class="text-primary" aria-hidden="true" />
    </div>
    <DialogHeader class="items-center">
      <DialogTitle>Usuário aprovado!</DialogTitle>
      <DialogDescription>{userName} foi aprovado com sucesso.</DialogDescription>
    </DialogHeader>
    <div class="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
      O usuário receberá acesso imediatamente.
    </div>
    <DialogFooter>
      <DialogClose render={<Button className="w-full h-11">OK</Button>} />
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- **Aparece só no sucesso** da aprovação (o pai abre `ApprovedDialog` no `onSuccess`/após `await mutateAsync`). Não confirma nada — celebra e informa.
- "OK" full-width (`w-full`), `default` (verde primary), `h-11`. Usa `DialogClose` → fecha ao clicar. Esc/backdrop podem fechar livremente (sem submit pendente aqui).
- `showCloseButton={false}`: o "OK" é a única saída visível (paridade com mock); Esc continua funcional (a11y — Base UI).

---

## 4. Estados (idle / submitting / success / error)

| Estado | Gatilho | UI |
|--------|---------|----|
| **idle** | inicial | Botões da tab habilitados; nenhum diálogo aberto. |
| **confirmando** (só destrutivas/desbloquear) | click no botão de ação | `ConfirmActionDialog` aberto; botões da linha permanecem (atrás do overlay). |
| **submitting** | confirm (destrutivas) ou click direto (Aprovar) | botão acionado `aria-busy` + spinner; **ambos** botões da linha `disabled`; em `ConfirmActionDialog`, fechar travado (§3.1). |
| **success** | `mutateAsync` resolve | **Aprovar:** fecha qualquer estado e abre `ApprovedDialog`. **Demais:** fecha `ConfirmActionDialog` + `toast.success`. Em ambos, o item some da tab atual (invalidação origem+destino do hook — **já feita**, NÃO reimplementar). |
| **error** | `mutateAsync` rejeita | `toast.error` com mensagem mapeada (§5). Botões reabilitam; `ConfirmActionDialog` (se aberto) **permanece** aberto para retry; Aprovar **não** abre `ApprovedDialog`. |

- **Sem optimistic UI.** O hook invalida no sucesso → a lista refaz a query e o item troca de tab. Não manipular cache manualmente aqui.
- **Toasts:** sucesso de Rejeitar/Bloquear/Desbloquear via Sonner (Aprovar usa o modal como feedback primário; toast de sucesso de Aprovar é **opcional/dispensável** para não duplicar com o modal — decisão: **só modal** para Aprovar, **só toast** para as outras 3).

---

## 5. Copy pt-BR + mapeamento de erro

### 5.1 Copy das ações (em `userActionsConfig`)

| Ação | Rótulo botão | Título confirm | Descrição confirm | Label confirm | Toast sucesso |
|------|--------------|----------------|-------------------|---------------|---------------|
| Aprovar | "Aprovar" | — (sem confirm) | — | — | — (modal "Usuário aprovado!") |
| Rejeitar | "Rejeitar" | "Rejeitar usuário?" | "{nome} será bloqueado e não poderá acessar o bolão. Você pode desbloquear depois." | "Rejeitar" | "Usuário rejeitado." |
| Bloquear | "Bloquear" | "Bloquear usuário?" | "{nome} perderá o acesso ao bolão imediatamente. Você pode desbloquear depois." | "Bloquear" | "Usuário bloqueado." |
| Desbloquear | "Desbloquear" | "Desbloquear usuário?" | "{nome} voltará a ter acesso ao bolão." | "Desbloquear" | "Usuário desbloqueado." |

### 5.2 Mapeamento de erro (`mapUserActionError`, padrão de `mapAuthError`)

A UI mapeia (services/hook não traduzem — CLAUDE.md). Dois erros relevantes:

| Origem | Detecção | Mensagem pt-BR (toast) |
|--------|----------|------------------------|
| `InvalidStatusTransitionError` (client, hook TASK-03) | `err instanceof InvalidStatusTransitionError` | "Não é possível alterar o status deste usuário." |
| Firestore rules negaram (`permission-denied`) | `FirebaseError` com `code === "permission-denied"` (ou string `code` contendo `permission-denied`) | "Você não tem permissão para esta ação." |
| Rede / desconhecido | fallback | "Ocorreu um erro inesperado. Tente novamente." |

- Espelha `src/features/auth/errors.ts`: tabela centralizada + fallback. Função pura `mapUserActionError(error: unknown): string`.
- `InvalidStatusTransitionError` é checado **antes** do `permission-denied` (é o erro client-side mais específico). Ordem: `instanceof InvalidStatusTransitionError` → `code === "permission-denied"` → fallback.

---

## 6. Mapeamento de cores das ações (MASTER §2/§8)

| Ação | Variante `Button` | Token efetivo | Racional |
|------|-------------------|---------------|----------|
| Aprovar | `default` | `bg-primary text-primary-foreground` (verde no tema) | CTA construtivo principal (mock: verde). |
| Rejeitar | `destructive` | `bg-destructive/10 text-destructive` | Corta acesso — alerta (MASTER §2 destructive = bloqueio). |
| Bloquear | `destructive` | idem | Idem Rejeitar. |
| Desbloquear | `outline` | `border-border bg-background` | Construtivo mas de menor hierarquia/raridade; neutro evita competir com Aprovar visualmente. |
| Cancelar (diálogo) | `outline` | idem | Saída segura, baixa ênfase. |
| Confirmar destrutivo (diálogo) | `destructive` | `bg-destructive/10 text-destructive` | Reforça a consequência no momento da confirmação. |
| OK (sucesso) | `default` | verde primary, `w-full` | Paridade com mock 04. |

> O `Button` `destructive` do projeto é **vermelho suave** (`bg-destructive/10 text-destructive`), não vermelho chapado — consistente com MASTER §1 (baixa distração) e já AA no tema. Não introduzir hex (MASTER §15).

---

## 7. Acessibilidade (MASTER §10 — nível CRITICAL)

- **Modal nativo (Base UI / TASK-04):** foco preso, Esc, retorno de foco ao gatilho, `role="dialog"`/`aria-modal="true"`, `aria-labelledby`←`DialogTitle`, `aria-describedby`←`DialogDescription` — **automáticos** quando Title/Description estão presentes. Ambos os diálogos têm Title+Description. **Não** adicionar focus-trap externo.
- **Fechar acidental travado no submit (CRÍTICO):** `ConfirmActionDialog` com `pending` desabilita backdrop-close (`onPointerDownOutside`+`preventDefault`), Esc (`onEscapeKeyDown`+`preventDefault`), X (`showCloseButton={false}`) e Cancelar (`disabled`). Garante que a mutação não seja interrompida por toque fora. Ao resolver, restaura.
- **`aria-busy`:** botão de confirmação/ação em submit recebe `aria-busy="true"`; spinner `Loader2` é `aria-hidden` (o estado é anunciado pelo `aria-busy`, não pelo ícone).
- **Área de toque ≥44px:** todos os botões de ação e de diálogo `h-11` (mobile crítico, MASTER §10.2). "OK" e "Cancelar"/"Confirmar" idem.
- **Foco inicial do diálogo:** Base UI move foco para o primeiro focável do `DialogContent`. Em `ConfirmActionDialog`, ordem natural Cancelar→Confirmar (Cancelar primeiro = saída segura como foco inicial; o `DialogFooter` é `flex-col-reverse` no mobile mas a ordem do DOM mantém Cancelar antes — confirmar no `/review` que o foco inicial não cai no botão destrutivo). Em `ApprovedDialog`, foco em "OK".
- **Contraste:** `text-destructive` sobre `bg-destructive/10`, `text-primary` sobre `bg-primary/10`, texto do diálogo `text-foreground`/`text-muted-foreground` — todos ≥ AA no tema (MASTER §10.1).
- **Reduced motion:** spinner e animações de entrada do diálogo respeitam `motion-reduce:animate-none` (MASTER §10.6); o `Dialog` Base UI já usa `data-open/closed:animate-*` que herdam a preferência.
- **Toast (Sonner):** região live polite nativa do Sonner — erro/sucesso anunciados sem roubar foco.
- **Sem `tabIndex` positivo; sem `style={{}}`; sem hex** (MASTER §14/§15).

---

## 8. Divergências intencionais vs mock (`04`)

1. **Confete/raios** ao redor do check — **não** reproduzidos (decoração; custo de manutenção sem ganho funcional). Substituído por disco `bg-primary/10` + `CheckCircle2`. Registrado.
2. **Sem botão X** no modal de sucesso — fiel ao mock (`showCloseButton={false}`); Esc continua funcional (a11y > pixel-perfect).
3. **Toast vs modal para destrutivas** — o mock só ilustra o sucesso de Aprovar; Rejeitar/Bloquear/Desbloquear usam toast (sem modal de sucesso) por decisão (§0.1) — evita 2 modais por ação e mantém a fila de moderação fluida.
4. **Ícones inline nos botões de ação** — opcionais (`Check`/`X`/`Ban`/`RotateCcw`); o mock 03 mostra só texto. Decisão: texto obrigatório (nome acessível), ícone é reforço opcional a decidir no `/review` por espaço no mobile.

---

## 9. Checklist de aceite visual/UX (resumo)

1. Pendentes: cada linha tem "Aprovar" (verde/`default`) + "Rejeitar" (vermelho/`destructive`); Aprovados: "Bloquear" (`destructive`); Bloqueados: "Desbloquear" (`outline`).
2. **Aprovar** dispara a mutação direto e, no sucesso, abre o modal "Usuário aprovado!" com o nome do usuário (mock 04); em erro, só toast.
3. **Rejeitar/Bloquear** abrem `ConfirmActionDialog` (tom destrutivo) **antes** de mutar; confirmam → mutação → toast sucesso; cancelar fecha sem mutar.
4. **Desbloquear** abre confirmação leve (tom neutro) antes de mutar; sucesso → toast.
5. Durante o submit: botão acionado com spinner + `aria-busy`; ambos os botões da linha `disabled`; `ConfirmActionDialog` **não** fecha por Esc/backdrop/X/Cancelar.
6. Pós-sucesso o item troca de tab (via invalidação do hook — não reimplementada aqui).
7. Erro `permission-denied` → "Você não tem permissão para esta ação."; `InvalidStatusTransitionError` → "Não é possível alterar o status deste usuário."; demais → fallback.
8. Modal com foco preso, Esc (quando permitido), retorno de foco; botões `h-11` (≥44px); contraste AA; sem `any`/`style`/hex.
