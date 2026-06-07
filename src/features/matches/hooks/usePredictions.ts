"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPredictionsByUid } from "@/services";
import type { Prediction } from "@/types";

import { matchesKeys } from "./matchesKeys";

/**
 * Hook TanStack Query para os palpites do usuário autenticado — escopo matches (TASK-02).
 *
 * Espelha `usePredictions` da feature home, mas usa o namespace `matchesKeys`
 * em vez de `homeKeys` — evita acoplamento cross-feature.
 *
 * - `queryKey: matchesKeys.predictions(uid ?? "")` → `["matches","predictions",uid]`.
 * - `enabled: uid !== null` — sem uid, sem query (edge case de segurança).
 * - Sem redefinição de `staleTime` — herda do QueryClient global (30min/24h).
 *
 * @param uid - UID do Firebase Auth. Null desabilita a query.
 */
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: matchesKeys.predictions(uid ?? ""),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
