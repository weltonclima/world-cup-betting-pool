"use client";

/**
 * GroupsView — orquestrador da tela de Grupos (TASK-07).
 *
 * Consome useGroups() para obter a lista completa de tabelas de grupos.
 * Mantém estado local do grupo selecionado (default "A").
 * Resolve estados na precedência: pending → error → vazio → slice ausente → sucesso.
 */

import { useState } from "react";

import { CupOnlyNotice, useIsCupActive } from "@/features/championships";
import { useGroups } from "@/features/worldcup/hooks/useGroups";

import { GroupSelector } from "./GroupSelector";
import { GroupStandingsTable } from "./GroupStandingsTable";
import { StandingsLegend } from "./StandingsLegend";
import { WorldcupEmptyState } from "./WorldcupEmptyState";
import { WorldcupErrorState } from "./WorldcupErrorState";
import { WorldcupSkeleton } from "./WorldcupSkeleton";

// ---------------------------------------------------------------------------
// Gate cup/league (TASK-10)
// ---------------------------------------------------------------------------

/**
 * Tela de grupos. Liga de pontos corridos não tem fase de grupos FIFA → aviso
 * cup-only ANTES de disparar `useGroups` (guard-before-query: evita fetch e flash
 * de skeleton/erro). O corpo real vive em `GroupsViewContent`, montado só p/ copa
 * — mantém as regras de hooks intactas (nenhum hook chamado condicionalmente).
 */
export function GroupsView() {
  const isCup = useIsCupActive();
  if (!isCup) {
    return (
      <CupOnlyNotice message="Fase de grupos disponível apenas para copas e torneios." />
    );
  }
  return <GroupsViewContent />;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Corpo da tela de grupos: seletor de grupo + tabela de classificação + legenda.
 * Trata todos os estados de ciclo de vida da query (pending/error/empty/ok).
 */
function GroupsViewContent() {
  const { data, isPending, isError, refetch } = useGroups();
  const [selected, setSelected] = useState("A");

  // 1. Carregando
  if (isPending) {
    return <WorldcupSkeleton variant="table" />;
  }

  // 2. Erro
  if (isError) {
    return <WorldcupErrorState onRetry={() => void refetch()} />;
  }

  // 3. Sucesso mas sem grupos
  if (data.groups.length === 0) {
    return <WorldcupEmptyState />;
  }

  // 4. Slice selecionado inexistente (defensivo)
  const slice = data.groups.find((g) => g.groupId === selected);
  if (!slice) {
    return <WorldcupEmptyState />;
  }

  // 5. Renderização normal
  const groupIds = data.groups.map((g) => g.groupId);

  return (
    <div className="flex flex-col gap-3">
      {/* Seletor de grupos derivado dos dados (sem hardcode A–L) */}
      <GroupSelector
        groups={groupIds}
        value={selected}
        onChange={setSelected}
      />

      {/* Tabela de classificação do grupo selecionado */}
      <GroupStandingsTable table={slice} />

      {/* Legenda de abreviações + cores de qualificação */}
      <StandingsLegend />
    </div>
  );
}
