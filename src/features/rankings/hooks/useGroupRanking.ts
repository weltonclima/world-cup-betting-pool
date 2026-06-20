"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolGroupRanking } from "@/services";
import type { GroupRanking } from "@/types";

import { rankingKeys } from "./rankingKeys";

/**
 * Ranking de um grupo da Copa (A–L) recortado ao pool do usuário (PRD-09, Tela 03
 * "Por Grupo"). O servidor resolve o pool pela sessão e re-rankeia só os membros do
 * pool naquele grupo — antes lia o doc global e vazava participantes de outros bolões.
 * Desabilitado enquanto `groupId` ausente; `groupId!` no queryFn é seguro sob `enabled`.
 */
export function useGroupRanking(
  groupId: string | undefined,
): UseQueryResult<GroupRanking | null> {
  return useQuery({
    queryKey: rankingKeys.group(groupId ?? "__none__"),
    queryFn: () => getPoolGroupRanking(groupId!),
    enabled: Boolean(groupId),
  });
}
