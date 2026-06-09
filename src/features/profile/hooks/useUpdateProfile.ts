"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { updateProfile } from "@/services/users";
import { useAuth } from "@/hooks/useAuth";

export interface UpdateProfileVars {
  nickname?: string;
  avatarUrl?: string;
}

/**
 * Atualiza apelido/avatar do PRÓPRIO perfil (PRD-06, D-A2) e relê o doc via
 * `refreshProfile` no sucesso (AuthProvider é a fonte de verdade do perfil em
 * memória — sem isso a UI mostraria o valor antigo). Erros propagam crus.
 */
export function useUpdateProfile(): UseMutationResult<
  void,
  Error,
  UpdateProfileVars
> {
  const { profile, refreshProfile } = useAuth();

  return useMutation<void, Error, UpdateProfileVars>({
    mutationFn: async (fields) => {
      if (!profile?.uid) throw new Error("Sessão inválida.");
      await updateProfile(profile.uid, fields);
    },
    onSuccess: () => {
      void refreshProfile();
    },
  });
}
