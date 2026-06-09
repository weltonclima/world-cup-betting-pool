"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getUserRanking, type UserRankingResult } from "@/services";
import { useAuth } from "@/hooks/useAuth";

import { rankingKeys } from "./rankingKeys";

/**
 * Posição/linha do usuário logado no ranking geral + total (Tela 02) (TASK-05).
 * uid vem da sessão (useAuth); desabilitado enquanto deslogado.
 */
export function useMyRanking(): UseQueryResult<UserRankingResult | null> {
  const uid = useAuth().firebaseUser?.uid;
  return useQuery({
    queryKey: rankingKeys.user(uid ?? "__anon__"),
    queryFn: () => getUserRanking(uid!),
    enabled: Boolean(uid),
  });
}
