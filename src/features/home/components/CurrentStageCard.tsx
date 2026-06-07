"use client";

/**
 * CurrentStageCard — card "Fase Atual" da Home Dashboard (TASK-08).
 * Componente presentacional puro: recebe props, sem efeitos colaterais.
 * Contrato visual: ai/screen/home-dashboard-task-06.md §3.5
 */

import { Flag } from "lucide-react";

import type { CurrentStageSummary } from "@/features/home/lib/homeDashboardHelpers";
import type { Stage } from "@/types";

// ---------------------------------------------------------------------------
// Mapeamento de stage → rótulo pt-BR (§3.5)
// ---------------------------------------------------------------------------

/**
 * Mapa canônico de stage (chave de armazenamento) → nome legível em pt-BR.
 * Fonte única — não usar literais espalhados pelo componente.
 */
const STAGE_LABEL: Record<Stage, string> = {
  grupos: "Fase de Grupos",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface CurrentStageCardProps {
  /** Fase atual com rótulo de rodada opcional. */
  currentStage: CurrentStageSummary;
  /** true → exibe skeleton de loading. */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton de loading (§5.1)
// ---------------------------------------------------------------------------

/** Skeleton para CurrentStageCard enquanto os dados carregam. */
export function CurrentStageCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Fase Atual"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="h-4 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3" />
      <div className="h-6 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card "Fase Atual" — exibe o estágio atual da Copa em pt-BR e,
 * quando disponível, "Rodada X de Y".
 *
 * Estado empty: quando currentStage.stage é null.
 * Estado loading: quando isLoading é true.
 */
export function CurrentStageCard({
  currentStage,
  isLoading = false,
}: CurrentStageCardProps) {
  if (isLoading) {
    return <CurrentStageCardSkeleton />;
  }

  const stageName = currentStage.stage
    ? STAGE_LABEL[currentStage.stage]
    : null;

  return (
    <article
      aria-label="Fase Atual"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      {/* Cabeçalho com ícone */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <Flag size={16} aria-hidden="true" className="text-primary" />
        <span>Fase Atual</span>
      </div>

      {stageName ? (
        <>
          {/* Nome da fase em destaque (Heading 2) */}
          <p className="text-xl font-semibold text-foreground">{stageName}</p>

          {/* "Rodada X de Y" — omitido quando não disponível (R4) */}
          {currentStage.roundLabel && (
            <p className="text-sm text-muted-foreground mt-1">
              {currentStage.roundLabel}
            </p>
          )}
        </>
      ) : (
        // Estado empty
        <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
          <Flag size={24} aria-hidden="true" />
          <p className="text-sm text-muted-foreground text-center">
            Fase não definida
          </p>
        </div>
      )}
    </article>
  );
}
