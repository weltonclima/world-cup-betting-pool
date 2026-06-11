"use client";

import { useEffect, useState, type JSX } from "react";
import { LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MAX_REASON = 280;

/**
 * Dialog de captura do motivo do bloqueio (PRD10-03/04, A5). Motivo é OPCIONAL —
 * confirmar sem texto bloqueia sem motivo ("—" na exibição). Controlado; trava
 * fechamento enquanto `pending` (espelha `ConfirmActionDialog`).
 */
export function BlockReasonDialog({
  open,
  onOpenChange,
  userName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
}): JSX.Element {
  const [reason, setReason] = useState("");

  // Limpa ao reabrir para outro usuário.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Bloquear usuário</DialogTitle>
          <DialogDescription>
            Você está bloqueando <strong>{userName}</strong>. Informe o motivo
            (opcional).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="block-reason" className="text-sm font-medium text-foreground">
            Motivo
          </label>
          <textarea
            id="block-reason"
            value={reason}
            maxLength={MAX_REASON}
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Comportamento inadequado"
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/{MAX_REASON}
          </p>
        </div>
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={
              <Button variant="outline" className="h-11">
                Cancelar
              </Button>
            }
          />
          <Button
            variant="destructive"
            className="h-11"
            disabled={pending}
            aria-busy={pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
