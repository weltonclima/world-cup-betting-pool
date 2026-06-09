# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Integrar `AvatarCropModal` em `EditProfileForm`

## 2. Objective

Substituir o fluxo direto de upload de avatar (`onChange` → `fileToCompressedDataUrl` → salvar) pelo fluxo com recorte: seleção → validação → abrir `AvatarCropModal` → confirmar recorte → salvar a data URL via `updateProfile`. Preservar compatibilidade com iOS Safari (input disparado por clique direto no botão câmera).

## 3. In scope

- Editar `src/features/profile/components/EditProfileForm.tsx`:
  - Novo estado `const [pendingFile, setPendingFile] = useState<File | null>(null)` e `const [cropOpen, setCropOpen] = useState(false)`.
  - `onChange` do `<input type="file">`: ler `file`, limpar `event.target.value`, validar com `validateImageInput`; se válido → `setPendingFile(file)` + `setCropOpen(true)`; se inválido → `toast.error(mensagem)`.
  - Renderizar `<AvatarCropModal open={cropOpen} file={pendingFile} onConfirm={...} onCancel={...} />`.
  - `onConfirm(dataUrl)`: `await updateProfile.mutateAsync({ avatarUrl: dataUrl })` → `toast.success("Foto atualizada.")` → fechar modal + limpar `pendingFile`; em erro → `toast.error(...)`.
  - `onCancel`: fechar modal + limpar `pendingFile`.
  - Remover a chamada direta a `fileToCompressedDataUrl` em `EditProfileForm` (o recorte+compressão agora ocorrem dentro do modal).
  - Manter o `<input type="file">` disparado por clique direto no botão câmera (sem abertura programática com delay).
- Manter `fileToCompressedDataUrl` exportada no módulo `imageToDataUrl.ts` (NÃO remover — pode ser usada em outro contexto; verificar usos antes).

## 4. Out of scope

- `AvatarCropModal` (TASK-02, pronto).
- `imageToDataUrl.ts` (TASK-01, fechado) — nenhuma alteração.
- Mudança em `/api/users`, `useUpdateProfile`, schema ou persistência.
- Estilo/markup do restante do formulário (nome, e-mail, apelido).

## 5. Main technical areas involved

- `src/features/profile/components/EditProfileForm.tsx`
- Consome: `AvatarCropModal` (de `./AvatarCropModal` ou barrel `../components`), `validateImageInput`, `AvatarImageError` (de `../lib/imageToDataUrl`)
- Mantém: `useProfile`, `useUpdateProfile`, `toast` (sonner)

## 6. Business rules and behavior

- **Validação na seleção**: `validateImageInput(file)` antes de abrir o modal — falha (tipo/>10MB) → `toast.error(error.message)`, modal NÃO abre.
- **Reset do input**: `event.target.value = ""` após capturar o arquivo, permitindo reselecionar o mesmo arquivo depois de cancelar.
- **iOS Safari**: o `<input type="file">` continua acionado diretamente por `fileInputRef.current?.click()` no `onClick` do botão câmera (gesto direto do usuário). O modal abre via `onChange` (evento de seleção), nunca por timer/efeito.
- **Persistência**: `onConfirm` salva `{ avatarUrl: dataUrl }` exatamente como hoje (mesma chamada `updateProfile.mutateAsync`).
- **Estados de erro**: erro de compressão é tratado DENTRO do modal (TASK-02). Erro de persistência (`mutateAsync`) é tratado no `onConfirm` com `toast.error`. Em erro de persistência, o modal deve fechar? → fechar e manter `pendingFile` limpo (usuário pode tentar de novo). O modal não reabre sozinho.
- **Sem duplicar `uploading`**: o estado de loading do upload passa a ser responsabilidade do modal (botão "Salvar Foto"). O botão câmera não precisa mais de `uploading`/`disabled` durante compressão; pode manter `disabled` apenas enquanto `cropOpen` se desejado (opcional, não obrigatório).

## 7. Contracts and interfaces

Consome (TASK-02, existente):
```ts
<AvatarCropModal
  open={boolean}
  file={File | null}
  onConfirm={(dataUrl: string) => void | Promise<void>}
  onCancel={() => void}
/>
```

`updateProfile.mutateAsync({ avatarUrl })` — contrato inalterado (string data URL).

## 8. Data and persistence impact

Nenhuma mudança de schema/persistência. Mesma escrita de `avatarUrl` (base64 data URL) no doc do usuário via `/api/users`, já existente.

## 9. Required tests

Ambiente jsdom. `useProfile`/`useUpdateProfile` e `AvatarCropModal` são dependências externas — mockar.

- **Seleção válida abre o modal**: disparar `change` no input com File válido → `AvatarCropModal` recebe `open=true` e o `file`.
- **Seleção inválida não abre + toast**: File com tipo inválido → `toast.error` chamado, modal `open=false`.
- **onConfirm persiste**: simular `onConfirm(dataUrl)` do modal → `updateProfile.mutateAsync` chamado com `{ avatarUrl: dataUrl }`; `toast.success` em sucesso.
- **onCancel fecha**: simular `onCancel` → modal `open=false`, `mutateAsync` não chamado.
- (Opcional) erro de persistência → `toast.error`.

Mock recomendado: substituir `AvatarCropModal` por um duble que expõe botões/calls de `onConfirm`/`onCancel`, OU testar o handler de seleção e o wiring de props passados ao modal. Evitar reexercitar o canvas (já coberto em TASK-02).

## 10. Acceptance criteria

- Selecionar imagem válida abre o modal de recorte; inválida exibe toast e não abre.
- Confirmar no modal salva via `updateProfile.mutateAsync({ avatarUrl })` e mostra toast de sucesso.
- Cancelar fecha sem salvar; reseleção do mesmo arquivo funciona (input value limpo).
- `fileToCompressedDataUrl` não é mais chamada por `EditProfileForm`, mas permanece exportada no módulo.
- `npm test`, `npm run typecheck`, `npm run lint` verdes.
- Sem nova dependência; TS strict; pt-BR.

## 11. Constraints

- Não abrir `<input type="file">` programaticamente fora do gesto direto (iOS Safari).
- Não alterar `AvatarCropModal` nem `imageToDataUrl.ts`.
- Preservar markup/UX do restante do formulário.
- Reutilizar `toast` (sonner) já em uso no arquivo.
- Client component (já é `"use client"`).

## 12. Execution cost profile

- tdd: N/A
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator

- is_frontend: true
- reason: altera o componente de UI `EditProfileForm` (interação de seleção/modal, toasts, estado de UI). `/ui-spec` e `/patterns:nextjs` aplicáveis, porém é wiring sobre componentes já especificados — ui-spec pode ser leve.

## 14. Open questions

Nenhuma bloqueante. Decisão fixada: em erro de persistência, fechar o modal e deixar o usuário reiniciar o fluxo (sem auto-reabrir).
