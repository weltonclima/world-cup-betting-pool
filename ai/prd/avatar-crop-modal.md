# PRD — PRD-09: Modal de Recorte de Avatar

## 1. Feature summary

Substituir o fluxo atual de upload de avatar (center-crop automático) por um modal interativo que permite ao usuário escolher manualmente a área de recorte antes de salvar. A imagem resultante continua sendo processada como JPEG comprimido, convertida em base64 e salva diretamente no documento Firestore do usuário — sem Firebase Storage.

---

## 2. Consolidated scope

### Comportamento atual
1. Usuário clica no botão câmera em `EditProfileForm`.
2. `<input type="file" accept="image/*">` abre o seletor de arquivo.
3. Arquivo selecionado → `fileToCompressedDataUrl(file)`:
   - Valida tipo + tamanho (≤ 10 MB).
   - `squareCrop`: calcula center-crop automático (maior quadrado central).
   - Redimensiona para `MAX_AVATAR_DIMENSION` (256 px), comprime para JPEG com qualidade decrescente até caber em `MAX_AVATAR_BYTES` (700 KB).
4. data URL salva via `updateProfile.mutateAsync({ avatarUrl })`.

### Comportamento novo (escopo desta feature)
1. Fluxo 1–2 idêntico.
2. Arquivo selecionado → `validateImageInput(file)` (mantido).
3. **Modal abre** com pré-visualização da imagem e área de recorte 1:1 arrastável/pinçável.
4. Usuário ajusta a área de crop manualmente.
5. Usuário clica **"Salvar Foto"**:
   - Coordenadas do crop aplicadas via `<canvas>`.
   - Compressão JPEG idêntica à lógica atual (qualidade decrescente até ≤ 700 KB, saída 256 px).
   - `updateProfile.mutateAsync({ avatarUrl })` — fluxo de persistência inalterado.
6. Usuário clica **"Cancelar"** → modal fecha, nada salvo.
7. UX mobile-first: suporte a toque (arrastar área de recorte) e compatível com iOS Safari.

### Out of scope
- Zoom ou rotação da imagem no modal.
- Múltiplas relações de aspecto (sempre 1:1).
- Qualquer mudança na persistência (Firestore) ou na API de perfil.

---

## 3. System understanding relevant to this feature

### Módulo afetado
- `src/features/profile/` (único ponto de mudança funcional).

### Componentes e libs relevantes
| Artefato | Papel |
|---|---|
| `EditProfileForm.tsx` | Orquestra o fluxo — precisa de estado para controlar abertura do modal e arquivo pendente. |
| `imageToDataUrl.ts` | Contém `validateImageInput`, `squareCrop`, `fileToCompressedDataUrl`, `loadImage`, `dataUrlByteSize`. O crop manual substitui a chamada de `squareCrop` — as demais funções são reaproveitadas. |
| `src/components/ui/dialog.tsx` | Wrapper `@base-ui/react/dialog` — focus trap, Escape, aria-modal, scroll lock nativos. Disponível para uso imediato. |
| `useUpdateProfile` hook | Chama `/api/users` via Tanstack Query. Não muda. |

### Restrições críticas
- **Tamanho da data URL**: limite duro de `MAX_AVATAR_BYTES = 700 KB` para a saída final (margem ao limite de 1 MB do doc Firestore).
- **Dimensão de saída**: `MAX_AVATAR_DIMENSION = 256 px` (quadrado).
- **Entrada**: aceita arquivos de até `MAX_INPUT_BYTES = 10 MB`.
- **Sem dependência de servidor**: toda a operação de crop e compressão é client-only (canvas API).
- **Sem nova rota de API**: o endpoint `/api/users` (PATCH) não muda.

### Ausência de library de crop
Nenhuma library de crop está presente no `package.json` atual. A decisão de adicionar ou não uma biblioteca é um risco de implementação explicitado na seção 5.

---

## 4. Technical impact analysis

### Módulos impactados
| Módulo | Tipo de impacto |
|---|---|
| `EditProfileForm.tsx` | Modificação: novo estado `pendingFile + cropModalOpen`, delegação da seleção para o modal. |
| `imageToDataUrl.ts` | Extensão: nova função `croppedCanvasToCompressedDataUrl(canvas, cropRect)` ou similar — recebe coords de crop e produz data URL comprimida. Funções existentes mantidas sem quebra. |
| `AvatarCropModal` (novo) | Criação: componente modal com preview de imagem + overlay de crop interativo. |
| `dialog.tsx` | Sem mudança — usado como está. |

### Fluxo de dados revisado
```
File (≤10MB)
  → validateImageInput()          [existente]
  → loadImage(file)               [existente, movido para o modal]
  → <img> renderizado no modal
  → usuário arrasta crop (1:1)
  → "Salvar Foto" → cropRect (px)
  → canvas.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 256, 256)
  → loop qualidade JPEG decrescente até dataUrlByteSize ≤ 700KB
  → updateProfile.mutateAsync({ avatarUrl: dataUrl })
```

### Impacto em testes
- `imageToDataUrl.test.ts`: testes existentes não quebram. Nova função precisa de cobertura.
- `EditProfileForm` não tem testes unitários atualmente — não obrigatório, mas o modal novo deve ter pelo menos testes de integração de comportamento de abertura/fechamento.

### Performance
- `loadImage()` ocorre no momento da seleção (antes de abrir o modal) para pré-carregar a pré-visualização — evita delay perceptível ao abrir o modal.
- Canvas 256×256 é trivial; sem impacto em dispositivos móveis modestos.

### Compatibilidade
- `<canvas>.toDataURL('image/jpeg', quality)` — suportado universalmente, incluindo iOS Safari.
- Pointer Events API (`pointermove`, `pointerdown`, `pointerup`) — cobertura ≥ 97% em dispositivos modernos, recomendado sobre touch events.

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| **Adição de nova dependência** — `react-image-crop` ou `react-easy-crop` ampliam o bundle. | Baixa | `react-image-crop` ≈ 6 KB gzipped; ou implementar crop simples via canvas + Pointer Events sem nova lib. |
| **Compatibilidade React 19** — `react-image-crop` v11 e `react-easy-crop` afirmam suporte a React 19, mas não testados no projeto. | Média | Avaliar durante `plan`; fallback é implementação canvas manual. |
| **Regressão no fluxo atual** — modificar `imageToDataUrl.ts` pode quebrar a compressão existente. | Baixa | Extensão aditiva (nova função); funções existentes sem toque. |
| **UX de toque em iOS Safari** — `<input type=file>` em iOS requer interação direta do usuário; não pode ser aberto programaticamente com delay. | Alta | O input deve continuar disparado diretamente por clique de botão; o modal abre *após* a seleção (evento `change`), não antes. Esse fluxo é seguro. |
| **Tamanho da data URL pós-crop** — recorte em área pequena + upscale poderia aumentar artefatos JPEG, mas não o tamanho. | Baixa | Saída sempre 256×256 px, mesma lógica de qualidade decrescente. |

---

## 6. Ambiguities and gaps

| Item | Status |
|---|---|
| **Library de crop vs. implementação manual** | Em aberto. Lib (`react-image-crop`) reduz esforço, mas adiciona dependência. Canvas manual é zero-dep mas ~150 linhas extras de Pointer Events. Decisão deve ser feita no `plan`. |
| **Zoom no modal** | Fora de escopo confirmado. Se a imagem for muito pequena, o crop funcionará mas a saída ficará pixelada — comportamento aceitável (usuário escolheu). |
| **Preview do crop antes de confirmar** | O modal mostrará a área selecionada em sobreposição. Um preview do resultado final (256×256) não foi solicitado — pode ser adicionado, mas não está no escopo. |
| **Erro de compressão no modal** | Se a compressão falhar (todos os níveis de qualidade excedem 700 KB), o modal deve mostrar erro inline e não fechar — comportamento esperado mas não explicitado nos requisitos. |

---

## 7. Recommended implementation concerns

1. **Componente isolado**: `AvatarCropModal` deve ser um componente independente recebendo `file: File | null` e callbacks `onConfirm(dataUrl: string)` / `onCancel()`. Facilita teste e reuso.

2. **Extensão de `imageToDataUrl.ts`**: adicionar `croppedBlobToCompressedDataUrl(blob: Blob, cropRect: PixelCrop): Promise<string>` — recebe o blob já recortado pelo canvas (ou pelas coords do crop) e aplica a lógica de compressão existente. Sem quebra de contrato das funções atuais.

3. **Decisão de library no `plan`**: avaliar `react-image-crop` v11 (mais leve, entrega coords de pixel para canvas manual) vs. `react-easy-crop` (UI mais rica, built-in touch/pinch) vs. canvas puro. Preferência do projeto: zero novas deps quando o esforço incremental for baixo.

4. **Estado em `EditProfileForm`**: novo `useState<File | null>(null)` para armazenar o arquivo selecionado antes de abrir o modal; `useState<boolean>(false)` para controlar abertura. O `input type=file` mantém seu disparo por clique direto para não violar restrições de iOS Safari.

5. **Acessibilidade**: modal já tem focus trap e Escape via `@base-ui/react/dialog`. Adicionar `aria-label` descritivo na área de crop e garantir que os botões "Cancelar" e "Salvar Foto" sejam acessíveis via teclado.
