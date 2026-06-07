"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import {
  upsertPrediction,
  type UpsertPredictionInput,
} from "@/services/predictions";

import { homeKeys } from "@/features/home/hooks/homeKeys";
import { matchesKeys } from "@/features/matches/hooks/matchesKeys";

import { predictionsKeys } from "./predictionsKeys";

/**
 * Mutação de upsert de palpite (TASK-06).
 *
 * Chama upsertPrediction (fetch POST /api/predictions) e, no sucesso, invalida
 * três namespaces de cache para garantir que o badge de palpite atualize em:
 *   1. Feature predictions: predictionsKeys.all()
 *   2. Feature matches: matchesKeys.predictions(uid) — badge nos cards de Jogos
 *   3. Feature home: homeKeys.predictions(uid) — badge nos cards da Home
 *
 * Erros do service (PredictionServiceError) são exibidos via toast.error (Sonner).
 * O chamador não precisa tratar erros — o hook centraliza o feedback.
 *
 * @param uid - UID do usuário autenticado (necessário para invalidar as keys corretas).
 */
export function useUpsertPrediction(
  uid: string,
): UseMutationResult<void, Error, UpsertPredictionInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpsertPredictionInput>({
    mutationFn: upsertPrediction,
    onSuccess: () => {
      // 1. Invalida palpites da feature predictions (lista /predictions).
      void queryClient.invalidateQueries({
        queryKey: predictionsKeys.all(),
      });
      // 2. Invalida badge nos cards de Jogos (feature matches).
      void queryClient.invalidateQueries({
        queryKey: matchesKeys.predictions(uid),
      });
      // 3. Invalida badge nos cards da Home (feature home).
      void queryClient.invalidateQueries({
        queryKey: homeKeys.predictions(uid),
      });
    },
    onError: (error) => {
      // Exibe mensagem pt-BR já mapeada pelo service.
      toast.error(error.message);
    },
  });
}
