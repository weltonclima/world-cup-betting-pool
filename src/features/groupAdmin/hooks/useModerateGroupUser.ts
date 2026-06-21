"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { moderateGroupUser, type GroupModerationAction } from "@/services/group";
import { createLog } from "@/services/systemLogs";
import { firebaseAuth } from "@/firebase";
import {
  moderationLog,
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
 * Efeito colateral de moderação (best-effort): grava o log de auditoria. A
 * notificação `system` migrou para o Route Handler server-side (TASK-03) —
 * criá-la aqui no client era negado pelas Firestore Rules para group_admin
 * (bug silencioso). Falha do log é isolada e não propaga para a mutação.
 */
async function recordModerationSideEffects(ctx: ModerationContext): Promise<void> {
  try {
    await createLog(moderationLog(ctx));
  } catch (error) {
    console.error("Falha ao registrar log de moderação:", error);
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
