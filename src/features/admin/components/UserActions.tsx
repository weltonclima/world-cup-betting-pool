"use client";

import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { User, UserStatus } from "@/types";

import { useUpdateUserStatus } from "../hooks/useUpdateUserStatus";
import { ApprovedDialog } from "./ApprovedDialog";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { mapUserActionError } from "./userActionErrors";
import { USER_ACTIONS, type UserActionDef } from "./userActionsConfig";

export interface UserActionsProps {
  user: User;
  /** Status da tab (origem da transição). Decide quais ações aparecem. */
  status: UserStatus;
}

/** Botões de moderação por linha + orquestração de mutação/diálogos/toast. */
export function UserActions({ user, status }: UserActionsProps) {
  const actions = USER_ACTIONS[status];
  const mutation = useUpdateUserStatus();
  const [confirming, setConfirming] = useState<UserActionDef | null>(null);
  const [approvedOpen, setApprovedOpen] = useState(false);

  const pending = mutation.isPending;

  async function run(action: UserActionDef): Promise<void> {
    try {
      await mutation.mutateAsync({
        uid: user.uid,
        from: status,
        to: action.to,
      });
      if (action.flow === "success") {
        setApprovedOpen(true);
      } else {
        setConfirming(null);
        if (action.successToast) toast.success(action.successToast);
      }
    } catch (error) {
      // confirm fica aberto p/ retry; success-flow não abre o ApprovedDialog.
      toast.error(mapUserActionError(error));
    }
  }

  function onClick(action: UserActionDef): void {
    if (action.flow === "success") void run(action);
    else setConfirming(action);
  }

  const description = useMemo(
    () => confirming?.confirm?.description.replace("{name}", user.name) ?? "",
    [confirming, user.name],
  );

  return (
    <>
      {actions.map((action) => {
        // Spinner inline só no fluxo direto (Aprovar) — confirm-flow usa o
        // spinner do próprio diálogo.
        const busy = pending && action.flow === "success";
        return (
          <Button
            key={action.id}
            variant={action.variant}
            className="h-11"
            disabled={pending}
            aria-busy={busy}
            onClick={() => onClick(action)}
          >
            {busy ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {action.label}
          </Button>
        );
      })}

      {confirming?.confirm ? (
        <ConfirmActionDialog
          open={confirming !== null}
          onOpenChange={(o) => {
            if (!o) setConfirming(null);
          }}
          title={confirming.confirm.title}
          description={description}
          confirmLabel={confirming.confirm.confirmLabel}
          confirmVariant={confirming.confirm.confirmVariant}
          pending={pending}
          onConfirm={() => void run(confirming)}
        />
      ) : null}

      <ApprovedDialog
        open={approvedOpen}
        onOpenChange={setApprovedOpen}
        userName={user.name}
      />
    </>
  );
}
