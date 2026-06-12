"use client";

/**
 * WorldcupEmptyState — estado vazio compartilhado para a feature Copa (TASK-07).
 * Reutilizado por GroupsView e BracketView (TASK-08).
 *
 * Mensagem default exata do PRD: "Nenhuma informação disponível."
 */

import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface WorldcupEmptyStateProps {
  /** Mensagem exibida. Default: "Nenhuma informação disponível." */
  message?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Estado vazio — ícone de caixa de entrada + mensagem configurável.
 */
export function WorldcupEmptyState({
  message = "Nenhuma informação disponível.",
  className,
}: WorldcupEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 gap-3 text-center px-4",
        className,
      )}
    >
      <Inbox
        size={40}
        aria-hidden="true"
        className="text-muted-foreground"
      />
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}
