"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getStatistics } from "@/services";
import type { Statistics } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para as estatísticas do usuário (TASK-05).
 * Desabilitado quando uid for null (edge case de segurança — sem uid, sem consulta).
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useStatistics(uid: string | null): UseQueryResult<Statistics | null> {
  return useQuery({
    queryKey: homeKeys.statistics(uid ?? ""),
    queryFn: () => getStatistics(uid!),
    enabled: uid !== null,
  });
}
