"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  upsertPredictionsBatch,
  type BatchUpsertResult,
  type UpsertPredictionInput,
} from "@/services/predictions";

import { homeKeys } from "@/features/home/hooks/homeKeys";
import { matchesKeys } from "@/features/matches/hooks/matchesKeys";

import { predictionsKeys } from "./predictionsKeys";

/**
 * Mutação TanStack Query para upsert de N palpites em lote (TASK-05).
 *
 * Chama upsertPredictionsBatch e, no sucesso (saved.length > 0 ou qualquer retorno
 * sem exceção), invalida predictionsKeys.all() para forçar refetch da lista.
 *
 * O hook NÃO emite toast internamente — delegar ao caller (TASK-09/15) para que
 * o feedback agregado (X gravados, Y rejeitados) seja contextual à tela.
 * Erros de rota (PredictionServiceError) propagam via onError para o caller.
 *
 * @param uid - UID do usuário autenticado (para invalidar matchesKeys.predictions(uid)).
 */
export function useUpsertPredictionsBatch(
  uid: string,
): UseMutationResult<BatchUpsertResult, Error, UpsertPredictionInput[]> {
  const queryClient = useQueryClient();

  return useMutation<BatchUpsertResult, Error, UpsertPredictionInput[]>({
    mutationFn: upsertPredictionsBatch,
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
      // NÃO emitir toast aqui — caller decide o feedback com base em result.saved/rejected
    },
    onError: () => {
      // Propagar sem toast — caller (TASK-09) tem contexto para mensagem agregada.
    },
  });
}
