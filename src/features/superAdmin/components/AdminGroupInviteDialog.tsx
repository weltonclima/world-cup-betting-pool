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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteValue, inviteUrl } from "@/components/invite/InviteValue";
import { useCreateAdminGroupInvite } from "@/features/superAdmin/hooks";
import type { Invite } from "@/types/invites";

const DEFAULT_VALIDITY_DAYS = 30;
const DEFAULT_MAX_USES = 100;

/**
 * Diálogo do super_admin para gerar um convite de qualquer pool (PRD-12, TASK-05).
 * Três estados no mesmo modal: form (validade + limite de usos com validação live),
 * aviso quando `allowInvites === false`, e visão pós-geração exibindo link + código
 * (reuso de `InviteValue`/`inviteUrl`). Escopo só-gerar: não lista nem invalida cache.
 */
export function AdminGroupInviteDialog({
  open,
  onOpenChange,
  poolId,
  poolName,
  allowInvites,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolId: string;
  poolName: string;
  allowInvites: boolean;
}): JSX.Element {
  const create = useCreateAdminGroupInvite(poolId);
  const [validity, setValidity] = useState(String(DEFAULT_VALIDITY_DAYS));
  const [maxUses, setMaxUses] = useState(String(DEFAULT_MAX_USES));
  const [generated, setGenerated] = useState<Invite | null>(null);

  const validityNum = Number(validity);
  const maxUsesNum = Number(maxUses);
  const invalid =
    !Number.isInteger(validityNum) ||
    validityNum < 1 ||
    validityNum > 365 ||
    !Number.isInteger(maxUsesNum) ||
    maxUsesNum < 1;

  function reset(): void {
    setValidity(String(DEFAULT_VALIDITY_DAYS));
    setMaxUses(String(DEFAULT_MAX_USES));
    setGenerated(null);
    create.reset();
  }

  function handleOpenChange(next: boolean): void {
    if (create.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function onGenerate(): void {
    if (invalid) return;
    create.mutate(
      { validityDays: validityNum, maxUses: maxUsesNum },
      { onSuccess: (invite) => setGenerated(invite) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!create.isPending}>
        {generated ? (
          <div aria-live="polite" className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Convite gerado</DialogTitle>
              <DialogDescription>
                Compartilhe o link ou o código com os participantes.
              </DialogDescription>
            </DialogHeader>

            <InviteValue
              title="Link de convite"
              description="Compartilhe o link abaixo para convidar novos participantes."
              value={inviteUrl(generated.code)}
              shareLabel="Compartilhar link"
              empty={false}
            />
            <InviteValue
              title="Código de convite"
              description="Compartilhe o código abaixo para convidar novos participantes."
              value={generated.code}
              shareLabel="Compartilhar código"
              empty={false}
            />

            <DialogFooter>
              <DialogClose render={<Button className="h-11">Concluir</Button>} />
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gerar convite</DialogTitle>
              <DialogDescription>
                Crie um link de convite para “{poolName}”.
              </DialogDescription>
            </DialogHeader>

            {!allowInvites ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Convites estão desativados nas configurações do grupo.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="admin-invite-validity">Validade (dias)</Label>
                    <Input
                      id="admin-invite-validity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      value={validity}
                      onChange={(e) => setValidity(e.target.value)}
                      disabled={create.isPending}
                      className="h-11"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="admin-invite-max-uses">Limite de usos</Label>
                    <Input
                      id="admin-invite-max-uses"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      disabled={create.isPending}
                      className="h-11"
                    />
                  </div>
                </div>
                {invalid ? (
                  <p className="text-xs text-destructive">
                    Validade entre 1 e 365 dias; limite de usos ≥ 1.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  O link de convite ativo anterior do grupo será desativado.
                </p>
                {create.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {create.error.message}
                  </p>
                ) : null}
              </div>
            )}

            <DialogFooter>
              <DialogClose
                disabled={create.isPending}
                render={
                  <Button variant="outline" className="h-11">
                    {allowInvites ? "Cancelar" : "Fechar"}
                  </Button>
                }
              />
              {allowInvites ? (
                <Button
                  type="button"
                  onClick={onGenerate}
                  disabled={invalid || create.isPending}
                  aria-busy={create.isPending}
                  className="h-11"
                >
                  {create.isPending ? (
                    <LoaderCircle
                      size={16}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : null}
                  Gerar
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
