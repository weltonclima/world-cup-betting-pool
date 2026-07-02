"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getParticipantProfile } from "@/services";
import type { Statistics } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Estatísticas de um participante (Tela 05 — Perfil) (TASK-05).
 * Desabilitado enquanto `uid` ausente.
 *
 * Stale-while-revalidate (TASK-11 perf-hardening): `keepPreviousData` mantém o
 * perfil anterior visível ao navegar para outro participante, evitando o flash
 * de skeleton entre perfis enquanto a nova query carrega.
 */
export function useParticipantProfile(
  uid: string | undefined,
): UseQueryResult<Statistics | null> {
  return useQuery({
    queryKey: rankingKeys.profile(uid ?? "__none__"),
    queryFn: () => getParticipantProfile(uid!),
    enabled: Boolean(uid),
    placeholderData: keepPreviousData,
  });
}
