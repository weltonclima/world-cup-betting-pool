"use client";

/**
 * PredictionFilters — chips de filtro single-select para a lista de palpites.
 *
 * 7 chips: Todos · Pendentes · Acertos · Vencedor · Empates · Erros · Bloqueados.
 * - Persistência em localStorage (key "predictions_filter") com try/catch SSR safety.
 * - Acessibilidade: role="group" no wrapper + aria-pressed em cada chip.
 * - Touch mínimo: min-h-[44px] (WCAG 2.5.5).
 * - Tokens de design: bg-primary/bg-secondary (sem hex).
 */

import type { PredictionDisplayStatus } from "@/features/predictions/lib";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type FilterChip = "todos" | PredictionDisplayStatus;

export interface PredictionFiltersProps {
  activeFilter: FilterChip;
  onChange: (filter: FilterChip) => void;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STORAGE_KEY = "predictions_filter";

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "acertou", label: "Acertos" },
  { value: "acertou_vencedor", label: "Vencedor" },
  { value: "acertou_empate", label: "Empates" },
  { value: "errou", label: "Erros" },
  { value: "bloqueado", label: "Bloqueados" },
];

// ---------------------------------------------------------------------------
// Helpers de localStorage (SSR safe)
// ---------------------------------------------------------------------------

export function readStoredFilter(): FilterChip {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "todos" ||
      raw === "pendente" ||
      raw === "acertou" ||
      raw === "acertou_vencedor" ||
      raw === "acertou_empate" ||
      raw === "errou" ||
      raw === "bloqueado"
    ) {
      return raw;
    }
  } catch {
    // SSR ou localStorage indisponível
  }
  return "todos";
}

function writeStoredFilter(filter: FilterChip): void {
  try {
    localStorage.setItem(STORAGE_KEY, filter);
  } catch {
    // SSR ou localStorage indisponível
  }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Chips de filtro single-select para a lista de palpites.
 * Estado gerenciado pelo pai (controlled component).
 */
export function PredictionFilters({ activeFilter, onChange }: PredictionFiltersProps) {
  function handleChange(filter: FilterChip) {
    writeStoredFilter(filter);
    onChange(filter);
  }

  return (
    <div role="group" aria-label="Filtrar palpites">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CHIPS.map((chip) => {
          const isActive = chip.value === activeFilter;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleChange(chip.value)}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-3 text-xs min-h-[44px] shrink-0",
                "transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-secondary-foreground font-medium border border-transparent hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
