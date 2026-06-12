"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { moderateGroupUser, type GroupModerationAction } from "@/services/group";
import { createNotification } from "@/services/notifications";
import { createLog } from "@/services/systemLogs";
import { firebaseAuth } from "@/firebase";
import {
  moderationLog,
  moderationNotification,
  type ModerationContext,
} from "@/features/admin/lib/notificationFactory";
import type { User, UserStatus } from "@/types";

import { groupKeys } from "./groupKeys";

export interface ModerateGroupUserVars {
  action: GroupModerationAction;
  uid: string;
  /** Estado atual e destino — para invalidação das listas afetadas. */
  from: UserStatus;
  to: UserStatus;
  /** Motivo do bloqueio (somente `block`). */
  reason?: string;
}

/**
 * Efeitos colaterais de moderação (best-effort) — REUSA o motor da PRD-07/08
 * (`notificationFactory`). Cada escrita isolada: falha de rede/permissão não
 * derruba a outra nem propaga para a mutação (a moderação já efetivou no servidor).
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
 * Mutação de moderação de usuário do pool (PRD-10, TASK-05). Espelha
 * `useUpdateUserStatus` (admin): a transição é validada/aplicada no servidor
 * (escopada por pool, super_admin protegido); aqui invalidamos as listas de
 * ORIGEM e DESTINO + dashboard, e gravamos os side-effects de auditoria/notificação.
 *
 * `remove` (soft-delete) só sai de `blocked` e não notifica (to === from no fluxo
 * de UI o trata como saída da lista de bloqueados → invalida `blocked`).
 */
export function useModerateGroupUser(): UseMutationResult<
  User | void,
  Error,
  ModerateGroupUserVars
> {
  const queryClient = useQueryClient();

  return useMutation<User | void, Error, ModerateGroupUserVars>({
    mutationFn: async ({ action, uid, from, to, reason }) => {
      const updated = await moderateGroupUser({
        action,
        uid,
        ...(reason !== undefined ? { reason } : {}),
      });
      // Side-effects só para transições de status (não para `remove`).
      if (action !== "remove") {
        await recordModerationSideEffects({
          uid,
          from,
          to,
          actorUid: firebaseAuth.currentUser?.uid ?? "system",
        });
      }
      return updated;
    },
    onSuccess: (_data, { from, to }) => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.usersByStatus(from),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.usersByStatus(to),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.dashboard() });
    },
    onError: () => toast.error("Não foi possível concluir a ação de moderação."),
  });
}
