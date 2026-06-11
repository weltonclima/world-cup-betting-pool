"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { createPool, type CreatePoolInput } from "@/services/pools";
import type { Pool } from "@/types/pools";

import { groupsKeys } from "./groupsKeys";

/**
 * Cria um pool (TASK-04). No sucesso, invalida todas as buscas (`groupsKeys.all`)
 * — o novo pool nasce `pending` (fora da busca), mas a invalidação mantém a
 * consistência quando ele for ativado (TASK-05). Erros (`PoolServiceError`)
 * propagam crus; a UI (TASK-08) traduz/exibe.
 */
export function useCreateGroup(): UseMutationResult<Pool, Error, CreatePoolInput> {
  const queryClient = useQueryClient();

  return useMutation<Pool, Error, CreatePoolInput>({
    mutationFn: (input) => createPool(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
    },
  });
}
