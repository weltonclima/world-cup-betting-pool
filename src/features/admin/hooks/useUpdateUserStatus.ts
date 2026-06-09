"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { updateUserStatus } from "@/services/users";
import { createNotification } from "@/services/notifications";
import { createLog } from "@/services/systemLogs";
import { canTransition } from "@/schemas";
import { firebaseAuth } from "@/firebase";
import {
  moderationLog,
  moderationNotification,
  type ModerationContext,
} from "@/features/admin/lib/notificationFactory";
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
 * Efeitos colaterais da moderação (best-effort): grava log de auditoria e cria a
 * notificação de Sistema para o usuário-alvo. Cada escrita é isolada em try/catch
 * — uma falha (rede/permissão) não interrompe a outra nem propaga para a mutação.
 */
async function recordModerationSideEffects(ctx: ModerationContext): Promise<void> {
  try {
    await createLog(moderationLog(ctx));
  } catch (error) {
    console.error("Falha ao registrar log de moderação:", error);
  }

  const notification = moderationNotification(ctx);
  if (notification) {
    try {
      await createNotification(notification);
    } catch (error) {
      console.error("Falha ao criar notificação de moderação:", error);
    }
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
      // Auditoria (PRD-07) + notificação de Sistema (PRD-08, D-A5). Best-effort:
      // a moderação já efetivou — falha aqui NÃO derruba a ação (só loga).
      await recordModerationSideEffects({
        uid,
        from,
        to,
        actorUid: firebaseAuth.currentUser?.uid ?? "system",
      });
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
