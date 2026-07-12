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
  displayRectToNatural,
  rectCropToCompressedDataUrl,
  type RectCropRect,
} from "@/features/profile/lib/imageToDataUrl";

/** Retângulo em coords de EXIBIÇÃO (px do `<img>` renderizado). */
type Overlay = { x: number; y: number; width: number; height: number };

type ImageDims = {
  displayW: number;
  displayH: number;
  naturalW: number;
  naturalH: number;
};

/** Modo de interação com o overlay: reposicionar (mover) ou redimensionar (alça). */
type DragState =
  | { mode: "move"; pointerX: number; pointerY: number; origX: number; origY: number }
  | { mode: "resize"; pointerX: number; pointerY: number; origW: number; origH: number };

export interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  /** Recebe a data URL recortada/comprimida. Pode ser assíncrono (persistência). */
  onConfirm: (dataUrl: string) => void | Promise<void>;
  onCancel: () => void;
  /** Textos configuráveis (default: logo). */
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Teto de bytes e maior dimensão de saída (default: logo). */
  maxBytes?: number;
  maxDimension?: number;
}

/** Lado mínimo (px de exibição) do recorte — evita colapso a zero. */
const MIN_OVERLAY_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Modal genérico de recorte de imagem com **proporção livre** (retangular). O
 * usuário arrasta o corpo do overlay para reposicionar e a alça do canto
 * inferior-direito para redimensionar. Ao confirmar, converte as coords para a
 * imagem natural e chama `rectCropToCompressedDataUrl`. Componente controlado
 * (o pai detém `open`/`file`). Client-only. Não substitui o `AvatarCropModal`
 * (avatar segue quadrado 1:1).
 */
export function ImageCropModal({
  open,
  file,
  onConfirm,
  onCancel,
  title = "Ajustar logo",
  description = "Arraste para mover; use a alça do canto para redimensionar.",
  confirmLabel = "Salvar Logo",
  maxBytes,
  maxDimension,
}: ImageCropModalProps): JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const mountedRef = useRef(true);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<ImageDims | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ x: 0, y: 0, width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Object URL da imagem ao abrir; revoga no cleanup.
  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null);
      setDims(null);
      setError(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setDims(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // Recalcula dimensões de exibição em resize da janela, mantendo o overlay dentro.
  useEffect(() => {
    if (!open) return;
    function onResize(): void {
      const img = imgRef.current;
      if (!img || !img.complete) return;
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;
      setDims((p) => (p ? { ...p, displayW, displayH } : p));
      setOverlay((o) => {
        const width = Math.min(o.width, displayW);
        const height = Math.min(o.height, displayH);
        return {
          width,
          height,
          x: clamp(o.x, 0, displayW - width),
          y: clamp(o.y, 0, displayH - height),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  function handleImgLoad(): void {
    const img = imgRef.current;
    if (!img) return;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    setDims({
      displayW,
      displayH,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    });
    // Overlay inicial = imagem inteira (usuário reduz conforme desejar).
    setOverlay({ x: 0, y: 0, width: displayW, height: displayH });
  }

  function handleImgError(): void {
    setError("Não foi possível ler a imagem.");
    setDims(null);
  }

  function onBodyPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!dims) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      mode: "move",
      pointerX: e.clientX,
      pointerY: e.clientY,
      origX: overlay.x,
      origY: overlay.y,
    };
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!dims) return;
    e.stopPropagation(); // não iniciar "move" no corpo
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      mode: "resize",
      pointerX: e.clientX,
      pointerY: e.clientY,
      origW: overlay.width,
      origH: overlay.height,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const d = drag.current;
    if (!d || !dims) return;
    const dx = e.clientX - d.pointerX;
    const dy = e.clientY - d.pointerY;
    if (d.mode === "move") {
      setOverlay((o) => ({
        width: o.width,
        height: o.height,
        x: clamp(d.origX + dx, 0, dims.displayW - o.width),
        y: clamp(d.origY + dy, 0, dims.displayH - o.height),
      }));
    } else {
      setOverlay((o) => ({
        x: o.x,
        y: o.y,
        width: clamp(d.origW + dx, MIN_OVERLAY_PX, dims.displayW - o.x),
        height: clamp(d.origH + dy, MIN_OVERLAY_PX, dims.displayH - o.y),
      }));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    drag.current = null;
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
      const cropNatural: RectCropRect = displayRectToNatural(
        overlay,
        { width: dims.displayW, height: dims.displayH },
        { width: dims.naturalW, height: dims.naturalH },
      );
      const dataUrl = await rectCropToCompressedDataUrl(
        img,
        cropNatural,
        maxBytes,
        maxDimension,
      );
      if (!mountedRef.current) return;
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
                alt="Pré-visualização da imagem a recortar"
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
                aria-label="Área de recorte — arraste para mover; use a alça para redimensionar"
                onPointerDown={onBodyPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute cursor-grab touch-none ring-2 ring-white outline outline-1 outline-black/40 active:cursor-grabbing"
                style={{
                  left: overlay.x,
                  top: overlay.y,
                  width: overlay.width,
                  height: overlay.height,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  aria-label="Redimensionar recorte"
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="absolute -right-1.5 -bottom-1.5 size-6 cursor-nwse-resize rounded-sm border-2 border-white bg-primary shadow"
                />
              </div>
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
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
