"use client";

/**
 * BracketView — orquestrador da tela de Eliminatórias (TASK-08).
 *
 * Consome useBracket() e renderiza as 6 fases empilhadas na ordem oficial.
 * Resolve estados na precedência: pending → error → vazio total → sucesso.
 * Reusa os componentes de estado compartilhados criados na TASK-07.
 */

import { useBracket } from "@/features/worldcup/hooks/useBracket";
import type { BracketResponse } from "@/types/worldcup";

import { PhaseSection } from "./PhaseSection";
import { WorldcupEmptyState } from "./WorldcupEmptyState";
import { WorldcupErrorState } from "./WorldcupErrorState";
import { WorldcupSkeleton } from "./WorldcupSkeleton";

// ---------------------------------------------------------------------------
// Ordem oficial das fases + rótulos pt-BR
// ---------------------------------------------------------------------------

interface PhaseConfig {
  key: keyof BracketResponse;
  label: string;
}

/** Fases na ordem oficial de progressão do torneio (spec §6.2). */
const PHASES: PhaseConfig[] = [
  { key: "roundOf32", label: "Dezesseis-avos" },
  { key: "roundOf16", label: "Oitavas de Final" },
  { key: "quarterFinals", label: "Quartas de Final" },
  { key: "semiFinals", label: "Semifinais" },
  { key: "thirdPlace", label: "Disputa do 3º Lugar" },
  { key: "final", label: "Final" },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Tela de eliminatórias: fases empilhadas com cards de confronto.
 * Trata todos os estados de ciclo de vida da query (pending/error/empty/ok).
 */
export function BracketView() {
  const { data, isPending, isError, refetch } = useBracket();

  // 1. Carregando
  if (isPending) {
    return <WorldcupSkeleton variant="bracket" />;
  }

  // 2. Erro
  if (isError) {
    return <WorldcupErrorState onRetry={() => void refetch()} />;
  }

  // 3. Sucesso mas todas as fases vazias
  const hasAnyMatch = PHASES.some((phase) => data[phase.key].length > 0);
  if (!hasAnyMatch) {
    return <WorldcupEmptyState />;
  }

  // 4. Renderização normal — seções vazias são omitidas pelo PhaseSection
  return (
    <div className="flex flex-col gap-6">
      {PHASES.map((phase) => (
        <PhaseSection
          key={phase.key}
          label={phase.label}
          matches={data[phase.key]}
        />
      ))}
    </div>
  );
}
