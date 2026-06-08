"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getParticipantProfile } from "@/services";
import type { Statistics } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Estatísticas de um participante (Tela 05 — Perfil) (TASK-05).
 * Desabilitado enquanto `uid` ausente.
 */
export function useParticipantProfile(
  uid: string | undefined,
): UseQueryResult<Statistics | null> {
  return useQuery({
    queryKey: rankingKeys.profile(uid ?? "__none__"),
    queryFn: () => getParticipantProfile(uid!),
    enabled: Boolean(uid),
  });
}
