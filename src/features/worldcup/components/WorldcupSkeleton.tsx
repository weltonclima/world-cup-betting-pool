"use client";

/**
 * WorldcupSkeleton — skeleton genérico de carregamento para a feature Copa (TASK-07).
 *
 * Variantes:
 * - "table" (padrão): header + ~4 linhas pulsando — usado em GroupsView.
 * - "bracket": stacked-cards skeleton — reservado para TASK-08 (BracketView).
 *
 * role="status" aria-busy="true" para acessibilidade.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface WorldcupSkeletonProps {
  variant?: "table" | "bracket";
  className?: string;
}

// ---------------------------------------------------------------------------
// Variante: tabela de grupos
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <>
      {/* Seletor de grupo skeleton */}
      <div className="flex gap-2 pb-1 mb-3" aria-hidden="true">
        {[80, 80, 80, 80].map((w, i) => (
          <div
            key={i}
            style={{ width: w }}
            className="h-9 rounded-full bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>

      {/* Cabeçalho da tabela skeleton */}
      <div
        aria-hidden="true"
        className="h-8 w-full rounded bg-muted animate-pulse motion-reduce:animate-none mb-1"
      />

      {/* Linhas skeleton */}
      <div className="flex flex-col gap-1" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-10 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>

      {/* Legenda skeleton */}
      <div
        aria-hidden="true"
        className="mt-3 h-4 w-3/4 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Variante: chaveamento (reservado para TASK-08)
// ---------------------------------------------------------------------------

function BracketSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-16 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Skeleton de carregamento compartilhado para GroupsView (variant="table")
 * e BracketView (variant="bracket", TASK-08).
 */
export function WorldcupSkeleton({ variant = "table", className }: WorldcupSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando"
      className={cn("w-full", className)}
    >
      {variant === "table" ? <TableSkeleton /> : <BracketSkeleton />}
    </div>
  );
}
