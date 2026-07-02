"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPredictionsByUid } from "@/services";
import type { Prediction } from "@/types";

import { predictionsKeys } from "./predictionsKeys";

/**
 * Hook TanStack Query para os palpites do usuário autenticado — escopo predictions (TASK-06).
 *
 * Espelha usePredictions de features/matches e features/home, mas usa o namespace
 * `predictionsKeys` — evita acoplamento cross-feature.
 *
 * - `queryKey: predictionsKeys.byUid(uid)` → `["predictions", uid]` (B2: isola o
 *   cache por conta — sem o uid na chave, um segundo login no mesmo navegador via
 *   o cache do usuário anterior até um refetch).
 * - `enabled: uid !== null` — sem uid, sem query (edge case de segurança).
 * - Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 *
 * @param uid - UID do Firebase Auth. Null desabilita a query.
 */
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: predictionsKeys.byUid(uid ?? ""),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
