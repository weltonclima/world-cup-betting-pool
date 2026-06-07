"use client";

import { CheckCircle2 } from "lucide-react";

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

export interface ApprovedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
}

/** Modal de sucesso pós-aprovação (tela 04 do mock). */
export function ApprovedDialog({
  open,
  onOpenChange,
  userName,
}: ApprovedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 size={32} aria-hidden="true" className="text-primary" />
        </div>
        <DialogHeader className="items-center">
          <DialogTitle>Usuário aprovado!</DialogTitle>
          <DialogDescription>
            {userName} foi aprovado com sucesso.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
          O usuário receberá acesso imediatamente.
        </div>
        <DialogFooter>
          <DialogClose render={<Button className="h-11 w-full">OK</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
