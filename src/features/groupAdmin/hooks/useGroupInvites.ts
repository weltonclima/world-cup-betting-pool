"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  createInvite,
  listInvites,
  revokeInvite,
  type CreateInviteInput,
} from "@/services/group";
import type { Invite } from "@/types/invites";

import { groupKeys } from "./groupKeys";

/** Lista convites ativos do pool (PRD-10, TASK-08). */
export function useGroupInvites(): UseQueryResult<Invite[], Error> {
  return useQuery<Invite[], Error>({
    queryKey: groupKeys.invites(),
    queryFn: () => listInvites(),
  });
}

/** Cria um convite (expira o anterior — A3). Invalida a lista no sucesso. */
export function useCreateInvite(): UseMutationResult<
  Invite,
  Error,
  CreateInviteInput
> {
  const queryClient = useQueryClient();

  return useMutation<Invite, Error, CreateInviteInput>({
    mutationFn: (input) => createInvite(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.dashboard() });
    },
  });
}

/** Revoga um convite (`isActive=false`). Invalida a lista no sucesso. */
export function useRevokeInvite(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => revokeInvite(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.dashboard() });
    },
  });
}
