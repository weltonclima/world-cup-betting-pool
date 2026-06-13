"use client";

import { useState } from "react";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isGroupAdminRole, isSuperAdminRole } from "@/schemas/shared";
import { triggerGroupRankingRecalc } from "@/services";

interface RecalcGroupRankingButtonProps {
  /** Refetch do ranking do pool após o reprocessamento. */
  onDone: () => void;
}

/**
 * Botão "Reprocessar ranking" da Tela 01 (PRD-09).
 *
 * Visível SÓ para o admin do grupo (group_admin; super_admin incluído por
 * conveniência operacional). Dispara `POST /api/group/rankings/recalc`, que recomputa
 * só o doc `rankings/pool-{groupId}-geral` do pool da sessão, e então refaz a query do
 * ranking. Corrige defasagem quando o recalc encadeado no save de resultado falhou.
 *
 * Participante comum não vê o botão (retorna null) — a leitura do ranking já é fresca
 * o bastante via cache; o reprocessamento é ação administrativa.
 */
export function RecalcGroupRankingButton({ onDone }: RecalcGroupRankingButtonProps) {
  const { profile } = useAuth();
  const role = profile?.role ?? null;
  const canRecalc = role !== null && (isGroupAdminRole(role) || isSuperAdminRole(role));
  const [isPending, setIsPending] = useState(false);

  if (!canRecalc) return null;

  async function handleClick() {
    if (isPending) return;
    setIsPending(true);
    try {
      await triggerGroupRankingRecalc();
      onDone();
      toast.success("Ranking reprocessado.");
    } catch {
      toast.error("Não foi possível reprocessar. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Reprocessar ranking do grupo"
      className="min-h-11 self-end"
    >
      {isPending ? (
        <LoaderCircle
          size={16}
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <RefreshCw size={16} aria-hidden="true" />
      )}
      Reprocessar ranking
    </Button>
  );
}
