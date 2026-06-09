// Compressão de avatar para base64 (PRD-06, decisão D-A2) — sem Firebase Storage.
// O arquivo escolhido é redimensionado e recomprimido (canvas → JPEG data URL)
// até caber sob um teto de bytes seguro frente ao limite de 1MB do doc Firestore.

/** Teto de bytes da data URL final (margem do limite de 1MB do doc Firestore). */
export const MAX_AVATAR_BYTES = 700 * 1024; // ~700KB

/** Tamanho máximo do arquivo de ENTRADA aceito (antes de comprimir). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB

/** Lado máximo (px) do avatar após redimensionar (quadrado). */
export const MAX_AVATAR_DIMENSION = 256;

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
 * Desenha um recorte quadrado `source` (lado `side`) de `img` num canvas de saída
 * quadrado `out` e comprime para JPEG sob `maxBytes`, reduzindo a qualidade
 * progressivamente. Lança `AvatarImageError` se nem na menor qualidade couber.
 * Núcleo compartilhado por `fileToCompressedDataUrl` e `cropRectToCompressedDataUrl`.
 */
function drawAndCompress(
  img: CanvasImageSource,
  sx: number,
  sy: number,
  side: number,
  out: number,
  maxBytes: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new AvatarImageError("Não foi possível processar a imagem.");
  }
  // Recorte quadrado (side²) → quadrado de saída (out²): proporção 1:1 em ambos,
  // logo sem esticar.
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

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
