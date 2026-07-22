"use client";

/**
 * Reader do TIPO do campeonato ATIVO (multi-championship TASK-10).
 *
 * `useActiveChampionshipType` resolve o `type` ("cup" | "league") do campeonato
 * ativo a partir do catálogo estático (`getChampionship(id).type`). O tipo NUNCA
 * é inferido de dados de API — só do catálogo curado (invariante do spike
 * TASK-01/02).
 *
 * Fallback `"cup"` para id fora do catálogo: compat legado — um id desconhecido
 * jamais esconde as telas de copa já existentes (comportamento byte-idêntico ao
 * pré-multichamp). `useIsCupActive` é o gate booleano consumido pela navegação e
 * pelas telas cup-only (Grupos, Eliminatórias, Melhores Terceiros).
 */

import { getChampionship } from "@/server/copaData/championshipCatalog";
import type { ChampionshipType } from "@/types/championships";

import { useActiveChampionship } from "./useActiveChampionship";

/** Tipo do campeonato ativo. Id desconhecido → `"cup"` (compat legado). */
export function useActiveChampionshipType(): ChampionshipType {
  const { activeChampionshipId } = useActiveChampionship();
  return getChampionship(activeChampionshipId)?.type ?? "cup";
}

/** `true` quando o campeonato ativo é copa/torneio (gate das telas cup-only). */
export function useIsCupActive(): boolean {
  return useActiveChampionshipType() === "cup";
}
