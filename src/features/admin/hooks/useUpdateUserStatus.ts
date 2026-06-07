"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { updateUserStatus } from "@/services/users";
import { canTransition } from "@/schemas";
import type { UserStatus } from "@/types";

import { usersKeys } from "./usersKeys";

export interface UpdateUserStatusVars {
  uid: string;
  from: UserStatus;
  to: UserStatus;
}

/**
 * Erro de transição barrada no client (antes do Firestore). Permite à UI
 * (TASK-07) distinguir "transição inválida" de `permission-denied` do servidor.
 */
export class InvalidStatusTransitionError extends Error {
  readonly from: UserStatus;
  readonly to: UserStatus;

  constructor(from: UserStatus, to: UserStatus) {
    super("Transição de status não permitida.");
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Mutação de status de usuário (Aprovar/Rejeitar/Bloquear/Desbloquear).
 *
 * Valida a transição na borda (`canTransition`, TASK-02) ANTES de chamar o
 * service — transição inválida rejeita sem tocar o Firestore. No sucesso,
 * invalida as queries de ORIGEM e DESTINO (R2: recontagem/relista das tabs
 * afetadas). Erros do service propagam crus (UI traduz — TASK-07).
 */
export function useUpdateUserStatus(): UseMutationResult<
  void,
  Error,
  UpdateUserStatusVars
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateUserStatusVars>({
    mutationFn: async ({ uid, from, to }) => {
      if (!canTransition(from, to)) {
        throw new InvalidStatusTransitionError(from, to);
      }
      await updateUserStatus(uid, to);
    },
    onSuccess: (_data, { from, to }) => {
      void queryClient.invalidateQueries({
        queryKey: usersKeys.byStatus(from),
      });
      void queryClient.invalidateQueries({
        queryKey: usersKeys.byStatus(to),
      });
    },
  });
}
