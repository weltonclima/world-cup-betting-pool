# UI-SPEC — TASK-03: EditProfileForm + AvatarCropModal (wiring)

## 1. Component Identity
- Name: `EditProfileForm` (edição — integra `AvatarCropModal`)
- Type: Component (form) + Modal trigger
- Tech: Next.js 15 / React 19, client component
- Complexity: Minimal (wiring sobre componentes existentes)

## 2. Visual Structure (ASCII)

```
EditProfileForm (inalterado, exceto fluxo do avatar)
┌──────────────────────────────────────────┐
│            ╭────────────╮                 │
│            │  Avatar     │  ← preview atual│
│            │  (size-24)  │                 │
│            ╰────────────╯ [📷]  ← botão    │
│            (input file hidden)             │
│   Nome   [ ............... ] (disabled)    │
│   E-mail [ ............... ] (disabled)    │
│   Apelido[ ............... ]               │
│            [ Salvar Alterações ]           │
└──────────────────────────────────────────┘
        │ seleciona arquivo → validateImageInput
        ▼
  <AvatarCropModal open file onConfirm onCancel>  ← TASK-02
        │ onConfirm(dataUrl) → updateProfile → toast
        ▼
  Avatar preview atualiza (via profile refetch)
```

Fluxo novo: clique 📷 → input file (gesto direto) → onChange valida → abre modal. Markup do form **não muda**.

## 3. Component Breakdown

| Component | Type | Props/State | States | Notes |
|---|---|---|---|---|
| Botão câmera | `Button size=icon` | `onClick→input.click()` | default/focus | gesto direto (iOS) |
| `<input type=file>` | hidden | `onChange` | — | `value=""` após captura |
| `AvatarCropModal` | modal | `open`,`file`,`onConfirm`,`onCancel` | aberto/fechado | TASK-02 |
| Toast (sonner) | feedback | — | success/error | já em uso |

## 4. Interaction States

| Element | Default | Hover | Active | Focus | Disabled | Loading | Error |
|---|---|---|---|---|---|---|---|
| Botão câmera | ícone | bg-hover | press | ring | opcional durante `cropOpen` | — (loading vive no modal) | — |
| Modal | — | — | — | — | — | spinner (TASK-02) | toast.error persistência |

## 5. Data Binding

| Field | Source | Transform | Update Trigger |
|---|---|---|---|
| `pendingFile` | input onChange | `validateImageInput` | seleção |
| `cropOpen` | estado local | — | seleção válida / confirm / cancel |
| `avatarUrl` | modal `onConfirm` | data URL | clique "Salvar Foto" |
| preview Avatar | `useProfile` refetch | — | após `mutateAsync` sucesso |

## 10. Tech-Specific Notes (Next.js / React 19)

- Manter `"use client"`.
- **iOS Safari**: `fileInputRef.current?.click()` permanece no `onClick` do botão — gesto direto. Modal abre via `onChange`, NUNCA por efeito/timer.
- `onChange`: capturar `file`, `event.target.value = ""` (permite reselecionar mesmo arquivo), validar, `setPendingFile`+`setCropOpen(true)` ou `toast.error`.
- `onConfirm` async: `await updateProfile.mutateAsync({ avatarUrl })`; sucesso → `toast.success` + fechar + limpar `pendingFile`; erro → `toast.error` + fechar.
- `onCancel`: fechar + limpar `pendingFile`.
- Remover `fileToCompressedDataUrl` do fluxo do form (compressão agora no modal); manter import só se ainda usado (não estará → remover import).
- Estado `uploading` antigo do botão pode sair (loading vive no modal); opcionalmente `disabled={cropOpen}` no botão.
- Acessibilidade do form preservada; modal traz a sua (TASK-02). Toasts dão feedback imediato.

## 12. Acceptance Criteria (UI)
- [ ] Seleção válida abre modal; inválida → toast, sem abrir.
- [ ] Confirmar → salva + toast.success + preview atualiza.
- [ ] Cancelar → fecha sem salvar; reseleção funciona.
- [ ] Markup/UX do restante do form inalterado.
- [ ] Sem regressão de foco/teclado; typecheck/lint/test verdes.
