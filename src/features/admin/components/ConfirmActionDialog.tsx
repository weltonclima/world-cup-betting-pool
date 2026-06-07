"use client";

import type { ReactNode } from "react";
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

import type { ActionVariant } from "./userActionsConfig";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant: ActionVariant;
  /** Submetendo a mutação: trava fechar acidental e habilita spinner/disabled. */
  pending: boolean;
  /** Dispara a mutação. NÃO fecha o diálogo (o pai fecha no sucesso). */
  onConfirm: () => void;
}

/**
 * Diálogo de confirmação reutilizável (confirmar-antes). Controlado.
 *
 * Invariante a11y (critical): enquanto `pending`, fechar é impossível — Esc e
 * clique no backdrop disparam `onOpenChange(false)`, que é ignorado; o X é
 * removido (`showCloseButton={!pending}`) e Cancelar fica `disabled`.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant,
  pending,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Bloqueia qualquer fechamento (Esc/backdrop) durante o submit.
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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
            variant={confirmVariant}
            className="h-11"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
