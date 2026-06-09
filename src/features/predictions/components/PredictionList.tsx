"use client";

/**
 * PredictionList — lista de palpites com skeleton, empty state e error state (TASK-08).
 *
 * Contrato visual: ai/screen/palpites-task-08.md §6 §7 §8
 */

import { AlertCircle, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { PredictionListItem } from "../hooks/usePredictionsList";
import { PredictionListCard } from "./PredictionListCard";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface PredictionListProps {
  items: PredictionListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Indica se há filtro ativo para exibir empty state diferenciado. */
  hasActiveFilter?: boolean;
}

// ---------------------------------------------------------------------------
// Subcomponente: PredictionCardSkeleton
// ---------------------------------------------------------------------------

function PredictionCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando palpite"
      className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3"
    >
      {/* Times + placar */}
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex gap-1 items-center">
          <div className="h-8 w-6 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-8 w-6 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {/* Data */}
      <div
        aria-hidden="true"
        className="h-3 w-32 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none"
      />

      {/* Rodapé */}
      <div className="border-t border-border pt-3 flex justify-between" aria-hidden="true">
        <div className="h-4 w-28 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-5 w-20 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: PredictionListSkeleton
// ---------------------------------------------------------------------------

interface PredictionListSkeletonProps {
  count?: number;
}

function PredictionListSkeleton({ count = 4 }: PredictionListSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <PredictionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: PredictionList
// ---------------------------------------------------------------------------

/**
 * Lista de palpites com gerenciamento de todos os estados:
 * - loading → skeletons com aria-busy
 * - error → mensagem + botão retry
 * - empty (total) → "Nenhum palpite ainda"
 * - empty (filtrado) → "Nenhum palpite com este status"
 * - dados → lista de PredictionListCard
 */
export function PredictionList({
  items,
  isLoading,
  isError,
  onRetry,
  hasActiveFilter = false,
}: PredictionListProps) {
  // Estado: carregando
  if (isLoading) {
    return <PredictionListSkeleton count={4} />;
  }

  // Estado: erro
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4">
        <AlertCircle size={40} aria-hidden="true" className="text-destructive" />
        <p className="text-sm font-medium text-foreground">Erro ao carregar palpites</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="min-h-[44px] px-6"
          aria-label="Tentar novamente"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Estado: vazio
  if (items.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4"
      >
        <PenLine size={40} aria-hidden="true" className="text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {hasActiveFilter ? "Nenhum palpite com este status" : "Nenhum palpite ainda"}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasActiveFilter
            ? "Experimente outro filtro."
            : "Registre seus palpites nos jogos para acompanhá-los aqui."}
        </p>
      </div>
    );
  }

  // Caso base: lista de cards
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <PredictionListCard key={item.matchId} item={item} />
      ))}
    </div>
  );
}
