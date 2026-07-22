"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DEFAULT_CHAMPIONSHIP_ID } from "@/server/copaData/championshipCatalog";

import {
  ActiveChampionshipContext,
  type ActiveChampionshipContextValue,
} from "./useActiveChampionship";
import { usePoolChampionships } from "./usePoolChampionships";

/** Query param dono do campeonato ativo. */
const PARAM = "championship";

/**
 * Provider do campeonato ATIVO (multi-championship TASK-09). Montado uma vez em
 * `AppLayoutShell` (NÃO por feature — fragmentaria o estado). Resolve o id efetivo
 * a partir de `?championship=` contra o conjunto habilitado do pool e expõe o setter
 * que reescreve a URL preservando os demais params.
 *
 * Resolução do id efetivo:
 *  1. `?championship=` se ∈ conjunto habilitado;
 *  2. senão, o primeiro habilitado (ordem do catálogo);
 *  3. senão (conjunto vazio/erro), `DEFAULT_CHAMPIONSHIP_ID` (Copa legado).
 *
 * Param inválido/removido NÃO reescreve a URL no load (evita churn de histórico) —
 * a URL só muda em seleção explícita do usuário.
 */
export function ActiveChampionshipProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading } = usePoolChampionships();

  // Memoizado: sem isso, o `?? [DEFAULT]` cria novo array por render e refaz o
  // useMemo do value a cada render (warning react-hooks/exhaustive-deps).
  const enabledChampionships = useMemo(
    () => data?.enabledChampionships ?? [DEFAULT_CHAMPIONSHIP_ID],
    [data?.enabledChampionships],
  );
  const rankingMode = data?.rankingMode ?? "geral";

  const param = searchParams.get(PARAM);
  const activeChampionshipId =
    param !== null && enabledChampionships.includes(param)
      ? param
      : enabledChampionships[0] ?? DEFAULT_CHAMPIONSHIP_ID;

  const setActiveChampionship = useCallback(
    (championshipId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(PARAM, championshipId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const value = useMemo<ActiveChampionshipContextValue>(
    () => ({
      activeChampionshipId,
      enabledChampionships,
      rankingMode,
      isMultiChampionship: enabledChampionships.length > 1,
      // `false` só quando o servidor devolveu conjunto vazio (pool 100%-arquivado).
      // Durante o load / em erro, `enabledChampionships` cai no `[DEFAULT]` acima →
      // length > 0 → `true` (degrade-safe, sem flash de "temporada encerrada").
      hasActiveChampionship: enabledChampionships.length > 0,
      isLoading,
      setActiveChampionship,
    }),
    [
      activeChampionshipId,
      enabledChampionships,
      rankingMode,
      isLoading,
      setActiveChampionship,
    ],
  );

  return (
    <ActiveChampionshipContext.Provider value={value}>
      {children}
    </ActiveChampionshipContext.Provider>
  );
}
