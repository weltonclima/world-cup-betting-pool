"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getSystemSettings } from "@/services";
import type { SystemSettings } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para as configurações globais do sistema (TASK-05).
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function useSystemSettings(): UseQueryResult<SystemSettings | null> {
  return useQuery({
    queryKey: homeKeys.systemSettings(),
    queryFn: getSystemSettings,
  });
}
