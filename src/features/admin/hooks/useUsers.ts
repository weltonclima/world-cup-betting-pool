"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listUsersByStatus } from "@/services/users";
import type { User, UserStatus } from "@/types";

import { usersKeys } from "./usersKeys";

/**
 * Lista reativa de usuários por status (uma query por tab). NÃO redefine
 * `staleTime`/`gcTime`: herda do QueryClient global (30min/24h) — política do
 * projeto centralizada em `makeQueryClient`.
 */
export function useUsersByStatus(
  status: UserStatus,
): UseQueryResult<User[]> {
  return useQuery({
    queryKey: usersKeys.byStatus(status),
    queryFn: () => listUsersByStatus(status),
  });
}

export interface UserStatusCounts {
  pending: number;
  approved: number;
  blocked: number;
}

/**
 * Contadores das 3 tabs. Reusa `useUsersByStatus` → compartilha o MESMO cache
 * (mesma queryKey) das listas: nenhuma query extra. `data?.length ?? 0` garante
 * que o badge nunca renderiza `undefined`/`NaN` durante o carregamento.
 */
export function useUserStatusCounts(): UserStatusCounts {
  const pending = useUsersByStatus("pending");
  const approved = useUsersByStatus("approved");
  const blocked = useUsersByStatus("blocked");
  return {
    pending: pending.data?.length ?? 0,
    approved: approved.data?.length ?? 0,
    blocked: blocked.data?.length ?? 0,
  };
}
