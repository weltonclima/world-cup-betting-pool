"use client";

/**
 * LeagueTableView — orquestrador da tela de Classificação de liga (TASK-20).
 *
 * Espelha `GroupsView`: gate de tipo ANTES da query (guard-before-query, evita
 * fetch e flash de skeleton), corpo real em `LeagueTableViewContent` montado só
 * para liga — mantém as regras de hooks intactas (nenhum hook condicional).
 *
 * Gate INVERTIDO vs Grupos: classificação de pontos corridos só existe para
 * `type === "league"`; copa/torneio recebe aviso (não tem tabela única).
 */

import { ListOrdered } from "lucide-react";

import {
  CupOnlyNotice,
  useActiveChampionship,
  useIsCupActive,
} from "@/features/championships";
import { useLeagueStandings } from "@/features/worldcup/hooks/useLeagueStandings";
import { getChampionship } from "@/server/copaData/championshipCatalog";

import { LeagueStandingsTable } from "./LeagueStandingsTable";
import { StandingsLegend } from "./StandingsLegend";
import { WorldcupEmptyState } from "./WorldcupEmptyState";
import { WorldcupErrorState } from "./WorldcupErrorState";
import { WorldcupSkeleton } from "./WorldcupSkeleton";

// ---------------------------------------------------------------------------
// Gate cup/league (TASK-20)
// ---------------------------------------------------------------------------

/**
 * Tela de classificação. Copa/torneio não tem tabela de pontos corridos → aviso
 * ANTES de disparar `useLeagueStandings`. O corpo real vive em
 * `LeagueTableViewContent`, montado só p/ liga.
 */
export function LeagueTableView() {
  const isCup = useIsCupActive();
  if (isCup) {
    return (
      <CupOnlyNotice
        icon={ListOrdered}
        message="Classificação de pontos corridos disponível apenas para ligas."
      />
    );
  }
  return <LeagueTableViewContent />;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/** Corpo da tela: tabela única de classificação + estados da query. */
function LeagueTableViewContent() {
  const { activeChampionshipId } = useActiveChampionship();
  const { data, isPending, isError, refetch } = useLeagueStandings();

  // 1. Carregando
  if (isPending) {
    return <WorldcupSkeleton variant="table" />;
  }

  // 2. Erro
  if (isError) {
    return <WorldcupErrorState onRetry={() => void refetch()} />;
  }

  // 3. Sucesso mas sem times na tabela
  if (data.table.length === 0) {
    return <WorldcupEmptyState />;
  }

  // 4. Renderização normal — tabela única + legenda de abreviações (sem bloco de
  // qualificação: liga não tem classificação por posição).
  const championshipName = getChampionship(activeChampionshipId)?.name;

  return (
    <div className="flex flex-col gap-3">
      <LeagueStandingsTable table={data.table} championshipName={championshipName} />
      <StandingsLegend showQualification={false} />
    </div>
  );
}
