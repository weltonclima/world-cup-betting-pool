"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AvatarImageError,
  cropRectToCompressedDataUrl,
  validateImageInput,
  type CropRect,
} from "../lib/imageToDataUrl";

/** Recorte quadrado em coordenadas de EXIBIÇÃO (px do `<img>` renderizado). */
type DisplayOverlay = { x: number; y: number; side: number };

/** Dimensões da imagem: exibida (display) e original (natural). */
type ImageDims = {
  displayW: number;
  displayH: number;
  naturalW: number;
  naturalH: number;
};

export interface AvatarCropModalProps {
  open: boolean;
  file: File | null;
  /**
   * Recebe a data URL recortada/comprimida. Pode ser assíncrono (ex.: persistir):
   * enquanto a Promise não resolve, o modal permanece em estado de loading
   * (botão desabilitado, fechamento bloqueado) — evita duplo-envio e dismiss
   * durante a persistência.
   */
  onConfirm: (dataUrl: string) => void | Promise<void>;
  onCancel: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converte o recorte das coordenadas de EXIBIÇÃO para as da imagem NATURAL
 * (puro/testável). A imagem mantém proporção ao escalar, logo o fator é único
 * (`naturalW / displayW`). Regressão-sensível: coords erradas gravam a parte
 * errada da foto silenciosamente.
 */
export function displayCropToNatural(
  overlay: DisplayOverlay,
  display: { width: number; height: number },
  natural: { width: number; height: number },
): CropRect {
  if (display.width <= 0 || display.height <= 0) {
    return { x: 0, y: 0, size: Math.min(natural.width, natural.height) };
  }
  const scale = natural.width / display.width;
  return {
    x: Math.round(overlay.x * scale),
    y: Math.round(overlay.y * scale),
    size: Math.round(overlay.side * scale),
  };
}

/**
 * Modal de recorte de avatar (PRD-09, TASK-02). Recebe um `File`, exibe a
 * pré-visualização com uma área de recorte quadrada (1:1) arrastável por mouse e
 * toque (Pointer Events), e ao confirmar produz a data URL comprimida via
 * `cropRectToCompressedDataUrl`. Componente controlado: o pai detém `open`/`file`
 * e reage a `onConfirm`/`onCancel` (TASK-03). Client-only.
 */
export function AvatarCropModal({
  open,
  file,
  onConfirm,
  onCancel,
}: AvatarCropModalProps): JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const mountedRef = useRef(true);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<ImageDims | null>(null);
  const [overlay, setOverlay] = useState<DisplayOverlay>({
    x: 0,
    y: 0,
    side: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guarda contra atualização de estado / callback após desmontar (race do
  // confirm assíncrono).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cria o object URL da imagem ao abrir; revoga no cleanup. Valida o arquivo
  // defensivamente (o pai também valida, mas o componente não deve quebrar).
  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null);
      setDims(null);
      setError(null);
      return;
    }
    try {
      validateImageInput(file);
    } catch (err) {
      setError(
        err instanceof AvatarImageError ? err.message : "Arquivo inválido.",
      );
      setObjectUrl(null);
      setDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setDims(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // Recalcula dimensões de exibição em resize, mantendo o recorte dentro dos
  // limites.
  useEffect(() => {
    if (!open) return;
    function onResize(): void {
      const img = imgRef.current;
      if (!img || !img.complete) return;
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;
      const side = Math.min(displayW, displayH);
      setDims((p) => (p ? { ...p, displayW, displayH } : p));
      setOverlay((o) => ({
        side,
        x: clamp(o.x, 0, displayW - side),
        y: clamp(o.y, 0, displayH - side),
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  function handleImgLoad(): void {
    const img = imgRef.current;
    if (!img) return;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    const side = Math.min(displayW, displayH);
    setDims({
      displayW,
      displayH,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    });
    setOverlay({
      x: (displayW - side) / 2,
      y: (displayH - side) / 2,
      side,
    });
  }

  function handleImgError(): void {
    setError("Não foi possível ler a imagem.");
    setDims(null);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!dims) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      dx: e.clientX - rect.left - overlay.x,
      dy: e.clientY - rect.top - overlay.y,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragOffset.current;
    if (!drag || !dims) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = e.clientX - rect.left - drag.dx;
    const ny = e.clientY - rect.top - drag.dy;
    setOverlay((o) => ({
      side: o.side,
      x: clamp(nx, 0, dims.displayW - o.side),
      y: clamp(ny, 0, dims.displayH - o.side),
    }));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    dragOffset.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  async function handleConfirm(): Promise<void> {
    const img = imgRef.current;
    if (!img || !dims) return;
    setLoading(true);
    setError(null);
    try {
      const cropNatural = displayCropToNatural(
        overlay,
        { width: dims.displayW, height: dims.displayH },
        { width: dims.naturalW, height: dims.naturalH },
      );
      const dataUrl = await cropRectToCompressedDataUrl(img, cropNatural);
      if (!mountedRef.current) return;
      // Aguarda o consumidor (ex.: persistência) — mantém o modal em loading
      // durante a operação, bloqueando duplo-envio e fechamento.
      await onConfirm(dataUrl);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof AvatarImageError
          ? err.message
          : "Não foi possível processar a imagem.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" aria-busy={loading}>
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>
            Arraste para escolher a área que será usada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            ref={stageRef}
            className="relative inline-block touch-none overflow-hidden rounded-lg bg-muted select-none"
          >
            {objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL transitório; next/image não se aplica
              <img
                ref={imgRef}
                src={objectUrl}
                alt="Pré-visualização da foto a recortar"
                onLoad={handleImgLoad}
                onError={handleImgError}
                draggable={false}
                className="block max-h-[60vh] w-auto max-w-full pointer-events-none select-none"
              />
            ) : (
              <div className="flex size-48 items-center justify-center text-sm text-muted-foreground">
                Sem imagem
              </div>
            )}

            {dims ? (
              <div
                aria-label="Área de recorte — arraste para reposicionar"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute cursor-grab touch-none ring-2 ring-white outline outline-1 outline-black/40 active:cursor-grabbing"
                style={{
                  left: overlay.x,
                  top: overlay.y,
                  width: overlay.side,
                  height: overlay.side,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                }}
              />
            ) : null}
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 sm:h-9"
            disabled={loading || !dims}
            onClick={handleConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              "Salvar Foto"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
