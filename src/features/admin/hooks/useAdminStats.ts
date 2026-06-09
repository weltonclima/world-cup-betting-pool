"use client";

import { useUserStatusCounts, useUsersByStatus } from "./useUsers";

export interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  blocked: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Indicadores do Dashboard Admin (PRD07-01) derivados das contagens de usuários.
 * Reusa `useUsersByStatus` (mesmo cache das tabs — sem query extra). "Total de
 * Palpites" e "Jogos Processados" do mock NÃO têm serviço de contagem agregada e
 * ficam como pendência (placeholder honesto na UI — D-A3/§4 do plano).
 */
export function useAdminStats(): AdminStats {
  const counts = useUserStatusCounts();
  const pending = useUsersByStatus("pending");
  const approved = useUsersByStatus("approved");
  const blocked = useUsersByStatus("blocked");

  return {
    total: counts.pending + counts.approved + counts.blocked,
    pending: counts.pending,
    approved: counts.approved,
    blocked: counts.blocked,
    isLoading: pending.isPending || approved.isPending || blocked.isPending,
    isError: pending.isError || approved.isError || blocked.isError,
  };
}
