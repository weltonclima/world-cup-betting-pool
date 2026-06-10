"use client";

import type { JSX } from "react";
import { LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmação de remoção de passkey (ação destrutiva, TASK-06). Dialog
 * controlado; foco preso e retorno ao gatilho são nativos da primitiva.
 */
export function RemovePasskeyDialog({
  open,
  deviceLabel,
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  deviceLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover dispositivo</DialogTitle>
          <DialogDescription>
            Remover <span className="font-medium">{deviceLabel}</span>? Você não
            poderá mais entrar com a biometria deste dispositivo (a senha
            continua funcionando).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
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
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
