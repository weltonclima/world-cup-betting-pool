# PLAN — PRD-09: Modal de Recorte de Avatar

## 1. Planning summary

Feature de baixa complexidade sistêmica: todo o impacto fica dentro de `src/features/profile/`. Sem mudança de API, sem mudança de persistência, sem nova rota. Decisão de library resolvida: **canvas puro + Pointer Events** (zero nova dependência) — o escopo é 1:1 fixo, sem zoom/rotação, e a infraestrutura de canvas já existe em `imageToDataUrl.ts`.

**Bloqueador pré-existente detectado**: os testes de `imageToDataUrl.test.ts` importam `scaledDimensions`, função que não existe no arquivo atual (que exporta `squareCrop`). A suite está quebrada antes de começarmos. TASK-01 resolve isso como primeira ação.

3 tarefas, estimativa total: 10 pontos.

---

## 2. Recommended execution phases

- **Phase 1 – Foundation**: corrigir discrepância de testes + estender `imageToDataUrl.ts` com lógica de crop por coordenadas.
- **Phase 2 – Component**: criar `AvatarCropModal` (UI + interação canvas/Pointer Events).
- **Phase 3 – Integration**: integrar modal em `EditProfileForm`, substituindo o fluxo direto.

---

## 3. Tasks

### TASK-01 – Corrigir e estender imageToDataUrl.ts

- **Type:** domain
- **Goal:** (1) Resolver a discrepância entre o arquivo e os testes existentes (`scaledDimensions` x `squareCrop`). (2) Adicionar função `cropRectToCompressedDataUrl` que recebe um `HTMLImageElement` e coordenadas de recorte e retorna a data URL comprimida.
- **Scope:**
  - Identificar qual contrato está correto: testes ou implementação.
  - Garantir que `imageToDataUrl.ts` exporte as funções que os testes existentes esperam (sem regressão).
  - Adicionar: `export type CropRect = { x: number; y: number; size: number }` e `cropRectToCompressedDataUrl(img: HTMLImageElement, crop: CropRect, maxBytes?: number): Promise<string>`.
  - A nova função aplica `drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, 256, 256)` no canvas e roda o loop de qualidade decrescente existente.
  - Testes existentes devem passar. Novos testes para `cropRectToCompressedDataUrl` (partes puras/testáveis — validação de coords, saída de dimensão).
- **Main modules/files likely involved:**
  - `src/features/profile/lib/imageToDataUrl.ts`
  - `src/features/profile/lib/__tests__/imageToDataUrl.test.ts`
- **Dependencies:** nenhuma
- **Story points:** 3
- **Criticality:** high
- **Technical risk:** low
- **Recommended TDD later:** yes
- **Execution cost:**
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- **Notes:** A discrepância indica que o arquivo foi modificado na working tree (M no git status) após os testes serem escritos. O spec deve clarificar o contrato correto antes de qualquer implementação.

---

### TASK-02 – Criar AvatarCropModal

- **Type:** application
- **Goal:** Componente modal com pré-visualização da imagem e área de recorte 1:1 arrastável, compatível com mouse e toque (Pointer Events). Nenhuma biblioteca nova.
- **Scope:**
  - `src/features/profile/components/AvatarCropModal.tsx`
  - Props: `file: File | null`, `onConfirm: (dataUrl: string) => void`, `onCancel: () => void`
  - Renderiza `<img>` com a pré-visualização da imagem selecionada.
  - Overlay de recorte: quadrado 1:1 arrastável via `onPointerDown/Move/Up`. Posição inicial = center-crop (usando `squareCrop` ou equivalente para centrar o quadrado).
  - Garante que o quadrado de crop não saia dos limites da imagem renderizada.
  - Botões: "Cancelar" (chama `onCancel`) e "Salvar Foto" (chama `cropRectToCompressedDataUrl` com as coords atuais → `onConfirm(dataUrl)`).
  - Estado de loading durante compressão; estado de erro inline se a compressão falhar (modal não fecha).
  - Usa `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle` de `src/components/ui/dialog.tsx`.
  - Mobile-first: área de crop usável em touch (Pointer Events captura toque), dimensões do modal respeitam `max-w-[calc(100%-2rem)]` já definido no `DialogContent`.
- **Main modules/files likely involved:**
  - `src/features/profile/components/AvatarCropModal.tsx` (novo)
  - `src/components/ui/dialog.tsx` (reutilizado)
  - `src/features/profile/lib/imageToDataUrl.ts` (consome `cropRectToCompressedDataUrl`)
- **Dependencies:** TASK-01
- **Story points:** 5
- **Criticality:** high
- **Technical risk:** medium
- **Recommended TDD later:** no
- **Execution cost:**
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** Risco médio concentrado no comportamento de Pointer Events em iOS Safari (captura de eventos `pointermove` fora do elemento durante drag — requer `setPointerCapture`). O spec deve cobrir explicitamente o contrato de coords: coords do crop em pixels relativos à imagem **natural** (não ao elemento renderizado) — a conversão é necessária ao chamar `drawImage`.

---

### TASK-03 – Integrar AvatarCropModal em EditProfileForm

- **Type:** application
- **Goal:** Substituir o fluxo atual (seleção → `fileToCompressedDataUrl` direto) pelo fluxo com modal: seleção → abrir modal → confirmação → salvar.
- **Scope:**
  - `src/features/profile/components/EditProfileForm.tsx`
  - Adicionar `useState<File | null>(null)` para o arquivo pendente.
  - No handler `onChange` do `<input type="file">`: chamar `validateImageInput` → se válido, guardar em state e abrir modal.
  - `onConfirm(dataUrl)` do modal: `updateProfile.mutateAsync({ avatarUrl: dataUrl })` → toast.success → fechar modal.
  - `onCancel()`: limpar `pendingFile`, fechar modal.
  - Remover chamada direta a `fileToCompressedDataUrl` (substituída pelo modal).
  - `<input type="file">` deve continuar disparado por clique direto no botão câmera — não abrir programaticamente — para compatibilidade com iOS Safari.
  - Exportar `AvatarCropModal` de `src/features/profile/components/index.ts` se necessário.
- **Main modules/files likely involved:**
  - `src/features/profile/components/EditProfileForm.tsx`
  - `src/features/profile/components/index.ts`
- **Dependencies:** TASK-02
- **Story points:** 2
- **Criticality:** medium
- **Technical risk:** low
- **Recommended TDD later:** no
- **Execution cost:**
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- **Notes:** Tarefa de wiring simples. O maior cuidado é não introduzir delay programático antes de abrir o `<input type="file">` — o disparo do clique deve ser síncrono e direto.

---

## 4. Dependency map

```
TASK-01 (imageToDataUrl extension)
    └─► TASK-02 (AvatarCropModal — consome cropRectToCompressedDataUrl)
            └─► TASK-03 (EditProfileForm — integra o modal)
```

Execução sequencial obrigatória: cada tarefa depende da anterior.

---

## 5. Recommended execution order

1. **TASK-01** — Resolver discrepância de testes + estender lib (fundação, TDD)
2. **TASK-02** — Criar `AvatarCropModal` (componente principal, maior esforço)
3. **TASK-03** — Integrar modal em `EditProfileForm` (wiring final)

---

## 6. Planning risks and blockers

| Item | Tipo | Ação |
|---|---|---|
| **Discrepância `scaledDimensions` vs `squareCrop`** | Bloqueador pré-existente | Resolver em TASK-01 como primeiro passo; não continuar sem testes verdes. |
| **`setPointerCapture` para drag em iOS Safari** | Risco técnico (TASK-02) | Spec deve especificar uso de `el.setPointerCapture(e.pointerId)` no `pointerdown` para garantir que `pointermove` seja recebido mesmo fora do elemento. |
| **Conversão de coords: elemento renderizado → imagem natural** | Risco de regressão (TASK-02) | Crop aplicado com coords erradas gera resultado incorreto silenciosamente. Spec deve detalhar o mapeamento `naturalWidth/naturalHeight` × `clientWidth/clientHeight`. |
| **`fileToCompressedDataUrl` ainda usada em algum outro lugar** | Risco de regressão (TASK-03) | Verificar antes de remover chamada em `EditProfileForm` — a função deve ser mantida no módulo (usada internamente ou potencialmente em outros contextos futuros). |
