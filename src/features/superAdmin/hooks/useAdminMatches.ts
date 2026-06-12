"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  editMatch,
  listAdminMatches,
  syncWorldCup,
  type AdminMatchView,
  type MatchEditInput,
  type MatchFilters,
} from "@/services/superAdmin";
import type { SyncLog } from "@/schemas/syncLogs";
import { superAdminKeys } from "./superAdminKeys";

/** Lista filtrada de partidas (PRD11-07). */
export function useAdminMatches(
  filters: MatchFilters,
): UseQueryResult<AdminMatchView[], Error> {
  return useQuery<AdminMatchView[], Error>({
    queryKey: superAdminKeys.matches({
      ...(filters.group ? { group: filters.group } : {}),
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }),
    queryFn: () => listAdminMatches(filters),
  });
}

/** Invalida todas as listas de partidas (prefixo) + o dashboard (lastSync). */
function useInvalidateMatches(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
    void queryClient.invalidateQueries({ queryKey: superAdminKeys.dashboard() });
  };
}

/** Sincroniza partidas openfootball → Firestore (PRD-11 TASK-02). */
export function useSyncWorldCup(): UseMutationResult<SyncLog, Error, void> {
  const invalidate = useInvalidateMatches();
  return useMutation<SyncLog, Error, void>({
    mutationFn: () => syncWorldCup(),
    onSuccess: invalidate,
  });
}

export interface EditMatchVars {
  id: string;
  input: MatchEditInput;
}

/** Edição manual de uma partida (PRD-11 TASK-04). */
export function useEditMatch(): UseMutationResult<void, Error, EditMatchVars> {
  const invalidate = useInvalidateMatches();
  return useMutation<void, Error, EditMatchVars>({
    mutationFn: ({ id, input }) => editMatch(id, input),
    onSuccess: invalidate,
  });
}
