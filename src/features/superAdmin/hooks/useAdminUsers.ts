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
  assignUserToGroup,
  listAssignableUsers,
  type AdminUserRow,
  type UsersAssignFilter,
} from "@/services/superAdmin";
import { superAdminKeys } from "./superAdminKeys";

/** Lista usuários para atribuição de grupo (órfãos por padrão; `all` p/ realocar). */
export function useAssignableUsers(
  filter: UsersAssignFilter,
): UseQueryResult<AdminUserRow[], Error> {
  return useQuery<AdminUserRow[], Error>({
    queryKey: superAdminKeys.users(filter),
    queryFn: () => listAssignableUsers(filter),
  });
}

export interface AssignUserToGroupVars {
  uid: string;
  groupId: string;
}

/** Adiciona/realoca um usuário a um grupo (status → approved). */
export function useAssignUserToGroup(): UseMutationResult<
  void,
  Error,
  AssignUserToGroupVars
> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, AssignUserToGroupVars>({
    mutationFn: ({ uid, groupId }) => assignUserToGroup(uid, groupId),
    onSuccess: () => {
      // Invalida ambas as visões (o usuário muda de bucket) + contagens derivadas.
      for (const filter of ["without-group", "all"] as const) {
        void queryClient.invalidateQueries({
          queryKey: superAdminKeys.users(filter),
        });
      }
      for (const status of ["pending", "active", "blocked"] as const) {
        void queryClient.invalidateQueries({
          queryKey: superAdminKeys.groups(status),
        });
      }
      void queryClient.invalidateQueries({ queryKey: superAdminKeys.dashboard() });
      toast.success("Usuário adicionado ao grupo.");
    },
    onError: () => toast.error("Não foi possível adicionar o usuário ao grupo."),
  });
}
