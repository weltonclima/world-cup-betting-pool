// Compressão de avatar para base64 (PRD-06, decisão D-A2) — sem Firebase Storage.
// O arquivo escolhido é redimensionado e recomprimido (canvas → JPEG data URL)
// até caber sob um teto de bytes seguro frente ao limite de 1MB do doc Firestore.

// Limite de chars do logo é canônico no schema; reexportado aqui por conveniência.
import { MAX_POOL_LOGO_BASE64_LENGTH } from "@/schemas/pools";

export { MAX_POOL_LOGO_BASE64_LENGTH };

/** Teto de bytes da data URL final (margem do limite de 1MB do doc Firestore). */
export const MAX_AVATAR_BYTES = 700 * 1024; // ~700KB

/** Tamanho máximo do arquivo de ENTRADA aceito (antes de comprimir). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB

/** Lado máximo (px) do avatar após redimensionar (quadrado). */
export const MAX_AVATAR_DIMENSION = 256;

/**
 * Teto de chars da data URL do LOGO do grupo (personalizacao-grupo TASK-01).
 * MENOR que o da foto (`MAX_POOL_PHOTO_BASE64_LENGTH = 700_000`) para que foto +
 * logo caibam sob o teto de 1MB do doc Firestore `pools/{id}`. ~300KB de base64.
 */
/**
 * Teto de BYTES do logo comprimido, derivado do limite de CHARS (schema)
 * (base64: 4 chars ≈ 3 bytes; margem de 1KB). Garante que a data URL final caiba
 * sob `MAX_POOL_LOGO_BASE64_LENGTH` chars no schema. Espelha o cálculo da foto do
 * grupo (`PHOTO_MAX_BYTES` em GroupSettingsForm).
 */
export const MAX_POOL_LOGO_BYTES = Math.floor((MAX_POOL_LOGO_BASE64_LENGTH * 3) / 4) - 1024;

/** Maior dimensão (px) do logo após redimensionar (preserva proporção). */
export const MAX_LOGO_DIMENSION = 512;

/** Mimes de imagem raster aceitos para o logo (exclui SVG → risco XSS). */
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarImageError";
  }
}

/**
 * Valida o arquivo de entrada (puro/testável): precisa ser imagem e respeitar o
 * teto de entrada. Lança `AvatarImageError` com mensagem pt-BR para a UI exibir.
 */
export function validateImageInput(file: { type: string; size: number }): void {
  if (!file.type.startsWith("image/")) {
    throw new AvatarImageError("O arquivo selecionado não é uma imagem.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarImageError(
      "Imagem muito grande. Escolha um arquivo de até 10MB.",
    );
  }
}

/**
 * Valida o arquivo de LOGO (personalizacao-grupo TASK-01): além do teto de
 * entrada, restringe a mimes raster (`png`/`jpeg`/`webp`) — **exclui SVG** por
 * risco de XSS. Puro/testável. Lança `AvatarImageError` com mensagem pt-BR.
 */
export function validateLogoInput(file: { type: string; size: number }): void {
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new AvatarImageError(
      "Formato não suportado. Use PNG, JPG ou WebP.",
    );
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarImageError(
      "Imagem muito grande. Escolha um arquivo de até 10MB.",
    );
  }
}

/**
 * Estima o tamanho em bytes de uma data URL base64 (puro/testável).
 * base64 codifica 3 bytes a cada 4 chars; `=` de padding descontados.
 */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (base64.length === 0) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Calcula o recorte quadrado centralizado (center-crop) da imagem de origem e a
 * dimensão de saída — puro/testável. O avatar é sempre quadrado: pegamos o maior
 * quadrado central do source (lado = menor dimensão) e o reescalamos para `out`
 * (limitado a `max`, SEM upscale acima do lado original). Assim a imagem gravada
 * já é quadrada, eliminando a distorção na exibição (box quadrado) na origem.
 *
 * @returns `sx`/`sy` (canto do recorte no source), `side` (lado do recorte) e
 *          `out` (lado do quadrado de saída).
 */
export function squareCrop(
  width: number,
  height: number,
  max: number = MAX_AVATAR_DIMENSION,
): { sx: number; sy: number; side: number; out: number } {
  const side = Math.min(width, height);
  const sx = Math.floor((width - side) / 2);
  const sy = Math.floor((height - side) / 2);
  const out = Math.min(side, max);
  return { sx, sy, side, out };
}

/**
 * Recorte quadrado em coordenadas da imagem NATURAL (px): `x`/`y` = canto
 * superior-esquerdo, `size` = lado do quadrado. Origem do recorte escolhido pelo
 * usuário no modal (TASK-02).
 */
export type CropRect = { x: number; y: number; size: number };

/**
 * Ajusta um `CropRect` para caber inteiramente dentro da imagem natural
 * (puro/testável). Garante: `size` entre 1 e o menor lado; `x`/`y` ≥ 0 e o
 * quadrado sem ultrapassar as bordas direita/inferior. Defesa contra coords
 * inválidas vindas da UI.
 */
export function clampCropRect(
  crop: CropRect,
  naturalWidth: number,
  naturalHeight: number,
): CropRect {
  const maxSide = Math.min(naturalWidth, naturalHeight);
  const size = Math.min(Math.max(Math.round(crop.size), 1), maxSide);
  const x = Math.min(Math.max(Math.round(crop.x), 0), naturalWidth - size);
  const y = Math.min(Math.max(Math.round(crop.y), 0), naturalHeight - size);
  return { x, y, size };
}

/**
 * Desenha um recorte RETANGULAR `source` (`sw`×`sh`) de `img` num canvas de saída
 * `outW`×`outH` e comprime para JPEG sob `maxBytes`, reduzindo a qualidade
 * progressivamente. Lança `AvatarImageError` se nem na menor qualidade couber.
 * Núcleo compartilhado por todos os conversores (quadrado é um caso particular).
 */
function drawAndCompressRect(
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  maxBytes: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new AvatarImageError("Não foi possível processar a imagem.");
  }
  // Recorte (sw×sh) → saída (outW×outH) com a MESMA proporção (sem esticar).
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  // Tenta qualidades decrescentes até caber sob o teto.
  for (const quality of [0.8, 0.65, 0.5, 0.4, 0.3]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlByteSize(dataUrl) <= maxBytes) return dataUrl;
  }
  throw new AvatarImageError(
    "Não foi possível comprimir a imagem o suficiente. Tente outra foto.",
  );
}

/**
 * Caso quadrado (avatar): recorte `side²` → saída `out²`. Wrapper de
 * `drawAndCompressRect` — mantém a assinatura usada pelos conversores de avatar.
 */
function drawAndCompress(
  img: CanvasImageSource,
  sx: number,
  sy: number,
  side: number,
  out: number,
  maxBytes: number,
): string {
  return drawAndCompressRect(img, sx, sy, side, side, out, out, maxBytes);
}

/**
 * Converte um `File`/`Blob` de imagem em data URL JPEG comprimida sob
 * `MAX_AVATAR_BYTES`. Browser-only (usa `Image`/`<canvas>`). Recorte quadrado
 * central automático. Reduz a qualidade progressivamente; se nem na menor
 * couber, lança `AvatarImageError`.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxBytes: number = MAX_AVATAR_BYTES,
): Promise<string> {
  validateImageInput(file);

  const bitmap = await loadImage(file);
  const { sx, sy, side, out } = squareCrop(bitmap.width, bitmap.height);
  return drawAndCompress(bitmap, sx, sy, side, out, maxBytes);
}

/**
 * Recorta um quadrado arbitrário (`crop`, coords da imagem natural) de um
 * `HTMLImageElement` já carregado e devolve a data URL JPEG comprimida sob
 * `maxBytes`. Aplica `clampCropRect` internamente (defesa contra coords fora dos
 * limites). Saída limitada a `MAX_AVATAR_DIMENSION` (sem upscale acima do lado do
 * recorte). Browser-only. Base do modal de recorte (TASK-02).
 */
export function cropRectToCompressedDataUrl(
  img: HTMLImageElement,
  crop: CropRect,
  maxBytes: number = MAX_AVATAR_BYTES,
): Promise<string> {
  const { x, y, size } = clampCropRect(crop, img.naturalWidth, img.naturalHeight);
  const out = Math.min(size, MAX_AVATAR_DIMENSION);
  return Promise.resolve(drawAndCompress(img, x, y, size, out, maxBytes));
}

// ── Recorte RETANGULAR (proporção livre) — logo do grupo (TASK-01) ───────────

/**
 * Recorte retangular em coords da imagem NATURAL (px): canto superior-esquerdo
 * (`x`/`y`) + `width`/`height`. Proporção livre (não necessariamente quadrada).
 */
export type RectCropRect = { x: number; y: number; width: number; height: number };

/**
 * Ajusta um `RectCropRect` para caber inteiramente dentro da imagem natural
 * (puro/testável). Garante: `width`/`height` ≥ 1 e ≤ dimensão do eixo; `x`/`y` ≥ 0
 * e o retângulo sem ultrapassar as bordas direita/inferior. Arredonda coords
 * fracionárias (Pointer Events entregam floats). Defesa contra coords inválidas.
 */
export function clampRectCropRect(
  crop: RectCropRect,
  naturalWidth: number,
  naturalHeight: number,
): RectCropRect {
  // Preserva o canto (x/y) e ENCOLHE width/height ao espaço disponível — semântica
  // de resize: arrastar a alça além da borda limita o tamanho, não move o recorte.
  const x = Math.min(Math.max(Math.round(crop.x), 0), naturalWidth - 1);
  const y = Math.min(Math.max(Math.round(crop.y), 0), naturalHeight - 1);
  const width = Math.min(Math.max(Math.round(crop.width), 1), naturalWidth - x);
  const height = Math.min(Math.max(Math.round(crop.height), 1), naturalHeight - y);
  return { x, y, width, height };
}

/**
 * Converte um recorte retangular de coords de EXIBIÇÃO (px do `<img>` renderizado)
 * para as da imagem NATURAL (puro/testável). A imagem mantém proporção ao escalar,
 * logo o fator é único (`natural.width / display.width`). `display` 0 → fallback
 * seguro (imagem inteira).
 */
export function displayRectToNatural(
  overlay: RectCropRect,
  display: { width: number; height: number },
  natural: { width: number; height: number },
): RectCropRect {
  if (display.width <= 0 || display.height <= 0) {
    return { x: 0, y: 0, width: natural.width, height: natural.height };
  }
  const scale = natural.width / display.width;
  return {
    x: Math.round(overlay.x * scale),
    y: Math.round(overlay.y * scale),
    width: Math.round(overlay.width * scale),
    height: Math.round(overlay.height * scale),
  };
}

/**
 * Recorta um retângulo arbitrário (`crop`, coords naturais) de um
 * `HTMLImageElement` já carregado e devolve a data URL JPEG comprimida sob
 * `maxBytes`. Aplica `clampRectCropRect` (defesa). A saída preserva a proporção
 * do recorte, com a maior dimensão limitada a `maxDimension` (sem upscale).
 * Browser-only. Base do `ImageCropModal` (recorte de logo, proporção livre).
 */
export function rectCropToCompressedDataUrl(
  img: HTMLImageElement,
  crop: RectCropRect,
  maxBytes: number = MAX_POOL_LOGO_BYTES,
  maxDimension: number = MAX_LOGO_DIMENSION,
): Promise<string> {
  const { x, y, width, height } = clampRectCropRect(
    crop,
    img.naturalWidth,
    img.naturalHeight,
  );
  // Escala p/ que a maior dimensão não passe de `maxDimension`, sem upscale.
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  return Promise.resolve(
    drawAndCompressRect(img, x, y, width, height, outW, outH, maxBytes),
  );
}

/** Carrega o arquivo em um `HTMLImageElement` (browser-only). */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}
