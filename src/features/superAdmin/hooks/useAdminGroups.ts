"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { toast } from "sonner";

import {
  changeGroupAdmin,
  deleteGroup,
  listGroupsByStatus,
  removeGroupAdmin,
  updateGroupStatus,
  type AdminPoolRow,
} from "@/services/superAdmin";
import { superAdminKeys } from "./superAdminKeys";

type GroupStatus = "pending" | "active" | "blocked";

/** Lista pools por status (PRD11-02/03/04). */
export function useAdminGroups(
  status: GroupStatus,
): UseQueryResult<AdminPoolRow[], Error> {
  return useQuery<AdminPoolRow[], Error>({
    queryKey: superAdminKeys.groups(status),
    queryFn: () => listGroupsByStatus(status),
  });
}

/** Invalida todas as listas de grupo + o dashboard após uma mutação. */
function useInvalidateGroups(): () => void {
  const queryClient = useQueryClient();
  return () => {
    for (const status of ["pending", "active", "blocked"] as const) {
      void queryClient.invalidateQueries({
        queryKey: superAdminKeys.groups(status),
      });
    }
    void queryClient.invalidateQueries({ queryKey: superAdminKeys.dashboard() });
    void queryClient.invalidateQueries({ queryKey: superAdminKeys.admins() });
  };
}

export interface UpdateGroupStatusVars {
  id: string;
  status: "active" | "blocked";
}

/** Aprovar/Rejeitar/Bloquear/Reativar grupo (reuso PATCH /status). */
export function useUpdateGroupStatus(): UseMutationResult<
  void,
  Error,
  UpdateGroupStatusVars
> {
  const invalidate = useInvalidateGroups();
  return useMutation<void, Error, UpdateGroupStatusVars>({
    mutationFn: ({ id, status }) => updateGroupStatus(id, status),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível atualizar o status do grupo."),
  });
}

/** Excluir (soft-delete) grupo bloqueado (B2). */
export function useDeleteGroup(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateGroups();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteGroup(id),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível excluir o grupo."),
  });
}

export interface ChangeGroupAdminVars {
  id: string;
  adminId: string;
}

/** Substituir/Transferir admin do grupo (reuso PATCH /admin). */
export function useChangeGroupAdmin(): UseMutationResult<
  void,
  Error,
  ChangeGroupAdminVars
> {
  const invalidate = useInvalidateGroups();
  return useMutation<void, Error, ChangeGroupAdminVars>({
    mutationFn: ({ id, adminId }) => changeGroupAdmin(id, adminId),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível alterar o administrador."),
  });
}

/** Remover admin do grupo (rebaixa a participant, B3). */
export function useRemoveGroupAdmin(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateGroups();
  return useMutation<void, Error, string>({
    mutationFn: (id) => removeGroupAdmin(id),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível remover o administrador."),
  });
}
