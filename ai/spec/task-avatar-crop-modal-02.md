# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Criar `AvatarCropModal`

## 2. Objective

Componente modal client-only que recebe um `File` de imagem, exibe pré-visualização com uma área de recorte quadrada (1:1) arrastável por mouse e toque (Pointer Events), e ao confirmar produz a data URL comprimida via `cropRectToCompressedDataUrl` (TASK-01), devolvendo-a ao chamador. Mobile-first, acessível.

## 3. In scope

- Novo arquivo `src/features/profile/components/AvatarCropModal.tsx`.
- Props: `{ open: boolean; file: File | null; onConfirm: (dataUrl: string) => void; onCancel: () => void }`.
- Carregar o `file` num `<img>` (object URL) quando `open && file`; revogar o object URL no cleanup/fechamento.
- Renderizar a imagem escalada para caber na largura do modal, com **overlay de recorte quadrado** de lado = menor dimensão exibida (maior 1:1 que cabe), posicionado inicialmente centralizado.
- Arrastar o overlay (Pointer Events: `onPointerDown` + `setPointerCapture`, `onPointerMove`, `onPointerUp`) — restrito aos limites da imagem exibida. Sem zoom, sem redimensionar o overlay.
- Botões no `DialogFooter`: **"Cancelar"** (`onCancel`) e **"Salvar Foto"** (confirma).
- Confirmar: converter coords do overlay (display) → coords da imagem **natural**, chamar `cropRectToCompressedDataUrl(img, cropNatural)`, e em sucesso chamar `onConfirm(dataUrl)`.
- Estado **loading** durante compressão (botão "Salvar Foto" desabilitado + indicação); estado **erro** inline (mensagem pt-BR) que NÃO fecha o modal.
- Usar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` de `@/components/ui/dialog` e `Button` de `@/components/ui/button`.

## 4. Out of scope

- Integração em `EditProfileForm` (TASK-03).
- Zoom, rotação, pan da imagem, ou múltiplos aspect ratios.
- Persistência / chamada a `/api/users` (responsabilidade do chamador, TASK-03).
- Alteração de `imageToDataUrl.ts` (já entregue em TASK-01) ou de `dialog.tsx`.
- Nova dependência npm.

## 5. Main technical areas involved

- `src/features/profile/components/AvatarCropModal.tsx` (novo)
- `src/features/profile/components/index.ts` (export do novo componente)
- Consome: `cropRectToCompressedDataUrl`, `CropRect`, `AvatarImageError`, `validateImageInput` de `../lib/imageToDataUrl`
- Reutiliza: `@/components/ui/dialog`, `@/components/ui/button`

## 6. Business rules and behavior

- **Overlay sempre quadrado**, lado = `min(displayWidth, displayHeight)`. Em imagem paisagem o overlay desliza horizontalmente; em retrato, verticalmente; em imagem ~quadrada o overlay ocupa quase tudo (movimento mínimo).
- **Clamp do overlay** na camada de exibição: `0 ≤ x ≤ displayWidth − side`, `0 ≤ y ≤ displayHeight − side`. (Defesa adicional já existe em `clampCropRect` na camada natural.)
- **Conversão display → natural**: `scale = naturalWidth / displayWidth` (== `naturalHeight / displayHeight`, pois a imagem mantém proporção ao escalar). `cropNatural = { x: round(overlayX * scale), y: round(overlayY * scale), size: round(side * scale) }`.
- **Confirmação**:
  - sucesso → `onConfirm(dataUrl)` (o chamador fecha o modal e persiste);
  - `AvatarImageError` → exibir `error.message` inline, manter modal aberto, sair do loading;
  - erro inesperado → mensagem genérica pt-BR ("Não foi possível processar a imagem.").
- **Cancelar / fechar** (botão, X, Escape, clique no backdrop) → `onCancel`, sem persistir; limpar estado de erro.
- **Sem imagem carregada ainda** (img não terminou `onLoad`) → "Salvar Foto" desabilitado.
- `validateImageInput(file)` pode ser revalidado defensivamente ao carregar; se falhar, exibir erro inline (o chamador já valida em TASK-03, mas o componente não deve quebrar com `file` inválido).

## 7. Contracts and interfaces

```ts
export interface AvatarCropModalProps {
  open: boolean;
  file: File | null;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

export function AvatarCropModal(props: AvatarCropModalProps): JSX.Element;
```

Consumido (TASK-01, já existente):
```ts
type CropRect = { x: number; y: number; size: number };
function cropRectToCompressedDataUrl(
  img: HTMLImageElement, crop: CropRect, maxBytes?: number,
): Promise<string>;
```

- O componente é **controlado**: o pai detém `open` e `file`, e reage a `onConfirm`/`onCancel`. `Dialog` recebe `open` e `onOpenChange={(o) => { if (!o) onCancel(); }}`.

## 8. Data and persistence impact

Nenhum. Componente puramente client-side; não toca rede nem storage.

## 9. Required tests

Ambiente jsdom (`// @vitest-environment jsdom`). `@testing-library/react` + `@testing-library/jest-dom` (já no projeto).

- **Render/visibilidade**: com `open=false` não renderiza conteúdo; com `open=true` + `file` renderiza título e botões "Cancelar"/"Salvar Foto".
- **Cancelar**: clique em "Cancelar" chama `onCancel`; não chama `onConfirm`.
- **Conversão de coordenadas** (função pura extraída, ex.: `displayCropToNatural(overlay, displaySize, naturalSize)`): testar mapeamento paisagem e retrato, e arredondamento — esta é a lógica regression-sensitive e DEVE ser testável isoladamente (sem depender de canvas).
- **Confirmar (sucesso)**: com `cropRectToCompressedDataUrl` mockado resolvendo uma data URL, clique em "Salvar Foto" chama `onConfirm` com a data URL.
- **Confirmar (erro)**: mock rejeitando `AvatarImageError("msg")` → mensagem exibida inline, `onConfirm` não chamado, modal permanece.
- Interação de drag por Pointer Events em jsdom é frágil (sem layout real); cobrir o **núcleo de cálculo** via a função pura de conversão/clamp, não simular o drag completo.

## 10. Acceptance criteria

- `AvatarCropModal` renderiza dentro de `Dialog` com foco preso, Escape e backdrop fechando via `onCancel` (herdado de `@base-ui/react/dialog`).
- Overlay quadrado visível sobre a imagem; arrastável por mouse e toque; restrito aos limites.
- "Salvar Foto" produz data URL e chama `onConfirm`; erro de compressão exibido inline sem fechar.
- Função de conversão display→natural coberta por testes unitários verdes.
- `npm test`, `npm run typecheck`, `npm run lint` verdes para os arquivos novos/alterados.
- Sem nova dependência; TS strict sem `any`; pt-BR nos textos/comentos.

## 11. Constraints

- Client component (`"use client"`).
- Pointer Events (não Mouse/Touch separados); `setPointerCapture(e.pointerId)` no `pointerdown` para receber `pointermove` fora do elemento durante o drag (crítico p/ iOS Safari).
- Tailwind only (sem inline styles), exceto onde posicionamento dinâmico do overlay exige `style` (top/left/size calculados) — permitido pois são valores dinâmicos, não estáticos.
- Touch target dos botões ≥ 44×44; modal respeita `max-w` do `DialogContent` (mobile-first).
- Acessibilidade: `aria-label` na área de recorte; botões alcançáveis por teclado; `DialogTitle`/`DialogDescription` presentes para wiring de aria.
- Não abrir `<input type=file>` aqui (fica em TASK-03) — o componente só recebe o `File` pronto.

## 12. Execution cost profile

- tdd: N/A
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator

- is_frontend: true
- reason: cria o componente de UI `AvatarCropModal` — modal interativo com overlay arrastável, estados de loading/erro e foco/acessibilidade. `/ui-spec` e `/patterns:nextjs` aplicáveis.

## 14. Open questions

Nenhuma bloqueante. Decisão de design fixada: overlay de lado fixo (= menor dimensão exibida) deslizando no eixo maior — entrega "escolher qual parte" sem zoom, dentro do escopo do PRD.
