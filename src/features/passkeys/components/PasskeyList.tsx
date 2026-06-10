"use client";

import { useState, type JSX } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { WebauthnCredential } from "@/schemas";
import { useRevokePasskey } from "../hooks";
import { RemovePasskeyDialog } from "./RemovePasskeyDialog";

/** Linha de um passkey cadastrado. */
function PasskeyRow({
  passkey,
  onRemoveClick,
}: {
  passkey: WebauthnCredential;
  onRemoveClick: (p: WebauthnCredential) => void;
}): JSX.Element {
  const label = passkey.deviceLabel ?? "Dispositivo";
  const created = format(new Date(passkey.createdAt), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <div className="flex min-h-[56px] w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Fingerprint size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Cadastrado em {created}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onRemoveClick(passkey)}
        aria-label={`Remover ${label}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Lista de passkeys cadastrados com remoção confirmada (TASK-06). */
export function PasskeyList({
  passkeys,
}: {
  passkeys: WebauthnCredential[];
}): JSX.Element {
  const [removing, setRemoving] = useState<WebauthnCredential | null>(null);
  const revoke = useRevokePasskey();

  function handleConfirm(): void {
    if (!removing) return;
    revoke.mutate(removing.credentialId, {
      onSettled: () => setRemoving(null),
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {passkeys.map((p) => (
          <PasskeyRow
            key={p.credentialId}
            passkey={p}
            onRemoveClick={setRemoving}
          />
        ))}
      </div>

      <RemovePasskeyDialog
        open={removing !== null}
        deviceLabel={removing?.deviceLabel ?? "Dispositivo"}
        pending={revoke.isPending}
        onConfirm={handleConfirm}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setRemoving(null);
        }}
      />
    </>
  );
}
