"use client";

import { createContext, useContext } from "react";

import { DEFAULT_CHAMPIONSHIP_ID } from "@/server/copaData/championshipCatalog";
import type { RankingMode } from "@/types/pools";

/**
 * Estado do campeonato ATIVO compartilhado pelo app (multi-championship TASK-09).
 *
 * Fonte da verdade = query param `?championship=` da URL (deep-link/refresh-safe),
 * resolvido pelo `ActiveChampionshipProvider` contra o conjunto habilitado do pool.
 * Este arquivo expõe só o contexto + o reader (`useActiveChampionship`) para que
 * hooks de dados (useMatchesList, useHomeDashboard, predictions) possam consumir o
 * id ativo SEM depender do Provider em testes — o valor default abaixo reproduz o
 * comportamento legado (só Copa) quando não há Provider na árvore.
 */
export interface ActiveChampionshipContextValue {
  /** Campeonato efetivo (sempre ∈ enabledChampionships, ou o default). */
  activeChampionshipId: string;
  /** Conjunto habilitado do pool (ordem do catálogo). */
  enabledChampionships: string[];
  /** Modo de ranking do pool (informativo; ranking real é TASK-12/21). */
  rankingMode: RankingMode;
  /** true quando o pool tem > 1 campeonato → seletor visível. */
  isMultiChampionship: boolean;
  /**
   * true quando o pool tem ≥ 1 campeonato ATIVO (não-arquivado). `false` SÓ quando
   * o conjunto habilitado carregou e veio vazio (pool 100%-arquivado, ex.: só-Copa
   * pós-encerramento) — a área ativa exibe "temporada encerrada → Histórico". Nunca
   * `false` durante o load nem em erro (degrada para Copa legado), evitando flash.
   */
  hasActiveChampionship: boolean;
  /** true enquanto o conjunto habilitado está carregando. */
  isLoading: boolean;
  /** Troca o campeonato ativo (atualiza a URL, preservando outros params). */
  setActiveChampionship: (championshipId: string) => void;
}

/**
 * Valor default = comportamento legado (só Copa, sem seletor). Usado quando um
 * consumidor roda fora do Provider (ex.: testes de hooks que mockam useMatches).
 */
const DEFAULT_VALUE: ActiveChampionshipContextValue = {
  activeChampionshipId: DEFAULT_CHAMPIONSHIP_ID,
  enabledChampionships: [DEFAULT_CHAMPIONSHIP_ID],
  rankingMode: "geral",
  isMultiChampionship: false,
  hasActiveChampionship: true,
  isLoading: false,
  setActiveChampionship: () => {},
};

export const ActiveChampionshipContext =
  createContext<ActiveChampionshipContextValue>(DEFAULT_VALUE);

/** Lê o campeonato ativo compartilhado. Seguro fora do Provider (default legado). */
export function useActiveChampionship(): ActiveChampionshipContextValue {
  return useContext(ActiveChampionshipContext);
}
