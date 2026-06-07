"use client";

/**
 * Página de palpites (/predictions) — TASK-08.
 *
 * Exibe a lista de palpites do usuário com filtros por status.
 * Nav "Palpites" já existe em nav-items.ts — sem alteração necessária.
 */

import { useState } from "react";

import { usePredictionsList } from "@/features/predictions/hooks";
import {
  PredictionFilters,
  PredictionList,
  readStoredFilter,
} from "@/features/predictions/components";
import type { FilterChip } from "@/features/predictions/components";

export default function PredictionsPage() {
  const { items, isLoading, isError, refetch } = usePredictionsList();

  // Estado do filtro — inicializa a partir do localStorage (lazy state)
  const [activeFilter, setActiveFilter] = useState<FilterChip>(() => readStoredFilter());

  // Filtro puro em memória — sem requisição adicional
  const filteredItems =
    activeFilter === "todos"
      ? items
      : items.filter((item) => item.displayStatus === activeFilter);

  const hasActiveFilter = activeFilter !== "todos";

  return (
    <div className="flex flex-col gap-4 pb-20 md:pb-4">
      <h1 className="text-2xl font-semibold text-foreground">Meus Palpites</h1>

      {/* Chips de filtro — ocultos no estado de erro (não há dados para filtrar) */}
      {!isError && (
        <PredictionFilters activeFilter={activeFilter} onChange={setActiveFilter} />
      )}

      <PredictionList
        items={filteredItems}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        hasActiveFilter={hasActiveFilter}
      />
    </div>
  );
}
