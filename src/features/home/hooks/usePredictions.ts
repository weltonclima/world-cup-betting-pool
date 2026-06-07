"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPredictionsByUid } from "@/services";
import type { Prediction } from "@/types";

import { homeKeys } from "./homeKeys";

/**
 * Hook TanStack Query para os palpites do usuário autenticado (TASK-05).
 * Desabilitado quando uid for null (edge case de segurança — sem uid, sem consulta).
 * Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 */
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: homeKeys.predictions(uid ?? ""),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
