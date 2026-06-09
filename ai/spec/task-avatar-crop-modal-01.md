# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Corrigir e estender `imageToDataUrl.ts`

## 2. Objective

Duas entregas no módulo `src/features/profile/lib/imageToDataUrl.ts`:

1. **Corrigir** a suite de testes quebrada: a working tree renomeou `scaledDimensions` → `squareCrop` (mudança correta — avatar agora é center-crop quadrado), mas `imageToDataUrl.test.ts` ainda importa/testa `scaledDimensions`, que não existe mais. A suite não compila.
2. **Estender** o módulo com `cropRectToCompressedDataUrl(img, crop, maxBytes?)`: aplica um recorte quadrado arbitrário (escolhido pelo usuário) sobre um `HTMLImageElement` e devolve a data URL JPEG comprimida sob o teto de bytes — base para o modal de recorte (TASK-02).

## 3. In scope

- Atualizar `imageToDataUrl.test.ts`: remover testes de `scaledDimensions`, adicionar testes de `squareCrop` (já é a função exportada).
- Adicionar `export type CropRect = { x: number; y: number; size: number }` — recorte quadrado em coordenadas da **imagem natural** (px).
- Adicionar `cropRectToCompressedDataUrl(img: HTMLImageElement, crop: CropRect, maxBytes?: number): Promise<string>`.
- Adicionar função pura/testável `clampCropRect(crop, naturalWidth, naturalHeight): CropRect` — garante que o recorte fica dentro dos limites da imagem (não negativo, não excede bordas).
- Testes para as partes puras novas (`clampCropRect`) e ajuste/manutenção de `squareCrop`.
- Manter `fileToCompressedDataUrl`, `validateImageInput`, `dataUrlByteSize`, `squareCrop`, `loadImage` intactos (sem quebra de contrato).

## 4. Out of scope

- Componente modal (`AvatarCropModal`) — TASK-02.
- Mudança em `EditProfileForm` — TASK-03.
- Pointer Events / interação de UI — TASK-02.
- Remoção de `fileToCompressedDataUrl` (mantido — ainda usado e potencialmente reutilizável).
- Qualquer nova dependência npm.

## 5. Main technical areas involved

- `src/features/profile/lib/imageToDataUrl.ts` (extensão)
- `src/features/profile/lib/__tests__/imageToDataUrl.test.ts` (correção)

## 6. Business rules and behavior

- **Saída sempre quadrada 1:1**, lado = `MAX_AVATAR_DIMENSION` (256 px), ou menor se o recorte de origem for menor que 256 (sem upscale acima do lado do recorte).
- **Teto de bytes**: data URL final ≤ `MAX_AVATAR_BYTES` (700 KB). Reutilizar o loop de qualidade decrescente `[0.8, 0.65, 0.5, 0.4, 0.3]` já existente. Se nem na menor qualidade couber → lançar `AvatarImageError` (mensagem pt-BR já existente).
- **Clamp do recorte**: `clampCropRect` corrige coords inválidas:
  - `x`, `y` ≥ 0;
  - `size` ≥ 1;
  - `x + size` ≤ `naturalWidth`, `y + size` ≤ `naturalHeight` (reduz `size` e/ou desloca `x`/`y` para caber).
- `cropRectToCompressedDataUrl` deve aplicar `clampCropRect` internamente antes de desenhar — defesa contra coords fora dos limites vindas da UI.

## 7. Contracts and interfaces

```ts
export type CropRect = { x: number; y: number; size: number };

/** Pura/testável: ajusta o recorte para caber dentro da imagem natural. */
export function clampCropRect(
  crop: CropRect,
  naturalWidth: number,
  naturalHeight: number,
): CropRect;

/**
 * Recorta um quadrado arbitrário (CropRect, coords da imagem natural) de `img`
 * e devolve data URL JPEG comprimida ≤ maxBytes. Browser-only (canvas).
 * Lança AvatarImageError se não couber sob o teto.
 */
export function cropRectToCompressedDataUrl(
  img: HTMLImageElement,
  crop: CropRect,
  maxBytes?: number,
): Promise<string>;
```

- Saída do canvas: `canvas.width = canvas.height = out`, onde `out = Math.min(crop.size, MAX_AVATAR_DIMENSION)`.
- Desenho: `ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, out, out)`.
- Reaproveitar o loop de qualidade JPEG existente (não duplicar — extrair helper interno se reduzir repetição com `fileToCompressedDataUrl`, mas sem alterar o comportamento da função existente).

## 8. Data and persistence impact

Nenhum. Lógica client-only; a persistência (`/api/users` PATCH com `avatarUrl`) é responsabilidade de TASK-03 e não muda.

## 9. Required tests

- `clampCropRect`:
  - recorte já dentro dos limites → inalterado;
  - `x`/`y` negativo → zerado;
  - `x + size > naturalWidth` → reposicionado/reduzido para caber;
  - `size` maior que ambas dimensões → limitado ao menor lado;
  - `size < 1` → vira 1 (ou menor lado válido).
- `squareCrop` (substituindo os testes de `scaledDimensions`):
  - paisagem (1024×512) → `{ sx: 256, sy: 0, side: 512, out: 256 }`;
  - retrato (512×1024) → `{ sx: 0, sy: 256, side: 512, out: 256 }`;
  - imagem menor que `max` (100×80) → `{ sx: 10, sy: 0, side: 80, out: 80 }` (sem upscale).
- Testes existentes de `validateImageInput` e `dataUrlByteSize` permanecem e devem passar.
- `cropRectToCompressedDataUrl` (canvas) — partes que dependem de `document`/`canvas` exigem jsdom; se a cobertura de canvas for inviável no ambiente de teste, cobrir apenas as partes puras (`clampCropRect`, dimensão de saída) e documentar a limitação. Não forçar mock frágil de canvas.

## 10. Acceptance criteria

- `npm test` (vitest) verde para `imageToDataUrl.test.ts` — sem import de símbolo inexistente.
- `npm run typecheck` sem erros.
- `squareCrop`, `validateImageInput`, `dataUrlByteSize`, `fileToCompressedDataUrl`, `loadImage` mantêm assinatura e comportamento.
- `cropRectToCompressedDataUrl` e `clampCropRect` exportados e tipados (sem `any`).
- Nenhuma nova dependência em `package.json`.

## 11. Constraints

- TypeScript strict, sem `any`.
- Comentários/domínio em pt-BR (padrão do arquivo).
- Sem inline styles (n/a aqui — sem UI).
- Reusar constantes existentes (`MAX_AVATAR_BYTES`, `MAX_AVATAR_DIMENSION`).
- Não introduzir regressão nas funções já consumidas por `EditProfileForm`.

## 12. Execution cost profile

- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator

- is_frontend: false
- reason: módulo de lógica pura/utilitário (canvas/data URL). Sem JSX, componente, tela ou interação. `/ui-spec` e `/patterns` não se aplicam.

## 14. Open questions

Nenhuma. Discrepância de testes resolvida: `squareCrop` é o contrato correto (working-tree intencional para avatar quadrado); os testes de `scaledDimensions` são stale e serão substituídos.
