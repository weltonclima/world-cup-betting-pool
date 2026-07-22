"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getPoolChampionships, type PoolChampionships } from "@/services/group";

/**
 * Lê os campeonatos habilitados do pool da sessão via rota escopada a MEMBRO
 * (`GET /api/group/championships`, TASK-09). NÃO usa `useGroupSettings` (admin-only)
 * — o seletor precisa funcionar para todos os participantes.
 *
 * Chave própria (`["group","championships"]`), fora de `groupKeys.settings` (essa é
 * a leitura admin do pool inteiro). `staleTime` moderado: config muda raramente,
 * mas menos estática que o catálogo.
 */
export function usePoolChampionships(): UseQueryResult<PoolChampionships, Error> {
  return useQuery<PoolChampionships, Error>({
    queryKey: ["group", "championships"],
    queryFn: () => getPoolChampionships(),
    staleTime: 5 * 60 * 1000, // 5min
  });
}
