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
  createAdminGroup,
  createAdminGroupInvite,
  deleteGroup,
  listGroupsByStatus,
  removeGroupAdmin,
  updateAdminGroup,
  updateGroupStatus,
  type AdminPoolRow,
  type CreateAdminGroupInput,
  type CreateAdminGroupInviteInput,
  type EditAdminGroupInput,
} from "@/services/superAdmin";
import type { Invite } from "@/types/invites";
import { superAdminKeys } from "./superAdminKeys";

export type { CreateAdminGroupInviteInput };

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

/** Criar grupo já ativo (super_admin, PRD-11). */
export function useCreateAdminGroup(): UseMutationResult<
  AdminPoolRow,
  Error,
  CreateAdminGroupInput
> {
  const invalidate = useInvalidateGroups();
  return useMutation<AdminPoolRow, Error, CreateAdminGroupInput>({
    mutationFn: (input) => createAdminGroup(input),
    onSuccess: invalidate,
  });
}

export interface UpdateAdminGroupVars {
  id: string;
  patch: EditAdminGroupInput;
}

/** Editar campos do grupo (super_admin, PRD-11). */
export function useUpdateAdminGroup(): UseMutationResult<
  void,
  Error,
  UpdateAdminGroupVars
> {
  const invalidate = useInvalidateGroups();
  return useMutation<void, Error, UpdateAdminGroupVars>({
    mutationFn: ({ id, patch }) => updateAdminGroup(id, patch),
    onSuccess: invalidate,
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

/**
 * Gera um convite para um pool (super_admin). Escopo só-gerar: não lista nem
 * invalida queries — o convite criado é exibido inline pelo Dialog (TASK-05).
 */
export function useCreateAdminGroupInvite(
  poolId: string,
): UseMutationResult<Invite, Error, CreateAdminGroupInviteInput> {
  return useMutation<Invite, Error, CreateAdminGroupInviteInput>({
    mutationFn: (input) => createAdminGroupInvite(poolId, input),
  });
}
