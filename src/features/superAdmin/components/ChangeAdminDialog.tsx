"use client";

import { useState, type JSX } from "react";
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
import { usePoolMembers } from "@/features/superAdmin/hooks";

/**
 * Diálogo de seleção de novo admin do pool (PRD11-03 "Alterar Admin" / PRD11-05
 * "Substituir"/"Transferir"). Lista os membros approved do pool e dispara a troca
 * com o uid selecionado. Controlado; o pai fecha no sucesso.
 */
export function ChangeAdminDialog({
  open,
  onOpenChange,
  poolId,
  poolName,
  pending,
  onConfirm,
  title = "Alterar Admin",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolId: string;
  poolName: string;
  pending: boolean;
  onConfirm: (adminId: string) => void;
  title?: string;
}): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = usePoolMembers(poolId, open);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setSelected(null);
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Escolha o novo administrador do grupo {poolName}.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div role="status" aria-busy="true" aria-label="Carregando membros" className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden="true" className="h-11 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">Erro ao carregar membros.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px]">
                Tentar novamente
              </Button>
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum membro disponível.
            </p>
          ) : (
            <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Selecionar novo admin">
              {(data ?? []).map((m) => {
                const active = selected === m.uid;
                return (
                  <li key={m.uid}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={pending}
                      onClick={() => setSelected(m.uid)}
                      className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
            className="h-11"
            disabled={pending || selected === null}
            aria-busy={pending}
            onClick={() => selected && onConfirm(selected)}
          >
            {pending ? (
              <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
