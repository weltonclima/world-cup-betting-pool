"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { promoteGroupUser } from "@/services/group";
import type { Pool } from "@/types/pools";

import { groupKeys } from "./groupKeys";

/**
 * Promove um participante aprovado a admin do pool (PRD-10, TASK-06; D3: troca).
 * No sucesso, invalida a lista de aprovados (papéis mudaram) + dashboard.
 */
export function usePromoteGroupAdmin(): UseMutationResult<Pool, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<Pool, Error, string>({
    mutationFn: (uid) => promoteGroupUser(uid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.usersByStatus("approved"),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.dashboard() });
    },
    onError: () => toast.error("Não foi possível promover o usuário a admin."),
  });
}
