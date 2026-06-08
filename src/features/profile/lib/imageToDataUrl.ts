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
 * Calcula as dimensões de saída mantendo proporção, limitadas a
 * `MAX_AVATAR_DIMENSION` (puro/testável).
 */
export function scaledDimensions(
  width: number,
  height: number,
  max: number = MAX_AVATAR_DIMENSION,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const ratio = width / height;
  return ratio >= 1
    ? { width: max, height: Math.round(max / ratio) }
    : { width: Math.round(max * ratio), height: max };
}

/**
 * Converte um `File`/`Blob` de imagem em data URL JPEG comprimida sob
 * `MAX_AVATAR_BYTES`. Browser-only (usa `Image`/`<canvas>`). Reduz a qualidade
 * progressivamente; se nem na menor qualidade couber, lança `AvatarImageError`.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxBytes: number = MAX_AVATAR_BYTES,
): Promise<string> {
  validateImageInput(file);

  const bitmap = await loadImage(file);
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new AvatarImageError("Não foi possível processar a imagem.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Tenta qualidades decrescentes até caber sob o teto.
  for (const quality of [0.8, 0.65, 0.5, 0.4, 0.3]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlByteSize(dataUrl) <= maxBytes) return dataUrl;
  }
  throw new AvatarImageError(
    "Não foi possível comprimir a imagem o suficiente. Tente outra foto.",
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
