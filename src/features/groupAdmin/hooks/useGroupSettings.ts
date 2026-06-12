"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  getGroupSettings,
  updateGroupSettings,
  type UpdateGroupSettingsInput,
} from "@/services/group";
import type { Pool } from "@/types/pools";

import { groupKeys } from "./groupKeys";

/** Lê o pool da sessão para o form de configurações (PRD-10, TASK-07). */
export function useGroupSettings(): UseQueryResult<Pool, Error> {
  return useQuery<Pool, Error>({
    queryKey: groupKeys.settings(),
    queryFn: () => getGroupSettings(),
  });
}

/** Atualiza as configurações do grupo. Invalida settings + dashboard no sucesso. */
export function useUpdateGroupSettings(): UseMutationResult<
  Pool,
  Error,
  UpdateGroupSettingsInput
> {
  const queryClient = useQueryClient();

  return useMutation<Pool, Error, UpdateGroupSettingsInput>({
    mutationFn: (input) => updateGroupSettings(input),
    onSuccess: (pool) => {
      queryClient.setQueryData(groupKeys.settings(), pool);
      void queryClient.invalidateQueries({ queryKey: groupKeys.dashboard() });
    },
  });
}
