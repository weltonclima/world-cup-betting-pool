"use client";

/**
 * MatchListHeader — cabeçalho da lista de jogos (TASK-04).
 *
 * Contém:
 *  1. Título "Jogos"
 *  2. Input de busca por seleção (shadcn Input) + botão de filtros avançados
 *  3. Chips de filtro rápido: Fase (Stage) + Status do Palpite (MatchPredictionStatus)
 *
 * O botão de filtros avançados chama `onFiltersOpen` — o Sheet é montado na TASK-05.
 * Contrato visual: ai/screen/jogos-task-04.md
 */

import { Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { Stage } from "@/types";

// ---------------------------------------------------------------------------
// Constantes de rótulo (evita hardcode espalhado)
// ---------------------------------------------------------------------------

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "grupos", label: "Fase de Grupos" },
  { value: "oitavas", label: "Oitavas" },
  { value: "quartas", label: "Quartas" },
  { value: "semifinal", label: "Semifinal" },
  { value: "terceiro", label: "3º Lugar" },
  { value: "final", label: "Final" },
];

const PREDICTION_STATUS_OPTIONS: { value: MatchPredictionStatus; label: string }[] = [
  { value: "enviado", label: "Enviados" },
  { value: "pendente", label: "Pendentes" },
  { value: "bloqueado", label: "Bloqueados" },
];

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchListHeaderProps {
  /** Texto atual do campo de busca. */
  searchQuery: string;
  /** Callback disparado ao alterar o campo de busca. */
  onSearchChange: (value: string) => void;
  /** Fase selecionada no filtro rápido. `undefined` = sem filtro de fase. */
  selectedStage: Stage | undefined;
  /** Callback disparado ao selecionar/deselecionar uma fase. */
  onStageChange: (stage: Stage | undefined) => void;
  /** Status de palpite selecionado no filtro rápido. `undefined` = "Todos". */
  selectedPredictionStatus: MatchPredictionStatus | undefined;
  /** Callback disparado ao selecionar/deselecionar um status de palpite. */
  onPredictionStatusChange: (status: MatchPredictionStatus | undefined) => void;
  /** Callback para abrir o sheet de filtros avançados (TASK-05). */
  onFiltersOpen: () => void;
  /**
   * Número de filtros avançados ativos (usado para badge no botão).
   * 0 = sem badge. Nesta TASK é sempre 0 (sheet ainda não implementado).
   */
  filtersCount: number;
}

// ---------------------------------------------------------------------------
// Subcomponente: FilterChip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "rounded-full whitespace-nowrap text-xs h-8 px-3 shrink-0",
        "transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      aria-pressed={selected}
    >
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: MatchListHeader
// ---------------------------------------------------------------------------

export function MatchListHeader({
  searchQuery,
  onSearchChange,
  selectedStage,
  onStageChange,
  selectedPredictionStatus,
  onPredictionStatusChange,
  onFiltersOpen,
  filtersCount,
}: MatchListHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 1. Título */}
      <h1 className="text-2xl font-semibold text-foreground">Jogos</h1>

      {/* 2. Busca + botão filtros avançados */}
      <div className="flex items-center gap-2">
        {/* Input de busca com ícone de lupa à esquerda */}
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Buscar por seleção"
            aria-label="Buscar jogos por seleção"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Botão filtros avançados */}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Abrir filtros avançados"
            onClick={onFiltersOpen}
            className="min-h-[44px] min-w-[44px]"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </Button>

          {/* Badge numérica de filtros ativos */}
          {filtersCount > 0 && (
            <span
              aria-label={`${filtersCount} filtro${filtersCount > 1 ? "s" : ""} ativo${filtersCount > 1 ? "s" : ""}`}
              className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
            >
              {filtersCount}
            </span>
          )}
        </div>
      </div>

      {/* 3. Chips de filtro rápido */}
      <div
        role="group"
        aria-label="Filtros rápidos"
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {/* Chips de Fase */}
        <FilterChip
          label="Todas as fases"
          selected={selectedStage === undefined}
          onClick={() => onStageChange(undefined)}
        />
        {STAGE_OPTIONS.map(({ value, label }) => (
          <FilterChip
            key={value}
            label={label}
            selected={selectedStage === value}
            onClick={() => onStageChange(selectedStage === value ? undefined : value)}
          />
        ))}

        {/* Separador visual (divisor de grupo de chips) */}
        <div aria-hidden="true" className="w-px bg-border shrink-0 mx-1" />

        {/* Chips de Status do Palpite */}
        <FilterChip
          label="Todos"
          selected={selectedPredictionStatus === undefined}
          onClick={() => onPredictionStatusChange(undefined)}
        />
        {PREDICTION_STATUS_OPTIONS.map(({ value, label }) => (
          <FilterChip
            key={value}
            label={label}
            selected={selectedPredictionStatus === value}
            onClick={() =>
              onPredictionStatusChange(
                selectedPredictionStatus === value ? undefined : value,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
