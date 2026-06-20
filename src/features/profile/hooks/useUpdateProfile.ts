"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { updateProfile } from "@/services/users";
import { rankingKeys } from "@/features/rankings/hooks/rankingKeys";
import { useAuth } from "@/hooks/useAuth";

export interface UpdateProfileVars {
  nickname?: string;
  avatarUrl?: string;
}

/**
 * Atualiza apelido/avatar do PRÓPRIO perfil (PRD-06, D-A2) e relê o doc via
 * `refreshProfile` no sucesso (AuthProvider é a fonte de verdade do perfil em
 * memória — sem isso a UI mostraria o valor antigo). Erros propagam crus.
 *
 * Também INVALIDA os caches de ranking (`rankingKeys.all`): os GET de ranking
 * resolvem foto/apelido ao vivo (`hydrateRankingEntries`), mas o cache do React
 * Query (stale 30min) seguraria a foto antiga até expirar — invalidar força o
 * refetch que traz a foto nova.
 */
export function useUpdateProfile(): UseMutationResult<
  void,
  Error,
  UpdateProfileVars
> {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateProfileVars>({
    mutationFn: async (fields) => {
      if (!profile?.uid) throw new Error("Sessão inválida.");
      await updateProfile(profile.uid, fields);
    },
    onSuccess: () => {
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: rankingKeys.all() });
    },
  });
}
