"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { createGroupManualPrediction } from "@/services/group";
import { predictionsKeys } from "@/features/predictions/hooks/predictionsKeys";
import { rankingKeys } from "@/features/rankings/hooks/rankingKeys";
import type {
  GroupManualPredictionInput,
  GroupManualPredictionSaved,
} from "@/types/predictions";

import { groupKeys } from "./groupKeys";

/**
 * Mutation do palpite manual do admin de grupo (PRD-12). Após gravar (o endpoint
 * recalcula o ranking in-process), invalida palpites + ranking + lista do grupo —
 * invalidação ampla por correção (o recalc afeta posições de vários membros).
 * Erros já chegam mapeados em pt-BR (`GroupServiceError`).
 */
export function useCreateManualPrediction(): UseMutationResult<
  GroupManualPredictionSaved,
  Error,
  GroupManualPredictionInput
> {
  const queryClient = useQueryClient();

  return useMutation<
    GroupManualPredictionSaved,
    Error,
    GroupManualPredictionInput
  >({
    mutationFn: createGroupManualPrediction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: predictionsKeys.all() });
      void queryClient.invalidateQueries({ queryKey: rankingKeys.all() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.predictions() });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.usersByStatus("approved"),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
