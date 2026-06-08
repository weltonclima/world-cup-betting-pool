"use client";

import { useAuth } from "@/hooks/useAuth";
import type { User } from "@/types";

/**
 * Perfil do usuário logado (PRD-06). Wrapper semântico sobre `useAuth` — o doc
 * `users/{uid}` já é carregado e validado pelo AuthProvider; aqui só expomos de
 * forma conveniente para a área de Perfil (+ `refreshProfile` para releitura
 * após editar apelido/avatar).
 */
export function useProfile(): {
  profile: User | null;
  uid: string | undefined;
  loading: boolean;
  refreshProfile: () => Promise<void>;
} {
  const { profile, loading, refreshProfile, firebaseUser } = useAuth();
  return {
    profile,
    uid: profile?.uid ?? firebaseUser?.uid,
    loading,
    refreshProfile,
  };
}
